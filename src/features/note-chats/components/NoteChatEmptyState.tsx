/**
 * 노트 챗봇 대화가 없을 때 표시하는 빈 상태 화면을 렌더링합니다.
 *
 * @returns 노트 챗봇의 빈 상태 UI
 */
export function NoteChatEmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-lg font-semibold">무엇이 궁금한가요?</p>

          <p className="text-sm leading-6 text-muted-foreground">
            저장한 노트를 바탕으로 질문해 보세요. 관련된 노트를 찾아 답변을
            만들어 드립니다.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
          <p className="text-xs font-medium text-muted-foreground">예시</p>

          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• 내가 정리한 React Query 내용을 설명해줘.</li>
            <li>• 이 주제와 관련된 노트들을 비교해줘.</li>
            <li>• 이전에 공부한 내용을 간단히 복습시켜줘.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
