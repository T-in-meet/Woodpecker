import { Button } from "@/components/ui/button";

type NoteChatConversationErrorProps = {
  isFetching: boolean;
  onRetry: () => void;
};

/**
 * Conversation 상세 조회 실패 상태를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.isFetching 재조회 진행 여부
 * @param props.onRetry Conversation 상세 데이터를 다시 조회하는 함수
 * @returns Conversation 상세 조회 실패 UI
 */
export function NoteChatConversationError({
  isFetching,
  onRetry,
}: NoteChatConversationErrorProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium">대화를 불러오지 못했습니다.</p>

          <p className="text-sm text-muted-foreground">
            잠시 후 다시 시도해 주세요.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={onRetry}
        >
          {isFetching ? "다시 불러오는 중..." : "다시 시도"}
        </Button>
      </div>
    </div>
  );
}
