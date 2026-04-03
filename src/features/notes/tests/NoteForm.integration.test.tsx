import "./setup";

import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createNoteActionMock } = vi.hoisted(() => ({
  createNoteActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  createNoteAction: createNoteActionMock,
}));

import { NoteForm } from "../components/NoteForm";

function getHiddenContentInput(container: HTMLElement) {
  const hiddenContentInput = container.querySelector('input[name="content"]');

  if (!(hiddenContentInput instanceof HTMLInputElement)) {
    throw new Error("hidden content input not found");
  }

  return hiddenContentInput;
}

/**
 * ProseMirror은 jsdom에서 표준 키보드 이벤트를 통한 텍스트 입력을 지원하지 않으므로,
 * contenteditable에 직접 텍스트를 삽입한 뒤 input 이벤트를 발행하여 ProseMirror의 DOM 변경 감지를 트리거한다.
 */
function typeIntoTipTap(text: string) {
  const el = document.querySelector("[contenteditable]");
  if (!(el instanceof HTMLElement)) throw new Error("editor not found");

  el.focus();

  const p = el.querySelector("p");
  if (!p) throw new Error("paragraph not found");

  p.textContent = text;

  // ProseMirror은 MutationObserver를 사용해 DOM 변경을 감지한다.
  // jsdom에서는 flush가 자동으로 일어나므로 input 이벤트를 보내 확실하게 처리한다.
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("NoteForm editor integration", () => {
  beforeEach(() => {
    createNoteActionMock.mockReset();
    createNoteActionMock.mockResolvedValue(null);
  });

  it("syncs tiptap editor input into the hidden content field", async () => {
    const { container } = render(<NoteForm />);
    const hiddenContentInput = getHiddenContentInput(container);

    await waitFor(() => {
      expect(document.querySelector("[contenteditable]")).toBeTruthy();
    });

    typeIntoTipTap("markdown body");

    await waitFor(() => {
      expect(hiddenContentInput.value).toBe("markdown body");
    });
  });

  it("preserves the hidden content field when switching from markdown to code", async () => {
    const user = userEvent.setup();
    const { container } = render(<NoteForm />);
    const hiddenContentInput = getHiddenContentInput(container);
    const languageSelect = container.querySelector("select[name='language']");

    if (!(languageSelect instanceof HTMLSelectElement)) {
      throw new Error("language select not found");
    }

    await waitFor(() => {
      expect(document.querySelector("[contenteditable]")).toBeTruthy();
    });

    typeIntoTipTap("shared content");

    await waitFor(() => {
      expect(hiddenContentInput.value).toBe("shared content");
    });

    await user.selectOptions(languageSelect, "javascript");

    await waitFor(() => {
      expect(hiddenContentInput.value).toBe("shared content");
    });
  });
});
