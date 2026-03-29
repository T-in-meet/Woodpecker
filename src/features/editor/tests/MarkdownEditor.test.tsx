import "./setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "../components/MarkdownEditor";

function getEditorContentElement() {
  const contentElement = document.querySelector(".cm-content");

  if (!(contentElement instanceof HTMLElement)) {
    throw new Error("editor content element not found");
  }

  return contentElement;
}

describe("MarkdownEditor", () => {
  it("applies the aria-label to the editor textbox", async () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        aria-label="마크다운 편집기"
      />,
    );

    expect(
      await screen.findByRole("textbox", { name: "마크다운 편집기" }),
    ).toBeInTheDocument();
  });

  it("shows the placeholder text when the document is empty", async () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        placeholder="내용을 입력해주세요"
      />,
    );

    expect(await screen.findByText("내용을 입력해주세요")).toBeInTheDocument();
  });

  it("focuses the editor when autoFocus is enabled", async () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} autoFocus />);

    await waitFor(() => {
      expect(document.activeElement?.closest(".cm-editor")).toBeTruthy();
    });
  });

  it("does not emit onChange when the value prop is synced from outside", async () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <MarkdownEditor value="Initial content" onChange={handleChange} />,
    );

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    handleChange.mockClear();

    rerender(
      <MarkdownEditor value="Updated content" onChange={handleChange} />,
    );

    await waitFor(() => {
      expect(getEditorContentElement().textContent).toContain(
        "Updated content",
      );
    });

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("emits onChange when the user types into the editor", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<MarkdownEditor value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.keyboard("hello markdown");

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
      expect(contentElement.textContent).toContain("hello markdown");
    });
  });

  it("inserts two spaces when Tab is pressed", async () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    contentElement.focus();
    fireEvent.keyDown(contentElement, { key: "Tab", code: "Tab" });

    await waitFor(() => {
      expect(contentElement.textContent).toBe("  ");
    });
  });

  it("prevents edits while readOnly is enabled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <MarkdownEditor
        value="Locked content"
        onChange={handleChange}
        readOnly
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.keyboard("!");

    await waitFor(() => {
      expect(contentElement.textContent).toContain("Locked content");
    });
    expect(contentElement.textContent).not.toContain("!");
    expect(handleChange).not.toHaveBeenCalled();
  });
});
