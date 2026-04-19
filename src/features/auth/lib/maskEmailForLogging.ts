/**
 * 이메일을 로깅용으로 마스킹한다.
 * - local part는 노출하지 않고 도메인만 유지
 */
export function maskEmailForLogging(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex > 0) {
    return "***" + email.substring(atIndex);
  }
  return "***";
}
