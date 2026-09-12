import { Skeleton } from "@/components/ui/skeleton";

const NOTE_CHAT_CONVERSATION_LIST_SKELETON_COUNT = 4;

/**
 * Conversation 목록을 조회하는 동안 표시할 Skeleton을 렌더링합니다.
 *
 * 실제 Conversation 목록의 제목, 마지막 메시지, 메뉴 배치를 따라
 * 조회 완료 전후의 레이아웃 변화를 줄입니다.
 */
export function NoteChatConversationListSkeleton() {
  return (
    <div role="status" aria-label="대화 목록을 불러오는 중" aria-busy="true">
      <span className="sr-only">대화 목록을 불러오는 중입니다.</span>

      <ul className="space-y-1" aria-hidden="true">
        {Array.from({
          length: NOTE_CHAT_CONVERSATION_LIST_SKELETON_COUNT,
        }).map((_, index) => (
          <li key={index} className="flex items-center gap-2 rounded-md">
            <div className="min-w-0 flex-1 space-y-2 px-3 py-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>

            <div className="flex shrink-0 items-center justify-center pr-2">
              <div className="flex size-8 items-center justify-center pointer-coarse:size-11">
                <Skeleton className="size-6 rounded-md" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
