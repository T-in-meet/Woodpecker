/**
 * Request Eligibility System — 단일 진입점(single entry point)
 *
 * 회원가입 및 재전송의 rate limit에 대한 통합된 결정 권한을 가집니다.
 *
 * 설계:
 * - 단일 진입점: checkRequestEligibility(route, ip, email)
 * - 원자성(Atomic): 한 함수 내에서 결정과 상태 업데이트가 이루어짐
 * - AND 평가: 4가지 조건이 모두 통과되어야 함
 * - 사용자 범위: 회원가입과 재전송 간에 이메일 상태가 공유됨
 * - 관측 가능성(Observability): 차단된 요청에 대해서만 logRequestEligibilityBlocked 로그 기록
 * - body parsing 이전에 read-only IP precheck를 수행할 수 있음
 * - 단, precheck는 최종 결정 권한이 아니며 상태를 변경하지 않음
 *
 * 상태 모델:
 * - IP short window: burst 억제 (짧은 시간 내 다수 요청 차단)
 * - IP long window: sustained 공격 방어 (긴 시간 내 누적 요청 차단)
 * - 이메일 short window: 즉각적인 재시도 억제 (재사용 대기 시간 교체)
 * - 이메일 long window: 사용자 수준 계정 rate limit (회원가입 + 재전송 공유)
 */

import { AUTH_LOG_REASONS } from "../constants/authLogReasons";
import { evaluateSlidingWindow } from "../utils/rateLimit.utils";
import {
  emailStore,
  ipStore,
  resetEligibilityStore,
  tryCleanupExpiredEntries,
} from "./requestEligibilityStore";

/**
 * IP 기반 rate limit (이중 윈도우)
 * - short: 과도한 요청(Burst) 억제 — 짧은 윈도우 내에 동일한 IP의 다수 요청을 거절함
 * - long: sustained 공격 방어 — 분당 한도 이하로 요청해도 누적 차단
 *
 * [이유: 단일 short window(10req/1min)만으로는 sustained credential stuffing 방어 불가.
 *  공격자가 분당 9건씩 요청하면 15분간 135건 가능.
 *  long window(50req/15min)로 sustained 공격을 차단.]
 */
export const IP_SHORT_LIMIT = 10;
export const IP_SHORT_WINDOW_MS = 60 * 1000; // 1 minute
export const IP_LONG_LIMIT = 50;
export const IP_LONG_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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
 * @param route - "signup" | "resend" | "login" | "forgot-password" (어떤 API가 차단되었는지 로깅 목적)
 * @param ip - 클라이언트 IP 주소 (IP 저장소에 그대로 사용됨)
 * @param canonicalEmail - caller에서 canonicalizeEmail() 적용된 값
 *
 * @returns EligibilityResult — allowed:true 또는 allowed:false + blockedBy 차원
 *
 * 흐름:
 * 1. 읽기(Read) 단계: 상태 변경 없이 모든 조건을 평가함
 *    - ipOk: IP 한도 내에 있는가?
 *    - emailShortOk: 이메일 짧은 윈도우 한도 내에 있는가? (signup/resend 전용)
 *    - emailLongOk: 이메일 긴 윈도우 한도 내에 있는가?
 *
 * 2. 결정(Decision): 모든 조건을 AND 로 묶음
 *    - signup/resend: allowed = ipOk && emailShortOk && emailLongOk
 *    - login: allowed = ipOk && emailLongOk
 *      [이유: login-rules §Rate Limit — 이메일 기준 제한은 더 긴 시간축에서 완만하게 적용.
 *       short window는 즉각 재시도를 막기 위한 것이므로 로그인 비밀번호 오타 재시도에는 부적합]
 *
 * 3. 쓰기(Write) 단계: allowed=true 일 때만 상태를 업데이트함
 *    - 차단된 경우: blockedBy 차원을 반환하고 상태를 변경하지 않음 (로깅은 route handler 책임)
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

// [이유: IP를 short/long으로 분리하면서 "ip" → "ipShort" | "ipLong"으로 rename]
export type BlockedBy = "ipShort" | "ipLong" | "emailShort" | "emailLong";

