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

  node.descendants((child) => {
    if (!isUniform) return false;
    if (!child.isText) return true;
    // 공백만 있는 조각은 색 판단에서 제외한다.
    if ((child.text ?? "").trim() === "") return true;

    const mark = child.marks.find(
      (candidate) => candidate.type.name === NOTE_TEXT_COLOR_MARK_NAME,
    );
    const childToken = normalizeNoteColorToken(mark?.attrs.token);

    if (childToken === null) {
      isUniform = false;
      return false;
    }

    if (token === null) {
      token = childToken;
    } else if (token !== childToken) {
      isUniform = false;
      return false;
    }

    hasText = true;
    return true;
  });

  return isUniform && hasText ? token : null;
}
