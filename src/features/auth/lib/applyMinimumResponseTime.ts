/**
 * 최소 응답 시간 (ms)
 *
 * Account Enumeration 방어를 위해 모든 응답 경로를 동일한 시간 이상 걸리도록 보장.
 * elapsed time이 이 값보다 작을 때만 남은 시간만큼 대기한다.
 */
export const MIN_RESPONSE_MS = 400;

/**
 * 최소 응답 시간 보장 헬퍼
 *
 * 목적:
 * - 응답이 너무 빠르게 끝나는 경로를 일정 시간 이상 지연시켜
 *   내부 분기 차이가 외부 응답 시간에 그대로 드러나지 않도록 한다.
 *
 * 동작:
 * - start 시각부터 현재까지 경과 시간을 계산한다.
 * - 경과 시간이 MIN_RESPONSE_MS보다 짧으면 남은 시간만큼 대기한다.
 * - 이미 최소 시간을 초과한 경우에는 추가 지연 없이 즉시 반환한다.
 *
 * 사용 규칙:
 * - 개별 분기 내부에서 호출하지 말고, route handler의 최종 반환 직전에
 *   공통적으로 한 번만 적용해야 한다.
 * - 성공, validation 실패, rate limit, 예외 복구 경로를 모두 동일하게 감싸야 한다.
 *
 * @param start 요청 처리 시작 시각 (Date.now() 기준 ms)
 * @param response 최종 반환할 Response 객체
 * @returns 최소 응답 시간이 보장된 Response
 */
export async function applyMinimumResponseTime(
  start: number,
  response: Response,
): Promise<Response> {
  const elapsed = Date.now() - start;

  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, MIN_RESPONSE_MS - elapsed),
    );
  }

  return response;
}
