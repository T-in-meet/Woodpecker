/**
 * 요청 적격성 시스템(Request Eligibility System) — 통합 rate limit 저장소
 *
 * 설계:
 * - IP 기반: 과도한 요청(burst) 억제를 위한 단일 윈도우
 * - 이메일 기반 (2단계): 짧은 윈도우 (즉각적인 재시도 억제) + 긴 윈도우 (사용자 계정 수준 rate limit)
 * - 회원가입과 재전송은 동일한 이메일 저장소를 공유 (API 범위가 아닌 사용자 범위)
 *
 * 상태 모델:
 * - ipStore: Map<ip, WindowEntry>
 * - emailStore: Map<normalizedEmail, EmailEligibilityEntry>
 *
 * EmailEligibilityEntry는 즉시 재시도 억제와 사용자 수준 rate limiting을 분리합니다:
 * - shortWindow: null | WindowEntry (쿨다운 대체 — 즉각적인 재시도 억제)
 * - longWindow: null | WindowEntry (회원가입 + 재전송이 공유하는 계정 수준 제한)
 */

/**
 * Rate limit 윈도우 상태
 * - count: 현재 윈도우 내 요청 수
 * - windowStart: 윈도우가 시작된 타임스탬프 (ms)
 */
export type WindowEntry = {
  count: number;
  windowStart: number;
};

/**
 * 이메일 기반 적격성 상태 (2단계)
 * - shortWindow: 즉각적인 재시도 억제 (재사용 대기 시간 타임스탬프 모델 대체)
 * - longWindow: 회원가입/재전송에 걸쳐 공유되는 사용자 수준의 계정 rate limit
 */
export type EmailEligibilityEntry = {
  shortWindow: WindowEntry | null;
  longWindow: WindowEntry | null;
};

/**
 * IP 기반 rate limit 저장소 (인메모리)
 * - Key: IP 주소 (문자열 그대로)
 * - Value: WindowEntry
 */
export const ipStore = new Map<string, WindowEntry>();

/**
 * 이메일 기반 적격성 저장소 (인메모리)
 * - Key: 소문자로 정규화된 이메일
 * - Value: EmailEligibilityEntry (short + long 윈도우)
 *
 * 설계 이유:
 * - 지연 초기화(Lazy initialization): 요청이 허용될 때만 항목 확정
 * - ?? { shortWindow: null, longWindow: null } 기본값을 통해 안전하게 접근
 * - 업데이트 시 완전 교체: 직접 수정 없이 언제나 새로운 객체 생성
 */
export const emailStore = new Map<string, EmailEligibilityEntry>();

/**
 * 적격성 저장소 초기화 (테스트 격리)
 *
 * IP와 이메일 상태를 모두 지웁니다. 각 테스트 간 교차 오염을 방지하기 위해 사용됩니다.
 */
export function resetEligibilityStore(): void {
  ipStore.clear();
  emailStore.clear();
}
