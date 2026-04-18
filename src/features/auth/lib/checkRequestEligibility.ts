/**
 * Request Eligibility System — 단일 진입점(single entry point)
 *
 * 회원가입 및 재전송의 rate limit에 대한 통합된 결정 권한을 가집니다.
 *
 * 설계:
 * - 단일 진입점: checkRequestEligibility(route, ip, email)
 * - 원자성(Atomic): 한 함수 내에서 결정과 상태 업데이트가 이루어짐
 * - AND 평가: 3가지 조건이 모두 통과되어야 함
 * - 사용자 범위: 회원가입과 재전송 간에 이메일 상태가 공유됨
 * - 관측 가능성(Observability): 차단된 요청에 대해서만 logRequestEligibilityBlocked 로그 기록
 * - body parsing 이전에 read-only IP precheck를 수행할 수 있음
 * - 단, precheck는 최종 결정 권한이 아니며 상태를 변경하지 않음
 *
 * 상태 모델:
 * - IP rate limit: 단일 윈도우, 강력한 과도한 요청(burst) 억제
 * - 이메일 short window: 즉각적인 재시도 억제 (재사용 대기 시간 교체)
 * - 이메일 long window: 사용자 수준 계정 rate limit (회원가입 + 재전송 공유)
 */

import { evaluateSlidingWindow } from "../utils/rateLimit.utils";
import {
  emailStore,
  ipStore,
  resetEligibilityStore,
  tryCleanupExpiredEntries,
} from "./requestEligibilityStore";

/**
 * IP 기반 rate limit
 * - 과도한 요청(Burst) 억제: 짧은 윈도우 내에 동일한 IP의 다수 요청을 거절함
 */
export const IP_LIMIT = 10;
export const IP_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * 이메일 기반 rate limit: 짧은 윈도우(short window)
 * - 즉각적인 재시도 억제 (재사용 대기 시간 타임스탬프 모델 대체)
 * - 긴 윈도우(long window)보다 훨씬 짧음
 * [이유: EMAIL_SHORT_LIMIT = 1 이면 연속된 요청을 막음(cooldown 동작과 유사).
 *  Short window는 이전 요청 후 30초 이내의 어떠한 요청도 차단함.]
 */
export const EMAIL_SHORT_LIMIT = 1;
export const EMAIL_SHORT_WINDOW_MS = 30 * 1000; // 30 seconds

/**
 * 이메일 기반 rate limit: 긴 윈도우(long window)
 * - 회원가입과 재전송 간 공유되는 사용자 수준의 계정 rate limit
 * - 단일 계정에 대한 지속적인 공격 방지
 */
export const EMAIL_LONG_LIMIT = 5;
export const EMAIL_LONG_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * 요청 적격성 확인 — 단일 결정 권한(single decision authority)
 *
 * @param route - "signup" 또는 "resend" (어떤 API가 차단되었는지 로깅 목적)
 * @param ip - 클라이언트 IP 주소 (IP 저장소에 그대로 사용됨)
 * @param email - canonical email (caller에서 canonicalizeEmail() 적용된 값)
 *
 * @returns { allowed: boolean }
 *
 * 흐름:
 * 1. 읽기(Read) 단계: 상태 변경 없이 모든 조건을 평가함
 *    - ipOk: IP 한도 내에 있는가?
 *    - emailShortOk: 이메일 짧은 윈도우 한도 내에 있는가?
 *    - emailLongOk: 이메일 긴 윈도우 한도 내에 있는가?
 *
 * 2. 결정(Decision): 모든 조건을 AND 로 묶음
 *    - allowed = ipOk && emailShortOk && emailLongOk
 *
 * 3. 쓰기(Write) 단계: allowed=true 일 때만 상태를 업데이트함
 *    - 차단된 경우: 거절 로그를 남기고 상태를 변경하지 않음
 *    - 허용된 경우: IP와 이메일 저장소를 원자적으로(atomically) 업데이트함
 *
 * 설계 제약조건:
 * - 지연 초기화(Lazy initialization): email 저장소 항목은 allowed=true 일 때만 생성됨
 * - 안전한 접근: undefined 접근 처리를 막기 위해 ?? defaultEntry 사용
 * - 책임 위임: prune/evaluate/append는 evaluateSlidingWindow(utils)에서 수행함
 * - 완전한 교체(Full replace): 이 함수는 utils가 계산한 next 상태를 store에 교체 저장함
 * - 상태 오염 방지: 차단된 요청은 어떠한 상태도 건드리지 않음
 * - 정규화 책임 분리: 이 함수는 이메일을 정규화하지 않으며 caller의 canonical 값을 그대로 사용함
 *
 */

