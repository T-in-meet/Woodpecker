import { Headset } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

type NoteChatConversationListErrorProps = {
  onRetry: () => void;
};

/**
 * Conversation 목록 조회 실패 상태를 렌더링합니다.
 *
 * 사용자는 목록을 다시 조회할 수 있으며,
 * 문제가 계속되는 경우 고객 센터 문의 화면을 새 탭에서 열 수 있습니다.
 *
 * @param props 컴포넌트 속성
 * @param props.onRetry Conversation 목록을 다시 조회하는 함수
 * @returns Conversation 목록 조회 실패 UI
 */
export function NoteChatConversationListError({
  onRetry,
}: NoteChatConversationListErrorProps) {
  return (
    <div className="flex h-full items-center justify-center p-6" role="alert">
      <div className="space-y-4 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            대화 목록을 불러오지 못했습니다.
          </p>

          <p className="text-sm text-muted-foreground">
            잠시 후 다시 시도해 주세요.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={onRetry}>
          다시 시도
        </Button>

        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          문제가 계속되면
          <Link
            href={`${ROUTES.MYPAGE}?section=support&tab=inquiry`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 border-b border-current hover:text-foreground"
          >
            <Headset className="size-3" aria-hidden="true" />
            고객 센터
          </Link>
          를 통해 알려주세요.
        </p>
      </div>
    </div>
  );
}