export type EligibilityResult =
  | { allowed: true }
  | { allowed: false; blockedBy: BlockedBy };

export type RateLimitReason =
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
  | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG;

export function mapBlockedByToReason(blockedBy: BlockedBy): RateLimitReason {
  switch (blockedBy) {
    case "ipShort":
      // [이유: RATE_LIMIT_IP → RATE_LIMIT_IP_SHORT로 rename됨]
      return AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT;
    case "ipLong":
      // [이유: IP long window 추가로 신규 로그 reason 필요]
      return AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG;
    case "emailShort":
      return AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT;
    case "emailLong":
      return AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG;
  }
}

function getEmailEligibilityKey(
  route:
    | "signup"
    | "resend"
    | "login"
    | "forgot-password"
    | "verify-otp"
    | "resend-email",
  canonicalEmail: string,
): string {
  if (route === "forgot-password") {
    return `forgotPassword:${canonicalEmail}`;
  }

  return canonicalEmail;
}

export function checkRequestEligibility(
  route:
    | "signup"
    | "resend"
    | "login"
    | "forgot-password"
    | "verify-otp"
    | "resend-email",
  ip: string,
  canonicalEmail: string,
): EligibilityResult {
  const now = Date.now();
  // caller(signup/resend)가 canonicalizeEmail으로 canonical email을 전달 보장
  // 중복 정규화 제거 — email을 그대로 canonical email key로 사용

  // ============================================================================
  // 1. 읽기(Read) 단계 — 상태 업데이트 없이 모든 조건 평가
  // ============================================================================

  // [이유: ipStore 구조가 IpEligibilityEntry로 변경됨 — shortWindow/longWindow 별도 접근]
  const ipEntry = ipStore.get(ip);
  const emailKey = getEmailEligibilityKey(route, canonicalEmail);
  const emailEntry = emailStore.get(emailKey) ?? {
    shortWindow: null,
    longWindow: null,
  };

  // 이유: prune/evaluate/append 책임을 utils로 위임하여 호출부 오케스트레이션 축소
  // [이유: IP short window — burst 억제]
  const ipShortEval = evaluateSlidingWindow(
    ipEntry?.shortWindow?.timestamps ?? [],
    IP_SHORT_LIMIT,
    IP_SHORT_WINDOW_MS,
    now,
  );
  // [이유: IP long window — sustained 공격 방어. IP_LONG_LIMIT/IP_LONG_WINDOW_MS 신규 추가]
  const ipLongEval = evaluateSlidingWindow(
    ipEntry?.longWindow?.timestamps ?? [],
    IP_LONG_LIMIT,
    IP_LONG_WINDOW_MS,
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

  // [이유: IP가 short/long으로 분리됨 — 둘 다 통과해야 ipOk]
  const ipShortOk = ipShortEval.allowed;
  const ipLongOk = ipLongEval.allowed;
  const ipOk = ipShortOk && ipLongOk;
  // login은 short window를 적용하지 않음 — 비밀번호 오타 재시도를 허용하기 위해 완만한 long window만 사용
  const emailShortOk = route === "login" ? true : shortEval.allowed;
  const emailLongOk = longEval.allowed;

  // ============================================================================
  // 2. AND 판별
  // ============================================================================

  const allowed = ipOk && emailShortOk && emailLongOk;

  // ============================================================================
  // 3. 쓰기(Write) 단계 — allowed 일 때만 상태를 업데이트함
  // ============================================================================

  if (!allowed) {
    // 차단 차원은 ipShort → ipLong → emailShort → emailLong 우선순위로 결정
    // [이유: IP short가 가장 강한 burst 억제이므로 최우선. IP long은 sustained 차단]
    // route handler가 blockedBy를 받아 AUTH_RATE_LIMIT_BLOCKED 이벤트를 로깅한다
    const blockedBy: BlockedBy = !ipShortOk
      ? "ipShort"
      : !ipLongOk
        ? "ipLong"
        : !emailShortOk
          ? "emailShort"
          : "emailLong";

    return { allowed: false, blockedBy };
  }

  // 허용됨: 두 저장소를 모두 원자적으로 업데이트함
  // [이유: IpEligibilityEntry 구조로 short/long 양쪽 동시 업데이트]
  ipStore.set(ip, {
    shortWindow: { timestamps: ipShortEval.next },
    longWindow: { timestamps: ipLongEval.next },
  });

  const nextEmailEntry = {
    // login은 short window 카운터를 업데이트하지 않음 — 적용하지 않은 윈도우를 오염시키지 않기 위해
    shortWindow:
      route === "login"
        ? (emailStore.get(emailKey)?.shortWindow ?? null)
        : { timestamps: shortEval.next },
    longWindow: { timestamps: longEval.next },
  };
  emailStore.set(emailKey, nextEmailEntry);

  /**
   * 기회주의적 cleanup 실행
   *
   * [설계]
   * - 요청이 허용된 후에만 cleanup 호출
   * - 스로틀링: 분당 최대 1회만 실행 (내부에서 처리됨)
   * - 순환 참조 방지: windowMs 값을 파라미터로 전달
   * - 메모리 누수 방지: 만료된 rate limit 항목 정리
   * [이유: IP_LONG_WINDOW_MS 추가 — IP 이중 윈도우 지원]
   */
  tryCleanupExpiredEntries(
    IP_SHORT_WINDOW_MS,
    IP_LONG_WINDOW_MS,
    EMAIL_SHORT_WINDOW_MS,
    EMAIL_LONG_WINDOW_MS,
  );

  return { allowed: true };
}

/**
 * IP rate limit precheck 결과
 *
 * - allowed: 요청 허용 여부
 * - blockedBy: 차단된 경우 어떤 window에서 차단되었는지 식별
 *
 * 주의:
 * - blockedBy는 route 계층에서 AUTH_LOG_REASONS 매핑에 사용된다
 * - precheck는 read-only 판단만 수행하며 상태를 변경하지 않는다
 */
type IpRateLimitPrecheckResult =
  | { allowed: true }
  | {
      allowed: false;
      blockedBy: "ipShort" | "ipLong";
    };

/**
 * IP 기반 rate limit 사전 검증 — 읽기 전용
 *
 * 목적:
 * - 본문 파싱 전에 IP 차단 여부를 조기 평가하여 파싱 비용을 줄임
 * - 최종 결정 권한(checkRequestEligibility)을 대체하지 않고 1차 필터 역할만 수행
 *
 * 동작:
 * - evaluateSlidingWindow(appendOnAllow=false)로 현재 IP 상태를 읽기 전용 평가만 수행
 * - short window를 먼저 평가하고, short가 허용된 경우에만 long window를 평가함
 * - 차단 시 blockedBy로 어떤 window에서 차단되었는지 반환함
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
 * @returns 허용 시 `{ allowed: true }`, 차단 시 `{ allowed: false, blockedBy }`를 반환한다.
 *          blockedBy는 `"ipShort"` 또는 `"ipLong"`이며, route 계층에서 로그 reason 매핑에 사용한다.
 */

export function checkIpRateLimitPrecheck(
  ip: string,
): IpRateLimitPrecheckResult {
  const now = Date.now();
  const ipEntry = ipStore.get(ip);

  const shortEvaluation = evaluateSlidingWindow(
    ipEntry?.shortWindow?.timestamps ?? [],
    IP_SHORT_LIMIT,
    IP_SHORT_WINDOW_MS,
    now,
    { appendOnAllow: false },
  );

  if (!shortEvaluation.allowed) {
    return { allowed: false, blockedBy: "ipShort" };
  }

  const longEvaluation = evaluateSlidingWindow(
    ipEntry?.longWindow?.timestamps ?? [],
    IP_LONG_LIMIT,
    IP_LONG_WINDOW_MS,
    now,
    { appendOnAllow: false },
  );

  if (!longEvaluation.allowed) {
    return { allowed: false, blockedBy: "ipLong" };
  }

  return { allowed: true };
}

// 테스트를 위한 모듈 내보내기
export { resetEligibilityStore };
