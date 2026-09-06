/** AI 실행 관측 callback의 동기·비동기 반환 타입입니다. */
export type AiObserver<TObservation> = (
  observation: TObservation,
) => void | Promise<void>;

/**
 * 관측 callback을 실행하되 관측 계층의 실패를 AI 실행에서 격리합니다.
 *
 * @param observer 선택적으로 전달된 관측 callback
 * @param observation 실행 중 이미 확보한 관측값
 */
export async function notifyAiObserver<TObservation>(
  observer: AiObserver<TObservation> | undefined,
  observation: TObservation,
): Promise<void> {
  if (observer === undefined) {
    return;
  }

  try {
    // sync throw와 rejected Promise를 같은 best-effort 경계에서 처리한다.
    await observer(observation);
  } catch {
    // 관측 실패는 Provider 호출 결과와 사용자-facing 동작을 바꾸지 않는다.
  }
}
