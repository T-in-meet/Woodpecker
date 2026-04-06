import "./setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TipTapEditor } from "../components/TipTapEditor";
import { SLASH_COMMAND_ITEMS } from "../utils/slashCommand";

function getEditorContentElement() {
  const contentElement = document.querySelector("[contenteditable]");

  if (!(contentElement instanceof HTMLElement)) {
    throw new Error("editor content element not found");
  }

  return contentElement;
}

describe("TipTapEditor", () => {
  it("applies the aria-label to the editor", async () => {
    render(
      <TipTapEditor value="" onChange={vi.fn()} aria-label="마크다운 편집기" />,
    );

    await waitFor(() => {
      expect(getEditorContentElement().getAttribute("aria-label")).toBe(
        "마크다운 편집기",
      );
    });
  });

  it("shows the placeholder text when the document is empty", async () => {
    render(
      <TipTapEditor
        value=""
        onChange={vi.fn()}
        placeholder="내용을 입력해주세요"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector("[data-placeholder]")).toBeInTheDocument();
    });
  });

  it("focuses the editor when autoFocus is enabled", async () => {
    render(<TipTapEditor value="" onChange={vi.fn()} autoFocus />);

    await waitFor(() => {
      const el = getEditorContentElement();
      expect(el).toBeTruthy();
      expect(
        document.activeElement === el || el.contains(document.activeElement),
      ).toBe(true);
    });
  });

  it("does not emit onChange when the value prop is synced from outside", async () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <TipTapEditor value="Initial content" onChange={handleChange} />,
    );

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    handleChange.mockClear();

    rerender(<TipTapEditor value="Updated content" onChange={handleChange} />);

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

    render(<TipTapEditor value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.keyboard("hello tiptap");

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });
  });

  it("shows the block handle after the current line is focused", async () => {
    const user = userEvent.setup();

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());

    await waitFor(() => {
      expect(screen.getByLabelText("Open block toolbar")).toBeInTheDocument();
    });
  });

  it("opens the toolbar from the block handle button", async () => {
    const user = userEvent.setup();

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());

    const handleButton = await screen.findByLabelText("Open block toolbar");
    await user.click(handleButton);

    expect(screen.getByTestId("bubble-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-undo")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-bold")).toBeInTheDocument();
  });

  it("shows the language selector after turning the current block into a code block", async () => {
    const user = userEvent.setup();

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.click(await screen.findByLabelText("Open block toolbar"));
    await user.click(screen.getByTestId("toolbar-code-block"));

    expect(
      await screen.findByTestId("toolbar-code-language"),
    ).toBeInTheDocument();
  });

  it("prevents edits while readOnly is enabled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TipTapEditor value="Locked content" onChange={handleChange} readOnly />,
    );

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    expect(contentElement.getAttribute("contenteditable")).toBe("false");

    await user.click(contentElement);
    await user.keyboard("!");

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("opens the slash command menu when '/' is typed in editable mode", async () => {
    const user = userEvent.setup();
    const firstSlashCommandItem = SLASH_COMMAND_ITEMS[0];

    if (!firstSlashCommandItem) {
      throw new Error("slash command items must not be empty");
    }

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    const contentElement = getEditorContentElement();
    await user.click(contentElement);
    await user.keyboard("/");

    expect(
      await screen.findByText(firstSlashCommandItem.title),
    ).toBeInTheDocument();
  });

  it("does not render editor toolbars in readOnly mode", async () => {
    render(<TipTapEditor value="Locked content" readOnly />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    expect(
      screen.queryByLabelText("Open block toolbar"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("bubble-toolbar")).not.toBeInTheDocument();
  });

  it("renders task checkboxes inside a non-editable editor in readOnly mode", async () => {
    render(<TipTapEditor value="- [ ] readonly task" readOnly />);

    await waitFor(() => {
      expect(document.querySelector("[contenteditable='false']")).toBeTruthy();
    });

    const checkbox = document.querySelector('input[type="checkbox"]');

    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeDisabled();
    expect(checkbox?.closest("[contenteditable='false']")).toBeTruthy();
  });

  it("uses readonly link behavior when readOnly is enabled", async () => {
    const handleEditorReady = vi.fn();

    render(
      <TipTapEditor
        value="[OpenAI](https://openai.com)"
        readOnly
        onEditorReady={handleEditorReady}
      />,
    );

    await waitFor(() => {
      expect(handleEditorReady).toHaveBeenCalled();
    });

    const [editor] = handleEditorReady.mock.calls[0] as [
      {
        extensionManager: {
          extensions: Array<{
            name: string;
            options?: Record<string, unknown>;
          }>;
        };
      },
    ];
    const linkExtension = editor.extensionManager.extensions.find(
      (extension) => extension.name === "link",
    );

    expect(linkExtension?.options?.openOnClick).toBe(true);
  });
});
