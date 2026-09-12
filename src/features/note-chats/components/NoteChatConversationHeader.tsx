import { Skeleton } from "@/components/ui/skeleton";

import { NoteChatBreadcrumb } from "./NoteChatBreadcrumb";
import { NoteChatConversationMenu } from "./NoteChatConversationMenu";

type NoteChatConversationHeaderProps = {
  conversationId: string;
  conversationTitle: string | undefined;
  isError: boolean;
  isLoading: boolean;
};

/**
 * Conversation 상단의 Breadcrumb와 메뉴를 렌더링합니다.
 *
 * 상세 데이터를 불러오는 동안에는 동일한 높이의 Skeleton을 표시하여
 * 데이터 조회 전후의 레이아웃 이동을 방지합니다.
 *
 * 상세 조회가 실패하거나 Conversation을 찾을 수 없는 경우에는
 * 해당 상태를 Breadcrumb의 현재 페이지로 표시하고,
 * 노트 챗봇 목록으로 이동할 수 있는 경로를 유지합니다.
 */
export function NoteChatConversationHeader({
  conversationId,
  conversationTitle,
  isError,
  isLoading,
}: NoteChatConversationHeaderProps) {
  if (conversationTitle !== undefined) {
    return (
      <div className="my-4 flex items-center justify-between">
        <NoteChatBreadcrumb conversationTitle={conversationTitle} />

        <NoteChatConversationMenu
          conversationId={conversationId}
          title={conversationTitle}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        aria-hidden="true"
        className="my-4 flex items-center justify-between"
      >
        <Skeleton className="h-6 w-48 rounded-md" />

        <div className="flex size-8 items-center justify-center pointer-coarse:size-11">
          <Skeleton className="size-6 rounded-md" />
        </div>
      </div>
    );
  }

  const fallbackTitle = isError
    ? "대화를 불러오지 못했습니다"
    : "대화를 찾을 수 없습니다";

  return (
    <div className="my-4 flex min-h-8 items-center">
      <NoteChatBreadcrumb conversationTitle={fallbackTitle} />
    </div>
  );
}
