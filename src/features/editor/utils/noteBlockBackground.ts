import type { Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";

import {
  normalizeNoteColorToken,
  type NoteColorTokenType,
} from "../noteColors";
import {
  buildNoteBlockBackgroundMarkup,
  NOTE_BLOCK_BACKGROUND_ATTRIBUTE,
  NOTE_BLOCK_BACKGROUND_PATTERN,
} from "./noteColorMarkdown";

// 노드 attribute 이름. DOM 속성(NOTE_BLOCK_BACKGROUND_ATTRIBUTE)과 짝을 이룬다.
export const NOTE_BLOCK_BACKGROUND_ATTRIBUTE_NAME = "noteBackground";

// 목록은 번호/불릿까지 함께 칠해져야 해서 안쪽 문단이 아니라 항목 전체를 대상으로 한다.
const CONTAINER_TYPE_NAMES = ["listItem", "taskItem"] as const;
const TEXT_BLOCK_TYPE_NAMES = ["paragraph", "heading"] as const;

export const NOTE_BLOCK_BACKGROUND_TYPE_NAMES = [
  ...TEXT_BLOCK_TYPE_NAMES,
  ...CONTAINER_TYPE_NAMES,
] as const;

const CONTAINER_TYPES = new Set<string>(CONTAINER_TYPE_NAMES);
const TEXT_BLOCK_TYPES = new Set<string>(TEXT_BLOCK_TYPE_NAMES);

const BLOCK_ELEMENT_SELECTOR = "p, h1, h2, h3, h4, h5, h6";
// tight list는 markdown-it이 <p> 없이 <li> 안에 텍스트를 바로 넣고,
// 체크박스 항목은 <input> 뒤에 텍스트가 온다.
const MARKER_HOST_SELECTOR = `${BLOCK_ELEMENT_SELECTOR}, li`;

export function getNoteBlockBackground(
  node: ProseMirrorNode,
): NoteColorTokenType | null {
  return normalizeNoteColorToken(
    node.attrs[NOTE_BLOCK_BACKGROUND_ATTRIBUTE_NAME],
  );
}

function prependBackgroundMarker(
  node: ProseMirrorNode,
  token: NoteColorTokenType,
): ProseMirrorNode {
  const markerText = node.type.schema.text(
    buildNoteBlockBackgroundMarkup(token),
  );

  if (node.isTextblock) {
    return node.copy(Fragment.from(markerText).append(node.content));
  }

  // 목록 항목처럼 컨테이너면 첫 블록 앞에 마커를 넣는다.
  const firstChild = node.firstChild;
  if (!firstChild) return node;

  return node.copy(
    node.content.replaceChild(0, prependBackgroundMarker(firstChild, token)),
  );
}

// 마크다운으로 내보내기 직전에 블록 배경 attribute를 본문 앞 마커 텍스트로 바꾼다.
// 이렇게 하면 제목의 "## "이나 목록의 "- " 뒤에 마커가 자연스럽게 놓여
// 노드별 직렬화기를 따로 손대지 않아도 된다.
export function withNoteBlockBackgroundMarkers(
  doc: ProseMirrorNode,
): ProseMirrorNode {
  const mapNode = (node: ProseMirrorNode): ProseMirrorNode => {
    if (node.isText) return node;

    const children: ProseMirrorNode[] = [];
    node.forEach((child) => children.push(mapNode(child)));

    const mapped = node.copy(Fragment.fromArray(children));
    const token = getNoteBlockBackground(mapped);

    return token ? prependBackgroundMarker(mapped, token) : mapped;
  };

  return mapNode(doc);
}

function resolveBackgroundTargetElement(block: Element): Element {
  const parent = block.parentElement;

  // 목록 항목의 첫 블록이면 항목(li) 전체에 배경을 준다.
  if (
    parent?.tagName === "LI" &&
    parent.querySelector(BLOCK_ELEMENT_SELECTOR) === block
  ) {
    return parent;
  }

  return block;
}

// 블록의 본문이 시작되는 텍스트 노드를 찾는다. 체크박스(input)나 공백은 건너뛰고,
// 실제 내용을 담은 요소가 먼저 나오면 마커가 없는 것으로 본다.
function findLeadingTextNode(block: Element): ChildNode | null {
  for (const child of Array.from(block.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if ((child.textContent ?? "").trim() === "") continue;

      return child;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (child instanceof HTMLInputElement) continue;

    return null;
  }

  return null;
}

// 마크다운을 파싱한 DOM에서 블록 맨 앞 마커를 찾아 배경 속성으로 끌어올린다.
export function hoistNoteBlockBackgroundMarkers(element: HTMLElement): void {
  for (const block of Array.from(
    element.querySelectorAll(MARKER_HOST_SELECTOR),
  )) {
    const textNode = findLeadingTextNode(block);

    if (!textNode) continue;

    const text = textNode.textContent ?? "";
    const match = NOTE_BLOCK_BACKGROUND_PATTERN.exec(text);

    if (!match) continue;

    const token = normalizeNoteColorToken(match[1]);
    if (!token) continue;

    textNode.textContent = text.slice(match[0].length);
    resolveBackgroundTargetElement(block).setAttribute(
      NOTE_BLOCK_BACKGROUND_ATTRIBUTE,
      token,
    );
  }
}

type BackgroundTargetType = {
  node: ProseMirrorNode;
  pos: number;
};

// 배경색을 적용할 블록을 고른다.
// nodesBetween은 선택 위치를 포함하는 조상까지 모두 훑기 때문에, 그대로 쓰면
// 중첩 목록에서 커서가 놓인 항목뿐 아니라 바깥 항목까지 칠해진다.
// 그래서 선택 영역에 온전히 들어온 블록만 대상으로 삼고,
// 그런 블록이 없으면(커서만 놓인 경우) 가장 안쪽 블록 하나만 고른다.
function resolveBackgroundTargets(editor: Editor): BackgroundTargetType[] {
  const { state } = editor;
  const { from, to } = state.selection;
  const candidates: BackgroundTargetType[] = [];

  state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (CONTAINER_TYPES.has(node.type.name)) {
      candidates.push({ node, pos });
      return true;
    }

    if (TEXT_BLOCK_TYPES.has(node.type.name)) {
      // 목록 항목 안의 문단은 항목 쪽에 배경이 걸리므로 건너뛴다.
      if (parent && CONTAINER_TYPES.has(parent.type.name)) return false;

      candidates.push({ node, pos });
    }

    return true;
  });

  const fullySelected = candidates.filter(
    ({ node, pos }) => pos >= from && pos + node.nodeSize <= to,
  );

  if (fullySelected.length > 0) return fullySelected;

  // nodesBetween은 바깥에서 안쪽 순으로 방문하므로 마지막 후보가 가장 안쪽이다.
  const innermost = candidates[candidates.length - 1];

  return innermost ? [innermost] : [];
}

export function applyNoteBlockBackground(
  editor: Editor,
  token: NoteColorTokenType | null,
): void {
  const targets = resolveBackgroundTargets(editor);

  if (targets.length > 0) {
    const tr = editor.state.tr;

    for (const { node, pos } of targets) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        [NOTE_BLOCK_BACKGROUND_ATTRIBUTE_NAME]: token,
      });
    }

    editor.view.dispatch(tr);
  }

  editor.commands.focus();
}

export function getSelectedNoteBlockBackground(
  editor: Editor,
): NoteColorTokenType | null {
  const [target] = resolveBackgroundTargets(editor);

  return target ? getNoteBlockBackground(target.node) : null;
}
