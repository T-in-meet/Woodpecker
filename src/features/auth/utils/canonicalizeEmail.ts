// Gmail / GoogleMail 도메인인 경우 특별 처리
const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"];

/**
 * 이메일 정규화 함수 (Canonicalization)
 *
 * 목적:
 * - Gmail alias를 동일 identity로 취급
 * - identity check / duplicate check / rate limit / internal lookup의 단일 진입점
 *
 * 전제:
 * - 이 함수에 전달되는 email은 schema/input validation 단계에서 이미 trim된 값이다.
 * - 이 함수는 trim 책임을 갖지 않는다
 *
 * 규칙:
 * 1. 문자열 lowercase
 * 2. local part와 domain 분리 (@ 기준, 마지막 @ 사용)
 * 3. Gmail/GoogleMail 도메인 감지:
 *    - local에서 '.' 전부 제거 (u.s.e.r → user)
 *    - local에서 '+' 이후 전부 제거 (user+tag → user)
 *    - domain을 gmail.com으로 통일 (googlemail.com → gmail.com)
 * 4. non-Gmail: lowercase만 적용
 *
 * 예시:
 * - user+tag@gmail.com → user@gmail.com
 * - u.s.e.r@gmail.com → user@gmail.com
 * - user@googlemail.com → user@gmail.com
 * - user+tag@company.com → user+tag@company.com (보존)
 *
 * 특징:
 * - 순수 함수: 같은 입력 → 항상 같은 출력
 * - 외부 상태 의존성 없음
 */
export function canonicalizeEmail(email: string): string {
  const normalized = email.toLowerCase();

  // @ 기준으로 local / domain 분리 (마지막 @ 사용)
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex === -1) {
    // @ 없으면 그대로 반환 (edge case)
    return normalized;
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  if (GMAIL_DOMAINS.includes(domain)) {
    // local에서 '.' 전부 제거
    const dotsRemoved = local.replace(/\./g, "");
    // local에서 '+' 이후 전부 제거
    const normalizedLocal = dotsRemoved.replace(/\+.*$/, "");
    // domain을 gmail.com으로 통일
    return `${normalizedLocal}@gmail.com`;
  }

  // non-Gmail: trim + lowercase만 적용
  return normalized;
}
