/**
 * Auth 폼의 root error 종류입니다.
 *
 * ATTEMPT
 * - 현재 입력값 또는 현재 인증 시도와 관련된 오류
 * - 관련 입력을 수정하면 이전 오류를 제거할 수 있다.
 *
 * SYSTEM
 * - rate limit, network, server 등 입력 수정으로 해결되지 않는 오류
 * - 입력 변경만으로 제거하지 않고 다음 실제 요청 시작 시 제거한다.
 */
export const AUTH_ROOT_ERROR_TYPE = {
  ATTEMPT: "attempt",
  SYSTEM: "system",
} as const;

/**
 * 입력 변경 시 root error를 제거해야 하는지 판단합니다.
 *
 * 관련 입력이 무엇인지는 각 폼이 결정하고,
 * 이 함수는 root error 종류에 따른 제거 정책만 담당합니다.
 */
export function shouldClearRootOnInputChange(errorType?: unknown) {
  return errorType === AUTH_ROOT_ERROR_TYPE.ATTEMPT;
}
