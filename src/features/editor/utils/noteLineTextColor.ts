import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import {
  normalizeNoteColorToken,
  type NoteColorTokenType,
} from "../noteColors";
import { NOTE_TEXT_COLOR_MARK_NAME } from "./noteColorMarkdown";

// 목록 마커(1. / a. / •)는 항목의 color를 따르므로, 본문 텍스트에 걸린 인라인 마크만으로는
// 색이 입혀지지 않는다. 항목 전체가 한 색일 때만 항목 자체를 물들여 줄 전체를 같은 색으로 만든다.
export const NOTE_LINE_COLOR_TYPE_NAMES = ["listItem", "taskItem"] as const;

export function getUniformNoteTextColor(
  node: ProseMirrorNode,
): NoteColorTokenType | null {
  let token: NoteColorTokenType | null = null;
  let hasText = false;
  let isUniform = true;

  // 중첩 목록은 그 자체가 별도의 줄이므로 판단에서 제외한다.
  // 자식 항목의 색 때문에 바깥 항목의 마커 색이 풀리면 안 된다.
  node.forEach((child) => {
    if (!isUniform) return;
    if (!child.isTextblock) return;

    child.forEach((inline) => {
      if (!isUniform) return;
      if (!inline.isText) return;
      // 공백만 있는 조각은 색 판단에서 제외한다.
      if ((inline.text ?? "").trim() === "") return;

      const mark = inline.marks.find(
        (candidate) => candidate.type.name === NOTE_TEXT_COLOR_MARK_NAME,
      );
      const inlineToken = normalizeNoteColorToken(mark?.attrs.token);

      if (inlineToken === null) {
        isUniform = false;
        return;
      }

      if (token === null) {
        token = inlineToken;
      } else if (token !== inlineToken) {
        isUniform = false;
        return;
      }

      hasText = true;
    });
  });

  return isUniform && hasText ? token : null;
}
