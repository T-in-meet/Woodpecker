import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";

type NoteChatStreamStatusProps = {
  streamingContent: string;
  isAnswerGenerating: boolean;
};

/**
 * 현재 스트리밍 중인 Assistant 답변을 렌더링합니다.
 *
 * 답변 생성 상태 자체는 Conversation의 최신 메시지 이동 컨트롤에서
 * 별도로 표시하며, 실제 답변 내용이 수신된 경우에만 메시지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.isAnswerGenerating 로컬 스트림 또는 서버 Claim 기준 답변 생성 진행 여부
 * @returns 스트리밍 중인 Assistant 메시지 또는 null
 */
export function NoteChatStreamStatus({
  streamingContent,
}: NoteChatStreamStatusProps) {
  if (streamingContent.length === 0) {
    return null;
  }

  return <NoteChatAssistantMessage text={streamingContent} isStreaming />;
}
