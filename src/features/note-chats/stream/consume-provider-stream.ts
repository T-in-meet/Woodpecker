import type {
  AiChatStreamEvent,
  AiChatStreamResult,
} from "@/features/ai/providers/types";

import type { NoteChatStreamTextDeltaEvent } from "./types";

/**
 * Provider 스트림 소비가 정상적으로 완료된 결과입니다.
 */
export type ConsumedNoteChatProviderStream = {
  /** Provider가 생성한 전체 답변과 사용량·메타데이터입니다. */
  result: AiChatStreamResult;

  /** 스트림에서 누적한 전체 답변 문자열입니다. */
  content: string;
};

/**
 * Provider Chat 스트림을 소비하면서 텍스트 조각을 노트 챗봇 이벤트로 변환합니다.
 *
 * Provider의 `text-delta` 이벤트는 즉시 호출자에게 전달하고,
 * `finish` 이벤트를 받으면 전체 Provider 결과를 반환합니다.
 *
 * 이 함수는 DB 저장이나 Run 상태 변경을 수행하지 않습니다.
 *
 * @param providerStream AI Foundation이 반환한 Provider 공통 스트림
 * @param onTextDelta 텍스트 조각이 생성될 때 호출할 함수
 * @returns Provider 스트림의 최종 결과
 */
export async function consumeNoteChatProviderStream(
  providerStream: AsyncGenerator<AiChatStreamEvent>,
  onTextDelta: (event: NoteChatStreamTextDeltaEvent) => void | Promise<void>,
): Promise<ConsumedNoteChatProviderStream> {
  let content = "";
  let result: AiChatStreamResult | null = null;

  for await (const event of providerStream) {
    switch (event.type) {
      case "text-delta": {
        content += event.delta;

        await onTextDelta({
          delta: event.delta,
          type: "text-delta",
        });

        break;
      }

      case "finish": {
        result = event.result;
        break;
      }
    }
  }

  if (!result) {
    throw new Error("AI Provider stream completed without a finish event.");
  }

  /*
   * Provider 구현이 누적한 최종 content와 실제로 전달받은 delta 합계가
   * 다르면 스트림 데이터가 유실되었을 가능성이 있으므로 실행을 중단합니다.
   */
  if (result.content !== content) {
    throw new Error(
      "AI Provider stream content does not match accumulated text deltas.",
    );
  }

  return {
    content,
    result,
  };
}
