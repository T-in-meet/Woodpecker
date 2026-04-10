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
 *
 * 상태 모델:
 * - IP rate limit: 단일 윈도우, 강력한 과도한 요청(burst) 억제
 * - 이메일 short window: 즉각적인 재시도 억제 (재사용 대기 시간 교체)
 * - 이메일 long window: 사용자 수준 계정 rate limit (회원가입 + 재전송 공유)
 */

import {
  emailStore,
  ipStore,
  resetEligibilityStore,
  type WindowEntry,
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
 * @param email - 이메일 주소 (저장소 키를 위해 소문자로 변환됨)
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
 * - 완전한 교체(Full replace): 항상 새로운 WindowEntry/EmailEligibilityEntry 객체를 생성함
 * - 불변 업데이트(Immutable update): nextWindow()는 새 객체를 반환하며 직접 수정하지 않음
 * - 상태 오염 방지: 차단된 요청은 어떠한 상태도 건드리지 않음
 * - 이메일 정규화: 스토어 키 일관성을 위해 이메일을 소문자로 변환함
 */
export function checkRequestEligibility(
  route: "signup" | "resend",
  ip: string,
  email: string,
): { allowed: boolean } {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase();

  // ============================================================================
  // 1. 읽기(Read) 단계 — 상태 업데이트 없이 모든 조건 평가
  // ============================================================================

  const ipEntry = ipStore.get(ip);
  const emailEntry = emailStore.get(normalizedEmail) ?? {
    shortWindow: null,
    longWindow: null,
  };

  const ipOk = withinLimit(ipEntry, IP_LIMIT, IP_WINDOW_MS, now);
  const emailShortOk = withinLimit(
    emailEntry.shortWindow,
    EMAIL_SHORT_LIMIT,
    EMAIL_SHORT_WINDOW_MS,
    now,
  );
  const emailLongOk = withinLimit(
    emailEntry.longWindow,
    EMAIL_LONG_LIMIT,
    EMAIL_LONG_WINDOW_MS,
    now,
  );

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
      email: normalizedEmail,
      ipOk,
      emailShortOk,
      emailLongOk,
      now,
    });

    return { allowed: false };
  }

  // 허용됨: 두 저장소를 모두 원자적으로 업데이트함
  const nextIpEntry = nextWindow(ipEntry, IP_WINDOW_MS, now);
  ipStore.set(ip, nextIpEntry);

  const nextEmailEntry = {
    shortWindow: nextWindow(emailEntry.shortWindow, EMAIL_SHORT_WINDOW_MS, now),
    longWindow: nextWindow(emailEntry.longWindow, EMAIL_LONG_WINDOW_MS, now),
  };
  emailStore.set(normalizedEmail, nextEmailEntry);

  return { allowed: true };
}

/**
 * 헬퍼: 요청이 한도 내에 있는지 판별함 (읽기 전용, 상태 수정 없음)
 *
 * @param entry - 기존 WindowEntry 이거나 undefined
 * @param limit - 윈도우 내에서 허용된 최대 요청 수
 * @param windowMs - 윈도우 유지 기간
 * @param now - 현재 타임스탬프
 *
 * @returns 요청이 허용되어야 하면 true
 *
 * 논리:
 * - 항목 없음: 허용 (첫 요청)
 * - 만료된 항목: 허용 (윈도우 초기화)
 * - Count < limit: 허용
 * - Count >= limit: 거절
 */
function withinLimit(
  entry: WindowEntry | null | undefined,
  limit: number,
  windowMs: number,
  now: number,
): boolean {
  if (!entry) {
    return true;
  }

  if (now - entry.windowStart >= windowMs) {
    return true;
  }

  return entry.count < limit;
}

/**
 * 헬퍼: 다음 윈도우 상태를 계산함 (불변성 유지)
 *
 * @param entry - 기존 WindowEntry 이거나 null
 * @param windowMs - 윈도우 유지 시간
 * @param now - 현재 타임스탬프
 *
 * @returns 새로운 WindowEntry 객체 반환
 *
 * 설계:
 * - 항목이 없거나 만료된 경우: count=1인 새로운 윈도우 시작
 * - 활성화된 윈도우: count 증가
 * - 언제나 새로운 객체 반환 (입력된 값의 내부값을 변경하지 않음)
 */
function nextWindow(
  entry: WindowEntry | null | undefined,
  windowMs: number,
  now: number,
): WindowEntry {
  if (!entry || now - entry.windowStart >= windowMs) {
    // 새로운 윈도우
    return {
      count: 1,
      windowStart: now,
    };
  }

  // 활성화된 윈도우: count 증가
  return {
    count: entry.count + 1,
    windowStart: entry.windowStart,
  };
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

// 테스트를 위한 모듈 내보내기
export { resetEligibilityStore };
