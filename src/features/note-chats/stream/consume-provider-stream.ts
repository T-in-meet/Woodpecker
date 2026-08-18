import type {
  AiChatStreamEvent,
  AiChatStreamResult,
} from "@/features/ai/providers/types";

import type { NoteChatStreamTextDeltaEvent } from "./types";

/**
 * Provider 스트림 소비가 정상적으로 완료된 결과입니다.
 */
export type ConsumedNoteChatProviderStream = {
  /** Provider가 생성한 전체 응답과 사용량·메타데이터입니다. */
  result: AiChatStreamResult;

  /**
   * Provider가 반환한 원본 응답 문자열입니다.
   *
   * 노트 챗봇 Prompt 계약에 따라 구조화 JSON 문자열이며,
   * 이후 answer와 usedContextIndexes를 파싱하는 데 사용합니다.
   */
  content: string;
};

/**
 * 스트리밍 중 JSON의 answer 필드를 증분 파싱하기 위한 상태입니다.
 *
 * 이미 확인한 문자열 위치를 cursor에 저장하여 Provider delta가 추가될 때마다
 * 전체 누적 문자열을 처음부터 다시 파싱하지 않습니다.
 */
type StreamingAnswerParserState = {
  /** 다음에 파싱할 누적 content 위치입니다. */
  cursor: number;

  /** 현재 answer 파싱 단계입니다. */
  phase: "find-key" | "after-key" | "after-colon" | "in-answer" | "completed";
};

/**
 * 새로운 스트리밍 answer parser 상태를 생성합니다.
 */
function createStreamingAnswerParserState(): StreamingAnswerParserState {
  return {
    cursor: 0,
    phase: "find-key",
  };
}

/**
 * 현재까지 누적된 Provider JSON 문자열에서 아직 확인하지 않은 부분만 파싱하여,
 * 새롭게 완성된 answer 문자열 조각을 반환합니다.
 *
 * Provider delta는 JSON 문법이나 escape sequence 중간에서 끊길 수 있으므로,
 * 완성되지 않은 escape sequence는 cursor를 진행시키지 않고 다음 delta를 기다립니다.
 *
 * @param content 현재까지 누적된 Provider 원본 문자열
 * @param state 이전 delta까지의 parser 상태
 * @returns 이번 호출에서 새롭게 해석된 answer 문자열
 */
function extractStreamingAnswerDelta(
  content: string,
  state: StreamingAnswerParserState,
): string {
  let delta = "";

  while (state.cursor < content.length) {
    switch (state.phase) {
      case "find-key": {
        const answerKey = '"answer"';
        const answerKeyIndex = content.indexOf(answerKey, state.cursor);

        if (answerKeyIndex < 0) {
          /*
           * "answer" key 자체가 Provider delta 경계에서 잘릴 수 있으므로
           * key 길이보다 짧은 마지막 부분은 다음 delta에서 다시 확인합니다.
           */
          state.cursor = Math.max(
            state.cursor,
            content.length - (answerKey.length - 1),
          );

          return delta;
        }

        state.cursor = answerKeyIndex + answerKey.length;
        state.phase = "after-key";
        break;
      }

      case "after-key": {
        while (
          state.cursor < content.length &&
          /\s/.test(content[state.cursor] ?? "")
        ) {
          state.cursor += 1;
        }

        if (state.cursor >= content.length) {
          return delta;
        }

        if (content[state.cursor] !== ":") {
          return delta;
        }

        state.cursor += 1;
        state.phase = "after-colon";
        break;
      }

      case "after-colon": {
        while (
          state.cursor < content.length &&
          /\s/.test(content[state.cursor] ?? "")
        ) {
          state.cursor += 1;
        }

        if (state.cursor >= content.length) {
          return delta;
        }

        if (content[state.cursor] !== '"') {
          return delta;
        }

        state.cursor += 1;
        state.phase = "in-answer";
        break;
      }

      case "in-answer": {
        const character = content[state.cursor];

        if (character === '"') {
          state.cursor += 1;
          state.phase = "completed";
          return delta;
        }

        if (character !== "\\") {
          delta += character;
          state.cursor += 1;
          break;
        }

        /*
         * escape 시작 직후 delta가 끝났다면 cursor를 진행하지 않고
         * 다음 Provider delta가 도착할 때까지 기다립니다.
         */
        const escapedCharacter = content[state.cursor + 1];

        if (escapedCharacter === undefined) {
          return delta;
        }

        switch (escapedCharacter) {
          case '"':
            delta += '"';
            state.cursor += 2;
            break;

          case "\\":
            delta += "\\";
            state.cursor += 2;
            break;

          case "/":
            delta += "/";
            state.cursor += 2;
            break;

          case "b":
            delta += "\b";
            state.cursor += 2;
            break;

          case "f":
            delta += "\f";
            state.cursor += 2;
            break;

          case "n":
            delta += "\n";
            state.cursor += 2;
            break;

          case "r":
            delta += "\r";
            state.cursor += 2;
            break;

          case "t":
            delta += "\t";
            state.cursor += 2;
            break;

          case "u": {
            /*
             * \uXXXX가 Provider delta 경계에서 잘릴 수 있으므로
             * 4자리 hex가 모두 도착할 때까지 현재 cursor를 유지합니다.
             */
            if (state.cursor + 6 > content.length) {
              return delta;
            }

            const hexadecimal = content.slice(
              state.cursor + 2,
              state.cursor + 6,
            );

            if (!/^[0-9a-fA-F]{4}$/.test(hexadecimal)) {
              return delta;
            }

            delta += String.fromCharCode(Number.parseInt(hexadecimal, 16));
            state.cursor += 6;
            break;
          }

          default:
            /*
             * 최종 JSON 검증은 parseNoteChatProviderResponse가 담당합니다.
             * 스트리밍 중 잘못된 escape를 임의로 화면에 표시하지 않습니다.
             */
            return delta;
        }

        break;
      }

      case "completed":
        return delta;
    }
  }

  return delta;
}

/**
 * Provider Chat 스트림을 소비하면서 answer 텍스트만
 * 노트 챗봇 스트림 이벤트로 변환합니다.
 *
 * Provider 원본 응답은 구조화 JSON 전체를 누적하고,
 * 클라이언트에는 JSON의 `answer` 필드에서 새롭게 생성된 문자열만 전달합니다.
 *
 * 이미 파싱한 위치를 parser state에 유지하므로,
 * 매 delta마다 전체 누적 문자열을 처음부터 다시 파싱하지 않습니다.
 *
 * 이 함수는 DB 저장이나 Run 상태 변경을 수행하지 않습니다.
 *
 * @param providerStream AI Foundation이 반환한 Provider 공통 스트림
 * @param onTextDelta answer 텍스트 조각이 생성될 때 호출할 함수
 * @returns Provider 스트림의 최종 원본 결과
 */
export async function consumeNoteChatProviderStream(
  providerStream: AsyncGenerator<AiChatStreamEvent>,
  onTextDelta: (event: NoteChatStreamTextDeltaEvent) => void | Promise<void>,
): Promise<ConsumedNoteChatProviderStream> {
  let content = "";
  let result: AiChatStreamResult | null = null;

  const parserState = createStreamingAnswerParserState();

  for await (const event of providerStream) {
    switch (event.type) {
      case "text-delta": {
        content += event.delta;

        const delta = extractStreamingAnswerDelta(content, parserState);

        if (delta.length > 0) {
          await onTextDelta({
            delta,
            type: "text-delta",
          });
        }

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
   * Provider가 누적한 최종 원본 content와 실제로 전달받은 delta 합계가
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
