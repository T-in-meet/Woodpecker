import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";

/**
 * 노트 챗봇 Prompt에 전달할 Note Context 생성 입력입니다.
 */
type BuildNoteChatContextParams = {
  /** Embedding 검색 결과와 결합된 실제 노트 목록입니다. */
  notes: MatchedNote[];
};

/**
 * 검색된 노트 목록을 LLM Prompt에 전달할 Context 문자열로 변환합니다.
 *
 * 검색 결과 순서를 그대로 유지하며,
 * 각 노트의 제목과 본문을 구분 가능한 형태로 직렬화합니다.
 *
 * similarity와 distance는 검색 및 디버깅 용도의 메타데이터이므로
 * LLM Context 본문에는 포함하지 않습니다.
 *
 * @param params 검색된 노트 목록
 * @returns Prompt에 전달할 Note Context 문자열
 */
export function buildNoteChatContext({
  notes,
}: BuildNoteChatContextParams): string {
  if (notes.length === 0) {
    return "";
  }

  return notes
    .map((note, index) =>
      [
        `<note index="${index + 1}">`,
        `<title>${note.title}</title>`,
        "<content>",
        note.content,
        "</content>",
        "</note>",
      ].join("\n"),
    )
    .join("\n\n");
}
