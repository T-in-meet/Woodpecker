/**
 * 인증 흐름 이메일 prefill 메모리
 *
 * 인증 페이지 이동 과정에서
 * 사용자가 직전에 입력한 이메일을
 * 다음 페이지로 임시 전달하기 위해 사용한다.
 *
 * 정책:
 * - 브라우저 새로고침 시 유지되지 않는다.
 * - 최초 소비 이후 즉시 제거한다.
 * - 인증 흐름 내부의 1회성 데이터 전달만 담당한다.
 */
let prefillEmail: string | null = null;

/**
 * 인증 이메일 prefill 저장
 *
 * forgot-password → resend-email
 * verify-otp → resend-email
 *
 * 같은 인증 흐름 이동 직전에 호출한다.
 */
export function setAuthEmailPrefillEmail(email: string | null) {
  prefillEmail = email;
}

/**
 * 인증 이메일 prefill 소비
 *
 * prefill은 1회성 정책이다.
 *
 * 값을 읽는 즉시 메모리에서 제거하여:
 *
 * - 뒤로가기 재주입 방지
 * - Strict Mode 재렌더링 중복 사용 방지
 * - 오래된 이메일 재사용 방지
 */
export function consumeAuthEmailPrefillEmail() {
  const current = prefillEmail;

  /**
   * 소비 즉시 제거
   */
  prefillEmail = null;

  return current;
}
