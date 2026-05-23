/**
 * 발신자 주소를 환경변수에서 가져온다.
 *
 * provider가 바뀌어도 호출부는 동일 계약을 유지하기 위해
 * sendAuthEmail 단에서 단일 source-of-truth를 사용한다.
 */
export function resolveFromAddress(): string {
  const from = process.env["AUTH_EMAIL_FROM"];

  if (!from) {
    throw new Error("AUTH_EMAIL_FROM is not set");
  }

  return from;
}
