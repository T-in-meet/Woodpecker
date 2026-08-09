import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";

type NoteChatStreamStatusProps = {
  streamingContent: string;
  isStreaming: boolean;
};

/**
 * 현재 스트리밍 중인 Assistant 답변 또는 답변 생성 상태를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.isStreaming 답변 생성 진행 여부
 * @returns 스트리밍 답변, 생성 상태 UI 또는 표시할 상태가 없으면 null
 */
export function NoteChatStreamStatus({
  streamingContent,
  isStreaming,
}: NoteChatStreamStatusProps) {
  if (streamingContent.length > 0) {
    return <NoteChatAssistantMessage text={streamingContent} isStreaming />;
  }

  if (!isStreaming) {
    return null;
  }

  return (
    <li className="flex justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>답변 생성 중</span>

        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="size-1 animate-pulse rounded-full bg-current" />
          <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
          <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:0.4s]" />
        </span>
      </div>
    </li>
  );
}
