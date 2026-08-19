import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants/routes";

type NoteChatStreamErrorProps = {
  retryCount: number;
  canRetry: boolean;
  isStreaming: boolean;
  onRetry?: () => Promise<void>;
};

/**
 * 노트 챗봇 답변 생성 실패 상태와 재시도 또는 고객 지원 안내를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.retryCount 현재 질문의 재시도 횟수
 * @param props.canRetry 답변 생성을 다시 실행할 수 있는지 여부
 * @param props.isStreaming 현재 답변 생성이 진행 중인지 여부
 * @param props.onRetry 실패한 답변 생성을 다시 실행하는 함수
 * @returns 답변 생성 실패 상태 UI
 */
export function NoteChatStreamError({
  retryCount,
  canRetry,
  isStreaming,
  onRetry,
}: NoteChatStreamErrorProps) {
  return (
    <li className="flex justify-start">
      <div
        role="alert"
        className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
      >
        {retryCount < 2 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-destructive">
                답변을 생성하지 못했습니다.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                잠시 후 다시 시도해 주세요.
              </p>
            </div>

            {canRetry && onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isStreaming}
                onClick={() => {
                  void onRetry();
                }}
              >
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-destructive">
                답변을 계속 생성하지 못하고 있습니다.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                문제가 반복되면 고객 지원을 통해 알려주세요.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto sm:shrink-0"
              asChild
            >
              <Link href={`${ROUTES.MYPAGE}?section=support&tab=inquiry`}>
                고객 지원으로 이동
              </Link>
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
