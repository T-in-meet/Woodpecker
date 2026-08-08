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
 * JSON 문자열 안의 `answer` 필드에서 현재까지 완전히 해석할 수 있는
 * 문자열 부분을 추출합니다.
 *
 * Provider delta는 JSON 문법이나 escape sequence 중간에서 끊길 수 있으므로,
 * 완성되지 않은 escape sequence는 다음 delta가 도착할 때까지 반환하지 않습니다.
 *
 * @param content 현재까지 누적된 Provider 원본 문자열
 * @returns 현재까지 안전하게 추출할 수 있는 answer 문자열
 */
function extractStreamingAnswer(content: string): string {
  const answerKeyIndex = content.indexOf('"answer"');

  if (answerKeyIndex < 0) {
    return "";
  }

  let cursor = answerKeyIndex + '"answer"'.length;

  /*
   * "answer" 뒤의 공백과 ':'을 건너뛰고
   * 실제 JSON 문자열의 시작 따옴표를 찾습니다.
   */
  while (cursor < content.length && /\s/.test(content[cursor] ?? "")) {
    cursor += 1;
  }

  if (content[cursor] !== ":") {
    return "";
  }

  cursor += 1;

  while (cursor < content.length && /\s/.test(content[cursor] ?? "")) {
    cursor += 1;
  }

  if (content[cursor] !== '"') {
    return "";
  }

  cursor += 1;

  let answer = "";

  while (cursor < content.length) {
    const character = content[cursor];

    if (character === '"') {
      /*
       * unescaped closing quote를 만났으므로 answer가 끝났습니다.
       */
      return answer;
    }

    if (character !== "\\") {
      answer += character;
      cursor += 1;
      continue;
    }

    /*
     * escape 시작 직후 delta가 끝났다면 아직 해석할 수 없으므로
     * 다음 delta가 올 때까지 현재 answer만 반환합니다.
     */
    const escapedCharacter = content[cursor + 1];

    if (escapedCharacter === undefined) {
      return answer;
    }

    switch (escapedCharacter) {
      case '"':
        answer += '"';
        cursor += 2;
        break;

      case "\\":
        answer += "\\";
        cursor += 2;
        break;

      case "/":
        answer += "/";
        cursor += 2;
        break;

      case "b":
        answer += "\b";
        cursor += 2;
        break;

      case "f":
        answer += "\f";
        cursor += 2;
        break;

      case "n":
        answer += "\n";
        cursor += 2;
        break;

      case "r":
        answer += "\r";
        cursor += 2;
        break;

      case "t":
        answer += "\t";
        cursor += 2;
        break;

      case "u": {
        /*
         * \uXXXX가 하나의 Provider delta 경계에서 잘릴 수 있으므로
         * 4자리 hex가 모두 도착한 경우에만 문자를 반환합니다.
         */
        const hexadecimal = content.slice(cursor + 2, cursor + 6);

        if (hexadecimal.length < 4) {
          return answer;
        }

        if (!/^[0-9a-fA-F]{4}$/.test(hexadecimal)) {
          return answer;
        }

        answer += String.fromCharCode(Number.parseInt(hexadecimal, 16));
        cursor += 6;
        break;
      }

      default:
        /*
         * 최종 JSON 검증은 parseNoteChatProviderResponse가 담당합니다.
         * 스트리밍 중 잘못된 escape를 임의로 화면에 표시하지 않습니다.
         */
        return answer;
    }
  }

  return answer;
}

/**
 * Provider Chat 스트림을 소비하면서 answer 텍스트만
 * 노트 챗봇 스트림 이벤트로 변환합니다.
 *
 * Provider 원본 응답은 구조화 JSON 전체를 누적하고,
 * 클라이언트에는 JSON의 `answer` 필드에서 새롭게 생성된 문자열만 전달합니다.
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
  let emittedAnswer = "";
  let result: AiChatStreamResult | null = null;

  for await (const event of providerStream) {
    switch (event.type) {
      case "text-delta": {
        content += event.delta;

        const currentAnswer = extractStreamingAnswer(content);

        /*
         * 매 delta마다 전체 누적 응답에서 현재 answer를 다시 추출한 뒤,
         * 아직 클라이언트에 보내지 않은 부분만 전달합니다.
         */
        if (currentAnswer.length > emittedAnswer.length) {
          const delta = currentAnswer.slice(emittedAnswer.length);

          emittedAnswer = currentAnswer;

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
