import type { Selection as ProseMirrorSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

// 블록 핸들은 포털을 통해 에디터 DOM 밖에 렌더링되므로 ProseMirror의 dragstart 핸들러가
// 실행되지 않는다. 드래그 중인 슬라이스를 view.dragging에 직접 넣어주면 드롭 위치 계산,
// 원본 삭제, dropcursor 표시는 ProseMirror가 그대로 처리한다.
export function startBlockDrag(
  editor: Editor,
  blockElement: HTMLElement,
  selection: ProseMirrorSelection,
  dataTransfer: DataTransfer,
): boolean {
  if (editor.isDestroyed) {
    return false;
  }

  const { view } = editor;

  // move 드롭은 드롭 시점의 selection을 지우므로, 드래그 대상 블록을 먼저 선택해 둔다.
  view.dispatch(view.state.tr.setSelection(selection));

  const { dom, text, slice } = view.serializeForClipboard(
    view.state.selection.content(),
  );

  dataTransfer.clearData();
  dataTransfer.setData("text/html", dom.innerHTML);
  dataTransfer.setData("text/plain", text);
  dataTransfer.effectAllowed = "copyMove";
  dataTransfer.setDragImage(blockElement, 0, 0);

  view.dragging = { slice, move: true };

  return true;
}

export function endBlockDrag(editor: Editor): void {
  if (editor.isDestroyed) {
    return;
  }

  editor.view.dragging = null;
}
