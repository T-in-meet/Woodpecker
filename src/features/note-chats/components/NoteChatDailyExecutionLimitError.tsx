/**
 * Note Chat 일일 실행 횟수를 모두 사용한 상태를 표시합니다.
 *
 * 일일 제한은 재시도로 해결할 수 없는 상태이므로
 * 일반 스트림 오류와 달리 재시도 동작을 제공하지 않습니다.
 *
 * @returns Note Chat 일일 실행 횟수 초과 안내 UI
 */
export function NoteChatDailyExecutionLimitError() {
  return (
    <li className="flex justify-start">
      <div
        role="alert"
        className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
      >
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">
            오늘 사용할 수 있는 노트 챗봇 횟수를 모두 사용했습니다.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            내일 다시 이용해 주세요.
          </p>
        </div>
      </div>
    </li>
  );
}