export function checkRequestEligibility(
  route: "signup" | "resend",
  ip: string,
  email: string,
): { allowed: boolean } {
  const now = Date.now();
  // caller(signup/resend)가 canonicalizeEmail으로 canonical email을 전달 보장
  // 중복 정규화 제거 — email을 그대로 canonical email key로 사용
  const canonicalEmail = email;

  // ============================================================================
  // 1. 읽기(Read) 단계 — 상태 업데이트 없이 모든 조건 평가
  // ============================================================================

  const ipEntry = ipStore.get(ip);
  const emailEntry = emailStore.get(canonicalEmail) ?? {
    shortWindow: null,
    longWindow: null,
  };

  // 이유: prune/evaluate/append 책임을 utils로 위임하여 호출부 오케스트레이션 축소
  const ipEval = evaluateSlidingWindow(
    ipEntry?.timestamps ?? [],
    IP_LIMIT,
    IP_WINDOW_MS,
    now,
  );
  const shortEval = evaluateSlidingWindow(
    emailEntry.shortWindow?.timestamps ?? [],
    EMAIL_SHORT_LIMIT,
    EMAIL_SHORT_WINDOW_MS,
    now,
  );
  const longEval = evaluateSlidingWindow(
    emailEntry.longWindow?.timestamps ?? [],
    EMAIL_LONG_LIMIT,
    EMAIL_LONG_WINDOW_MS,
    now,
  );

  const ipOk = ipEval.allowed;
  const emailShortOk = shortEval.allowed;
  const emailLongOk = longEval.allowed;

  // ============================================================================
  // 2. AND 판별
  // ============================================================================

  const allowed = ipOk && emailShortOk && emailLongOk;

  // ============================================================================
  // 3. 쓰기(Write) 단계 — allowed 일 때만 상태를 업데이트함
  // ============================================================================

  if (!allowed) {
    // 차단됨: 거절 로그를 남기고 상태를 수정하지 않음
    logRequestEligibilityBlocked({
      route,
      ip,
      email: canonicalEmail,
      ipOk,
      emailShortOk,
      emailLongOk,
      now,
    });

    return { allowed: false };
  }

  // 허용됨: 두 저장소를 모두 원자적으로 업데이트함
  // 이유: utils가 계산한 next 상태를 그대로 저장
  ipStore.set(ip, { timestamps: ipEval.next });

  const nextEmailEntry = {
    shortWindow: { timestamps: shortEval.next },
    longWindow: { timestamps: longEval.next },
  };
  emailStore.set(canonicalEmail, nextEmailEntry);

  /**
   * 기회주의적 cleanup 실행
   *
   * [설계]
   * - 요청이 허용된 후에만 cleanup 호출
   * - 스로틀링: 분당 최대 1회만 실행 (내부에서 처리됨)
   * - 순환 참조 방지: windowMs 값을 파라미터로 전달
   * - 메모리 누수 방지: 만료된 rate limit 항목 정리
   */
  tryCleanupExpiredEntries(
    IP_WINDOW_MS,
    EMAIL_SHORT_WINDOW_MS,
    EMAIL_LONG_WINDOW_MS,
  );

  return { allowed: true };
}

