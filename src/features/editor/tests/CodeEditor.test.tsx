import "./setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CodeEditor } from "../components/CodeEditor";

function getEditorContentElement() {
  const contentElement = document.querySelector(".cm-content");

  if (!(contentElement instanceof HTMLElement)) {
    throw new Error("editor content element not found");
  }

  return contentElement;
}

describe("CodeEditor", () => {
  it("applies the aria-label to the editor textbox", async () => {
    render(
      <CodeEditor
        value=""
        onChange={vi.fn()}
        language="javascript"
        aria-label="코드 편집기"
      />,
    );

    expect(
      await screen.findByRole("textbox", { name: "코드 편집기" }),
    ).toBeInTheDocument();
  });

  it("emits onChange when the user types into the editor", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CodeEditor value="" onChange={handleChange} language="javascript" />,
    );

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.keyboard("const value = 1;");

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
      expect(contentElement.textContent).toContain("const value = 1;");
    });
  });

  it("does not emit onChange when the value prop is synced from outside", async () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <CodeEditor
        value="const initialValue = 1;"
        onChange={handleChange}
        language="javascript"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    handleChange.mockClear();

    rerender(
      <CodeEditor
        value="const updatedValue = 2;"
        onChange={handleChange}
        language="javascript"
      />,
    );

    await waitFor(() => {
      const content = document.querySelector(".cm-content")?.textContent;
      expect(content).toContain("const updatedValue = 2;");
    });

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("keeps the current document when the language prop changes", async () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <CodeEditor
        value="const value = 1;"
        onChange={handleChange}
        language="javascript"
      />,
    );

    await waitFor(() => {
      const content = document.querySelector(".cm-content")?.textContent;
      expect(content).toContain("const value = 1;");
    });

    handleChange.mockClear();

    rerender(
      <CodeEditor
        value="const value = 1;"
        onChange={handleChange}
        language="typescript"
      />,
    );

    await waitFor(() => {
      const content = document.querySelector(".cm-content")?.textContent;
      expect(content).toContain("const value = 1;");
    });

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("updates the editor document when text is replaced in the middle", async () => {
    const { rerender } = render(
      <CodeEditor
        value="const alpha = 1;"
        onChange={vi.fn()}
        language="javascript"
      />,
    );

    await waitFor(() => {
      expect(getEditorContentElement().textContent).toContain(
        "const alpha = 1;",
      );
    });

    rerender(
      <CodeEditor
        value="const beta = 1;"
        onChange={vi.fn()}
        language="javascript"
      />,
    );

    await waitFor(() => {
      expect(getEditorContentElement().textContent).toContain(
        "const beta = 1;",
      );
    });
  });
});
