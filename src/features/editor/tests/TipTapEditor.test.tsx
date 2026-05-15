import "./setup";

import {
  act,
  render as rtlRender,
  type RenderOptions,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { TipTapEditor } from "../components/TipTapEditor";
import { SLASH_COMMAND_ITEMS } from "../utils/slashCommand";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={0}>{children}</TooltipProvider>;
}

function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

function getEditorContentElement() {
  const contentElement = document.querySelector("[contenteditable]");

  if (!(contentElement instanceof HTMLElement)) {
    throw new Error("editor content element not found");
  }

  return contentElement;
}

function findTextStartPosition(editor: Editor, text: string) {
  let position: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text?.includes(text)) {
      position = pos;
      return false;
    }

    return true;
  });

  if (position === null) {
    throw new Error(`text node not found: ${text}`);
  }

  return position;
}

type ClipboardDataMockType = {
  files: { length: number };
  getData: (type: string) => string;
  items: { length: number };
  types: string[];
};

function dispatchPaste(text: string) {
  const pasteEvent = new Event("paste", {
    bubbles: true,
    cancelable: true,
  });
  const clipboardData: ClipboardDataMockType = {
    files: { length: 0 },
    getData: (type: string) => (type === "text/plain" ? text : ""),
    items: { length: 0 },
    types: ["text/plain"],
  };

  Object.defineProperty(pasteEvent, "clipboardData", {
    value: clipboardData,
  });

  getEditorContentElement().dispatchEvent(pasteEvent);
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

  it("converts typed markdown checkbox markers into task items", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TipTapEditor value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.keyboard("- [[ ] first");

    const checkbox = await screen.findByRole("checkbox");

    expect(checkbox).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(handleChange).toHaveBeenLastCalledWith("- [ ] first");
  });

  it("converts typed checked markdown checkbox markers into task items", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TipTapEditor value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.keyboard("- [[x] done");

    const checkbox = await screen.findByRole("checkbox");

    expect(checkbox).toBeChecked();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(handleChange).toHaveBeenLastCalledWith("- [x] done");
  });

  it("preserves escaped task markers in the initial value prop", async () => {
    render(<TipTapEditor value={"- \\[ \\] literal"} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("[ ] literal")).toBeInTheDocument();
  });

  it("keeps escaped task markers escaped when the user edits literal text", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TipTapEditor value={"- \\[ \\] literal"} onChange={handleChange} />,
    );

    await waitFor(() => {
      expect(screen.getByText("[ ] literal")).toBeInTheDocument();
    });

    handleChange.mockClear();

    await user.click(getEditorContentElement());
    await user.keyboard("!");

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });

    const lastChange = handleChange.mock.lastCall?.[0] as string;
    expect(lastChange).toContain("\\[ \\] literal");
    expect(lastChange).not.toContain("- [ ] literal");
  });

  it("converts checkbox markers typed after an existing bullet item", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TipTapEditor value="" onChange={handleChange} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.keyboard("- first{Enter}[[ ] second");

    const checkbox = await screen.findByRole("checkbox");
    const lastChange = handleChange.mock.lastCall?.[0];

    expect(checkbox).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(lastChange).toContain("- [ ] second");
    expect(lastChange).not.toContain("\\[ \\]");
  });

  it("lifts the current bullet list item when Backspace is pressed at the start of the line", async () => {
    const handleChange = vi.fn();
    const handleEditorReady = vi.fn();

    render(
      <TipTapEditor
        value="- first item\n- second item"
        onChange={handleChange}
        onEditorReady={handleEditorReady}
      />,
    );

    await waitFor(() => {
      expect(handleEditorReady).toHaveBeenCalled();
    });

    const [editor] = handleEditorReady.mock.calls[0] as [Editor];

    await act(async () => {
      editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "first item" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "second item" }],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        "- first item\n- second item",
      );
    });

    handleChange.mockClear();

    const secondItemTextStart = findTextStartPosition(editor, "second item");

    await act(async () => {
      editor.commands.setTextSelection(secondItemTextStart);
      editor.commands.keyboardShortcut("Backspace");
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        "- first item\n\nsecond item",
      );
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
      expect(screen.getByLabelText("블록 도구 열기")).toBeInTheDocument();
    });
  });

  it("opens the toolbar from the block handle button", async () => {
    const user = userEvent.setup();

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());

    const handleButton = await screen.findByLabelText("블록 도구 열기");
    await user.click(handleButton);

    expect(screen.getByTestId("bubble-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-undo")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-bold")).toBeInTheDocument();
  });

  it("deletes the current block from the toolbar", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TipTapEditor value="Delete me" onChange={handleChange} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.click(await screen.findByLabelText("블록 도구 열기"));
    await user.click(screen.getByTestId("toolbar-delete-block"));

    await waitFor(() => {
      expect(getEditorContentElement().textContent).not.toContain("Delete me");
    });

    expect(handleChange).toHaveBeenCalled();
  });

  it("shows the language selector after turning the current block into a code block", async () => {
    const user = userEvent.setup();

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.click(await screen.findByLabelText("블록 도구 열기"));
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

    expect(screen.queryByLabelText("블록 도구 열기")).not.toBeInTheDocument();
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

  it("converts pasted markdown images with angle-bracket destinations", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TipTapEditor value="" onChange={handleChange} />);
    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());

    await act(async () => {
      dispatchPaste(
        "![Dog](<https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDBqBsYdSaYjDuQTnKzZG-M-IxDEf8vA0bgA&s>)",
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Dog" })).toBeInTheDocument();
    });

    expect(handleChange).toHaveBeenLastCalledWith(
      "![Dog](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDBqBsYdSaYjDuQTnKzZG-M-IxDEf8vA0bgA&s)",
    );
  });

  it("converts pasted markdown images with empty alt text", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TipTapEditor value="" onChange={handleChange} />);
    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());

    await act(async () => {
      dispatchPaste("![](https://example.com/empty-alt.png)");
    });

    await waitFor(() => {
      const image = document.querySelector(
        'img[src="https://example.com/empty-alt.png"]',
      );

      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("alt", "");
    });

    expect(handleChange).toHaveBeenLastCalledWith(
      "![](https://example.com/empty-alt.png)",
    );
  });

  it("shows the block handle when an image block is focused", async () => {
    const user = userEvent.setup();

    render(
      <TipTapEditor
        value="![Dog](https://example.com/diagram.png)"
        onChange={vi.fn()}
      />,
    );

    const image = await screen.findByRole("img", { name: "Dog" });
    await user.click(image);

    await waitFor(() => {
      expect(screen.getByLabelText("블록 도구 열기")).toBeInTheDocument();
    });
  });

  it("does not render the active block overlay when the block has no measurable rect", async () => {
    const user = userEvent.setup();

    render(<TipTapEditor value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(getEditorContentElement()).toBeTruthy();
    });

    await user.click(getEditorContentElement());
    await user.click(await screen.findByLabelText("블록 도구 열기"));

    expect(screen.getByTestId("bubble-toolbar")).toBeInTheDocument();
    expect(
      screen.queryByTestId("block-handle-overlay"),
    ).not.toBeInTheDocument();
  });

  it("renders the active block overlay when the handle opens the toolbar over a measurable block", async () => {
    const originalGetBoundingClientRect =
      Element.prototype.getBoundingClientRect;
    const measurableRect = {
      x: 10,
      y: 20,
      width: 240,
      height: 32,
      top: 20,
      right: 250,
      bottom: 52,
      left: 10,
      toJSON() {
        return this;
      },
    } as DOMRect;
    Element.prototype.getBoundingClientRect = function () {
      return measurableRect;
    };

    try {
      const user = userEvent.setup();
      render(<TipTapEditor value="hello" onChange={vi.fn()} />);

      await waitFor(() => {
        expect(getEditorContentElement()).toBeTruthy();
      });

      await user.click(getEditorContentElement());
      await user.click(await screen.findByLabelText("블록 도구 열기"));

      const overlay = await screen.findByTestId("block-handle-overlay");
      expect(overlay).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(
          screen.queryByTestId("block-handle-overlay"),
        ).not.toBeInTheDocument();
      });
    } finally {
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    }
  });
});
