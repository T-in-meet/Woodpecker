import "./setup";

import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createNoteActionMock } = vi.hoisted(() => ({
  createNoteActionMock: vi.fn(),
}));

vi.mock("@/features/notes/components/MarkdownPreview", () => ({
  MarkdownPreview: ({ content }: { content: string }) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
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

function getEditorContentElement() {
  const contentElement = document.querySelector(".cm-content");

  if (!(contentElement instanceof HTMLElement)) {
    throw new Error("editor content element not found");
  }

  return contentElement;
}

describe("NoteForm editor integration", () => {
  beforeEach(() => {
    createNoteActionMock.mockReset();
    createNoteActionMock.mockResolvedValue(null);
  });

  it("syncs markdown editor input into the hidden content field", async () => {
    const user = userEvent.setup();
    const { container } = render(<NoteForm />);
    const hiddenContentInput = getHiddenContentInput(container);

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.paste("markdown body");

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
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.paste("shared content");

    await waitFor(() => {
      expect(hiddenContentInput.value).toBe("shared content");
    });

    await user.selectOptions(languageSelect, "javascript");

    await waitFor(() => {
      expect(hiddenContentInput.value).toBe("shared content");
      expect(getEditorContentElement().textContent).toContain("shared content");
    });
  });
});
