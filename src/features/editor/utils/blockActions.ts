import { type EditorState, NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

export type BlockMoveDirectionType = "up" | "down";

const LIST_ITEM_TYPE_NAMES = ["listItem", "taskItem"] as const;

type BlockLocationType = {
  from: number;
  to: number;
  index: number;
  siblingCount: number;
};

function isListItemTypeName(typeName: string): boolean {
  return LIST_ITEM_TYPE_NAMES.some((itemName) => itemName === typeName);
}

// 목록 항목 안에서는 구분선을 항목 자리에 넣을 수 없다(`li` 스키마가 허용하지 않음).
// 대신 그 항목이 끝나는 위치를 돌려주면 ProseMirror가 목록을 갈라서 사이에 끼워 넣는다.
function getListItemBoundaryPosition(state: EditorState): number | null {
  const { selection } = state;

  // 블록 도구는 대상 블록에 NodeSelection을 걸어둔다.
  if (
    selection instanceof NodeSelection &&
    isListItemTypeName(selection.node.type.name)
  ) {
    return selection.from + selection.node.nodeSize;
  }

  // 슬래시 명령처럼 항목 안에 커서만 있는 경우.
  const { $from } = selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (isListItemTypeName($from.node(depth).type.name)) {
      return $from.after(depth);
    }
  }

  return null;
}

export function insertHorizontalRule(editor: Editor): boolean {
  const insertPosition = getListItemBoundaryPosition(editor.state);

  if (insertPosition === null) {
    return editor.chain().focus().setHorizontalRule().run();
  }

  return editor
    .chain()
    .focus()
    .insertContentAt(insertPosition, { type: "horizontalRule" })
    .run();
}

// 블록 도구는 열릴 때 NodeSelection을 설정하므로, 이동 대상은 DOM이 아니라
// 현재 selection에서 찾는다.
function getSelectedBlockLocation(editor: Editor): BlockLocationType | null {
  const { selection, doc } = editor.state;

  if (!(selection instanceof NodeSelection)) {
    return null;
  }

  const resolvedBlock = doc.resolve(selection.from);

  return {
    from: selection.from,
    to: selection.from + selection.node.nodeSize,
    index: resolvedBlock.index(),
    siblingCount: resolvedBlock.parent.childCount,
  };
}

export function canMoveSelectedBlock(
  editor: Editor,
  direction: BlockMoveDirectionType,
): boolean {
  const location = getSelectedBlockLocation(editor);

  if (!location) {
    return false;
  }

  return direction === "up"
    ? location.index > 0
    : location.index < location.siblingCount - 1;
}

export function moveSelectedBlock(
  editor: Editor,
  direction: BlockMoveDirectionType,
): boolean {
  const location = getSelectedBlockLocation(editor);

  if (!location || !canMoveSelectedBlock(editor, direction)) {
    return false;
  }

  const { view } = editor;
  const { state } = view;
  const blockNode = state.doc.nodeAt(location.from);

  if (!blockNode) {
    return false;
  }

  const resolvedBlock = state.doc.resolve(location.from);
  const siblingIndex =
    direction === "up" ? location.index - 1 : location.index + 1;
  // 위로 옮길 때는 이전 형제 앞, 아래로 옮길 때는 다음 형제 뒤가 삽입 위치다.
  const insertPosition =
    direction === "up"
      ? resolvedBlock.posAtIndex(siblingIndex)
      : resolvedBlock.posAtIndex(siblingIndex + 1);

  const tr = state.tr.delete(location.from, location.to);
  const mappedInsertPosition = tr.mapping.map(insertPosition);

  tr.insert(mappedInsertPosition, blockNode);

  const movedNode = tr.doc.nodeAt(mappedInsertPosition);

  if (movedNode && NodeSelection.isSelectable(movedNode)) {
    tr.setSelection(NodeSelection.create(tr.doc, mappedInsertPosition));
  }

  view.dispatch(tr);

  return true;
}
