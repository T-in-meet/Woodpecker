import { Skeleton } from "@/components/ui/skeleton";

/**
 * Conversation 상세 데이터를 조회하는 동안 표시할 Skeleton을 렌더링합니다.
 *
 * @returns Conversation 상세 조회 로딩 UI
 */
export function NoteChatConversationSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-6 py-4">
        <Skeleton className="h-6 w-48" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex justify-end">
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
        </div>

        <div className="flex justify-start">
          <Skeleton className="h-24 w-3/4 rounded-2xl" />
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-16 w-1/2 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
