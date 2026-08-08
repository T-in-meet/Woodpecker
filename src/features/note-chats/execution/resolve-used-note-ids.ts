import { z } from "zod";

import type { Json } from "@/types/db.helpers";

const noteChatNoteSourceSchema = z.object({
  contextIndex: z.number().int().positive(),
  noteId: z.string().uuid(),
  type: z.literal("note"),
});

/**
 * LLM이 반환한 Context index 목록을 실제 Note ID 목록으로 변환합니다.
 *
 * LLM은 실제 Note UUID를 알지 못하고 Context의 1부터 시작하는 index만
 * 반환합니다. 이 함수는 Run에 보존할 Source 목록을 기준으로 해당 index를
 * 실제 Note ID로 변환합니다.
 *
 * LLM이 존재하지 않는 Context index를 반환하면 응답 계약 위반으로 간주하여
 * 실행을 중단합니다.
 *
 * @param usedContextIndexes LLM이 실제 답변 생성에 사용했다고 반환한 Context index
 * @param sources 이번 실행에서 LLM에 제공한 Context Source 목록
 * @returns 실제 답변 생성에 사용된 Note ID 목록
 */
export function resolveNoteChatUsedNoteIds(
  usedContextIndexes: number[],
  sources: Json[],
): string[] {
  const parsedSources = sources.map((source) =>
    noteChatNoteSourceSchema.parse(source),
  );

  const noteIdByContextIndex = new Map(
    parsedSources.map((source) => [source.contextIndex, source.noteId]),
  );

  return usedContextIndexes.map((contextIndex) => {
    const noteId = noteIdByContextIndex.get(contextIndex);

    if (!noteId) {
      throw new Error(
        `Note chat used context index not found: ${contextIndex}`,
      );
    }

    return noteId;
  });
}
