let prefillEmail: string | null = null;

// 로그인 페이지 등에서 forgot-password 진입 직전에 prefill 값을 메모리에 저장한다.
export function setForgotPasswordPrefillEmail(email: string | null) {
  prefillEmail = email;
}

// prefill은 1회성 정책이므로 읽는 즉시 비워 재주입을 방지한다.
export function consumeForgotPasswordPrefillEmail() {
  const current = prefillEmail;
  prefillEmail = null;
  return current;
}
