import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";

type NoteChatStreamStatusProps = {
  streamingContent: string;
  isAnswerGenerating: boolean;
};

/**
 * 현재 스트리밍 중인 Assistant 답변 또는 답변 생성 상태를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.isAnswerGenerating 로컬 스트림 또는 서버 Claim 기준 답변 생성 진행 여부
 * @returns 스트리밍 답변, 생성 상태 UI 또는 표시할 상태가 없으면 null
 */
export function NoteChatStreamStatus({
  streamingContent,
  isAnswerGenerating,
}: NoteChatStreamStatusProps) {
  if (streamingContent.length > 0) {
    return <NoteChatAssistantMessage text={streamingContent} isStreaming />;
  }

  if (!isAnswerGenerating) {
    return null;
  }

  return (
    <li className="flex justify-center">
      <div
        className="flex items-center text-sm text-muted-foreground"
        aria-label="답변 생성 중..."
      >
        {"답변 생성 중...".split("").map((char, index) => (
          <span
            key={index}
            className="inline-block animate-bounce"
            style={{
              animationDelay: `${index * 0.08}s`,
              animationDuration: "0.8s",
            }}
            aria-hidden="true"
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </div>
    </li>
  );
}
