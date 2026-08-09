import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

/**
 * Conversation을 찾을 수 없거나 접근할 수 없을 때 안내 화면을 렌더링합니다.
 *
 * @returns Conversation 없음 상태 UI
 */
export function NoteChatConversationNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium">대화를 찾을 수 없습니다.</p>

          <p className="text-sm text-muted-foreground">
            삭제되었거나 접근할 수 없는 대화입니다.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={ROUTES.NOTE_CHATS}>대화 목록으로 돌아가기</Link>
        </Button>
      </div>
    </div>
  );
}
