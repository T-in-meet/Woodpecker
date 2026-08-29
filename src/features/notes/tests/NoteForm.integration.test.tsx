import "./setup";

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

const { createNoteActionMock } = vi.hoisted(() => ({
  createNoteActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  createNoteAction: createNoteActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { NoteForm } from "../components/NoteForm";

/**
 * 실제 애플리케이션과 동일하게 TooltipProvider가 적용된 상태로
 * NoteForm을 렌더링합니다.
 */
function renderNoteForm() {
  return render(
    <TooltipProvider>
      <NoteForm />
    </TooltipProvider>,
  );
}

function getHiddenContentInput(container: HTMLElement) {
  const hiddenContentInput = container.querySelector('input[name="content"]');

  if (!(hiddenContentInput instanceof HTMLInputElement)) {
    throw new Error("hidden content input not found");
  }

  return hiddenContentInput;
}

/**
 * ProseMirror은 jsdom에서 표준 키보드 이벤트를 통한 텍스트 입력을 지원하지 않으므로,
 * contenteditable에 직접 텍스트를 삽입한 뒤 input 이벤트를 발행하여
 * ProseMirror의 DOM 변경 감지를 트리거합니다.
 */
function typeIntoTipTap(text: string) {
  const editor = document.querySelector("[contenteditable]");

  if (!(editor instanceof HTMLElement)) {
    throw new Error("editor not found");
  }

  editor.focus();

  const paragraph = editor.querySelector("p");

  if (!paragraph) {
    throw new Error("paragraph not found");
  }

  paragraph.textContent = text;

  // ProseMirror은 MutationObserver를 사용해 DOM 변경을 감지합니다.
  // jsdom에서는 input 이벤트를 보내 변경 처리를 명시적으로 트리거합니다.
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("NoteForm editor integration", () => {
  beforeEach(() => {
    createNoteActionMock.mockReset();
    createNoteActionMock.mockResolvedValue(null);
  });

  it("syncs tiptap editor input into the hidden content field", async () => {
    const { container } = renderNoteForm();
    const hiddenContentInput = getHiddenContentInput(container);

    await waitFor(() => {
      expect(document.querySelector("[contenteditable]")).toBeTruthy();
    });
    expect(document.querySelector("[data-placeholder]")).toHaveAttribute(
      "data-placeholder",
      "학습할 내용을 입력하세요. /를 누르면 편집 메뉴가 열립니다.",
    );

    typeIntoTipTap("markdown body");

    await waitFor(() => {
      expect(hiddenContentInput.value).toBe("markdown body");
    });
  });
});
