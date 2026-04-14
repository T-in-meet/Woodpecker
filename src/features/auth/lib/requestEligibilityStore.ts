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
 * 운영 한계(중요):
 * - 이 저장소는 프로세스 메모리 기반(single-process) 구현이다.
 * - 따라서 멀티 인스턴스/서버리스 환경에서는 인스턴스별 카운터가 분리되어
 *   전역 rate limit 정확도가 낮아지는 best-effort 방식으로 동작한다.
 *
 * 현재 선택 이유:
 * - MVP 단계에서의 단순성과 낮은 지연(latency)을 고려한 의도적인 선택이다.
 * - 외부 저장소 없이 빠르게 동작하는 대신, best-effort 수준의 rate limit만 보장한다.
 *
 * 보안 범위:
 * - 이 방식은 다중 인스턴스 환경에서 strict한 rate limit을 보장하지 않는다.
 * - 현재는 기본적인 abuse 방지 수준에서는 허용되지만,
 *   높은 보안 요구사항이나 공격 빈도가 높은 환경에서는 충분하지 않다.
 *
 * TODO(스케일 아웃 전환 기준):
 * - Upstash Redis 같은 외부 공유 저장소로 전환한다.
 * - 전환 트리거(예시):
 *   1) 동시 활성 인스턴스가 2개 이상으로 유지되는 환경(예: Vercel scale-out)
 *   2) auth 요청량이 분당 1,000건 이상으로 증가해 인스턴스 간 편차가 관측되는 시점
 *   3) 보안/컴플라이언스 요구사항상 "전역 일관 rate limit"이 필수인 시점
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
 * - 특성: single-process best-effort (멀티 인스턴스 간 공유되지 않음)
 */
export const ipStore = new Map<string, WindowEntry>();

/**
 * 이메일 기반 적격성 저장소 (인메모리)
 * - Key: 소문자로 정규화된 이메일
 * - Value: EmailEligibilityEntry (short + long 윈도우)
 * - 특성: single-process best-effort (멀티 인스턴스 간 공유되지 않음)
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
  // [주의: 테스트 격리 시 throttle 상태도 초기화하여 cleanup이 정상 작동하도록 함]
  lastCleanupTimeMs = 0;
}

/**
 * 만료된 rate limit 항목 정리 — 메모리 누수 방지
 *
 * 설계:
 * - 기회주의적(Opportunistic): setInterval 없이 요청 처리 중에 호출됨
 * - 스로틀링: 최소 간격(CLEANUP_THROTTLE_MS)으로 실행 빈도 제한
 * - 부분 정리: 이메일은 양쪽 윈도우 모두 만료될 때만 항목 제거, 개별 정리는 필요시만
 *
 * 특징:
 * - IP store: 만료된 항목 전체 제거
 * - Email store: 만료된 윈도우는 null로 설정, 양쪽 모두 null이면 항목 제거
 * - 의존성 없음: windowMs 값을 파라미터로 받음 (순환 참조 방지)
 *
 * @param now - 현재 타임스탬프 (ms)
 * @param windowMs - 창 만료 판단에 사용할 윈도우 시간 (IP/email 별로 다름)
 */
function cleanupExpiredEntries(
  now: number,
  ipWindowMs: number,
  emailShortWindowMs: number,
  emailLongWindowMs: number,
): void {
  // IP store 정리: 만료된 항목 제거
  // [이유: IP는 단일 윈도우만 있으므로 만료되면 항목 전체 제거]
  for (const [ip, entry] of ipStore.entries()) {
    if (now - entry.windowStart >= ipWindowMs) {
      ipStore.delete(ip);
    }
  }

  // Email store 정리: 윈도우별로 만료 처리
  // [이유: 이메일은 두 윈도우(short/long)가 있으므로 부분 정리 필요]
  for (const [email, entry] of emailStore.entries()) {
    let shortExpired = false;
    let longExpired = false;

    // Short window 만료 확인
    if (entry.shortWindow !== null) {
      if (now - entry.shortWindow.windowStart >= emailShortWindowMs) {
        shortExpired = true;
      }
    } else {
      shortExpired = true; // 이미 null이면 만료된 것으로 간주
    }

    // Long window 만료 확인
    if (entry.longWindow !== null) {
      if (now - entry.longWindow.windowStart >= emailLongWindowMs) {
        longExpired = true;
      }
    } else {
      longExpired = true; // 이미 null이면 만료된 것으로 간주
    }

    // 양쪽 윈도우 모두 만료되었으면 항목 전체 제거
    // [이유: lazy initialization — 활성 윈도우 없으면 항목 불필요]
    if (shortExpired && longExpired) {
      emailStore.delete(email);
    } else if (shortExpired || longExpired) {
      // 한쪽만 만료된 경우: 불변 업데이트로 새 entry 생성 후 교체
      // [이유: direct mutation 금지 — checkRequestEligibility의 full-replace 패턴과 동일]
      const nextEmailEntry: EmailEligibilityEntry = {
        shortWindow: shortExpired ? null : entry.shortWindow,
        longWindow: longExpired ? null : entry.longWindow,
      };
      emailStore.set(email, nextEmailEntry);
    }
  }
}

/**
 * 타임스탬프 기반 스로틀링을 고려한 cleanup 실행
 *
 * @internal 이 함수는 checkRequestEligibility에서만 호출되어야 함
 *
 * [설계 의도]
 * - 스로틀링: 분당 최대 1회 정리 실행 (CPU 오버헤드 방지)
 * - 파라미터 주입: 윈도우 상수를 직접 임포트하지 않음 (순환 참조 방지)
 */
export function tryCleanupExpiredEntries(
  ipWindowMs: number,
  emailShortWindowMs: number,
  emailLongWindowMs: number,
): void {
  const now = Date.now();

  // 스로틀링: 마지막 cleanup 이후 최소 간격이 경과했는지 확인
  // [이유: 매 요청마다 cleanup을 할 필요 없이 일정 주기로만 실행]
  if (now - lastCleanupTimeMs < CLEANUP_THROTTLE_MS) {
    return;
  }

  lastCleanupTimeMs = now;
  cleanupExpiredEntries(now, ipWindowMs, emailShortWindowMs, emailLongWindowMs);
}

/**
 * Cleanup 스로틀링 설정
 * - 최소 1분 간격으로 cleanup 실행
 * [이유: rate limit window가 최대 15분이므로 1분 주기는 충분하고 오버헤드가 적음]
 */
const CLEANUP_THROTTLE_MS = 60 * 1000; // 1 minute

/**
 * 마지막 cleanup 실행 시각 (ms)
 * - 0으로 초기화하여 첫 호출 시 항상 cleanup이 실행되도록 함
 */
let lastCleanupTimeMs = 0;
