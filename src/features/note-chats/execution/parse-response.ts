import { z } from "zod";

/**
 * 노트 챗봇 LLM이 반환해야 하는 최종 응답 구조입니다.
 *
 * `usedContextIndexes`는 Prompt Context에서 실제 답변 생성에 사용한
 * 노트의 1부터 시작하는 index 목록입니다.
 *
 * 실제 Note ID 변환은 이 응답을 파싱한 이후 sources와 매핑하는
 * 실행 계층에서 수행합니다.
 */
export const noteChatProviderResponseSchema = z.object({
  answer: z.string().trim().min(1),
  usedContextIndexes: z.array(z.number().int().positive()),
});

export type NoteChatProviderResponse = z.infer<
  typeof noteChatProviderResponseSchema
>;

/**
 * Provider가 생성한 최종 문자열을 노트 챗봇 응답으로 변환합니다.
 *
 * Provider 응답은 Prompt 계약에 따라 JSON 문자열이어야 합니다.
 *
 * @param content Provider가 생성한 전체 응답 문자열
 * @returns 검증된 답변과 실제 사용한 Context index 목록
 */
export function parseNoteChatProviderResponse(
  content: string,
): NoteChatProviderResponse {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Note chat provider response is not valid JSON.");
  }

  const result = noteChatProviderResponseSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error("Note chat provider response has an invalid structure.");
  }

  return {
    answer: result.data.answer,
    usedContextIndexes: [...new Set(result.data.usedContextIndexes)],
  };
}