/**
 * 요청 적격성 거절 로그 작성 (내부 용도로만 사용됨)
 *
 * allowed=false일 때만 호출됨. 다음과 같은 것을 기록함:
 * - 어떤 API가 차단되었는가 (signup vs resend)
 * - 어떤 조건이 실패했는가 (ipOk, emailShortOk, emailLongOk)
 * - 마스킹된 식별자 (아주 날 것의 IP/이메일은 보관하지 않음)
 *
 * 이 함수는 checkRequestEligibility 내부에 한정되며, 라우터에서
 * 노출되거나 직접 호출되어서는 안 됨. 모든 로깅은 중복 로그를 방지하고
 * 일관된 관측 가능성을 보장하기 위해 checkRequestEligibility 내부에서 진행됨.
 */
function logRequestEligibilityBlocked(params: {
  route: "signup" | "resend";
  ip: string;
  email: string;
  ipOk: boolean;
  emailShortOk: boolean;
  emailLongOk: boolean;
  now: number;
}): void {
  const maskedIp = maskIp(params.ip);
  const maskedEmail = maskEmail(params.email);

  console.log(
    JSON.stringify({
      event: "request_eligibility_blocked",
      route: params.route,
      maskedIp,
      maskedEmail,
      ipOk: params.ipOk,
      emailShortOk: params.emailShortOk,
      emailLongOk: params.emailLongOk,
      timestamp: new Date(params.now).toISOString(),
    }),
  );
}

/**
 * 로깅을 위해 IP 주소 마스킹 (마지막 자리를 가림)
 * 예: 192.168.1.100 → 192.168.1.***
 */
function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "***";
    return parts.join(".");
  }
  // IPv6 혹은 기타 포맷의 경우: 콜론 뒤 마지막 문자들을 마스킹
  if (ip.includes(":")) {
    const colonIndex = ip.lastIndexOf(":");
    return ip.substring(0, colonIndex + 1) + "***";
  }
  return "***";
}

/**
 * 로깅을 위해 이메일 마스킹 (로컬 부분을 가림)
 * 예: user@example.com → ***@example.com
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex > 0) {
    return "***" + email.substring(atIndex);
  }
  return "***";
}

/**
 * IP 기반 rate limit 사전 검증 — 읽기 전용
 *
 * 목적:
 * - 본문 파싱 전에 IP 차단 여부를 조기 평가하여 파싱 비용을 줄임
 * - 최종 결정 권한(checkRequestEligibility)을 대체하지 않고 1차 필터 역할만 수행
 *
 * 동작:
 * - evaluateSlidingWindow(appendOnAllow=false)로 현재 IP 상태를 읽기 전용 평가만 수행
 * - ipStore 및 어떤 상태도 변경하지 않음
 *
 * 설계 제약:
 * - 읽기 전용(read-only): ipStore를 읽기만 하고 쓰지 않음
 * - 이메일 불필요: 본문 파싱 전에 실행되므로 IP만 사용
 * - 상태 오염 금지: 차단 시에도 어떤 카운터도 증가하지 않음
 * - 최종 결정 권한이 아님: 최종 허용/차단 판단은 항상 checkRequestEligibility가 수행
 *
 * trade-off:
 * - malformed JSON 요청은 eligibility 계층에 도달하지 않으므로 rate limit 카운터에 포함되지 않음
 * - 따라서 파싱 이전의 저수준 flood 공격 완화는 infra/edge 계층(WAF/CDN 등)과 함께 고려해야 함
 *
 * @param ip - 클라이언트 IP 주소
 * @returns { allowed: boolean } false이면 checkRequestEligibility를 호출하지 않고 즉시 차단
 */
export function checkIpRateLimitPrecheck(ip: string): { allowed: boolean } {
  const now = Date.now();
  const ipEntry = ipStore.get(ip);
  // [이유: 상태를 변경하지 않고 현재 IP 한도만 평가한다. 최종 결정은 checkRequestEligibility에 위임]
  const evaluation = evaluateSlidingWindow(
    ipEntry?.timestamps ?? [],
    IP_LIMIT,
    IP_WINDOW_MS,
    now,
    { appendOnAllow: false },
  );
  return { allowed: evaluation.allowed };
}

// 테스트를 위한 모듈 내보내기
export { resetEligibilityStore };
