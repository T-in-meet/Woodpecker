import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, type Mock, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { BubbleMenuBar } from "../components/BubbleMenuBar";

function renderWithTooltipProvider(ui: React.ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

type ChainMethodType = (...args: unknown[]) => void;
type ChainMethodMockType = Mock<ChainMethodType>;
type ChainRunnerMockType = Mock<() => boolean>;
type ChainMethodNameType = (typeof CHAIN_METHOD_NAMES)[number];
type ChainMethodsType = Record<ChainMethodNameType, ChainMethodMockType> & {
  run: ChainRunnerMockType;
};

type MockEditorType = Editor & {
  __chainMethods: ChainMethodsType;
};

const CHAIN_METHOD_NAMES = [
  "focus",
  "extendMarkRange",
  "setTextSelection",
  "undo",
  "redo",
  "toggleHeading",
  "toggleBold",
  "toggleItalic",
  "toggleStrike",
  "toggleCode",
  "toggleBulletList",
  "toggleOrderedList",
  "toggleTaskList",
  "toggleBlockquote",
  "toggleCodeBlock",
  "setHorizontalRule",
  "setLink",
  "unsetLink",
  "insertTable",
  "addColumnAfter",
  "deleteColumn",
  "addRowAfter",
  "deleteRow",
  "deleteTable",
  "updateAttributes",
] as const;

function createChainMethodMock(): ChainMethodMockType {
  return vi.fn<ChainMethodType>();
}

function createMockEditor(
  overrides: {
    activeTypes?: string[];
    canRedo?: boolean;
    canUndo?: boolean;
    codeBlockLanguage?: string | null;
    headingLevels?: number[];
    codeBlockActive?: boolean;
    linkActive?: boolean;
    tableActive?: boolean;
  } & Record<string, unknown> = {},
): MockEditorType {
  const run = vi.fn<() => boolean>(() => true);
  const chainMethods: ChainMethodsType = {
    focus: createChainMethodMock(),
    extendMarkRange: createChainMethodMock(),
    setTextSelection: createChainMethodMock(),
    undo: createChainMethodMock(),
    redo: createChainMethodMock(),
    toggleHeading: createChainMethodMock(),
    toggleBold: createChainMethodMock(),
    toggleItalic: createChainMethodMock(),
    toggleStrike: createChainMethodMock(),
    toggleCode: createChainMethodMock(),
    toggleBulletList: createChainMethodMock(),
    toggleOrderedList: createChainMethodMock(),
    toggleTaskList: createChainMethodMock(),
    toggleBlockquote: createChainMethodMock(),
    toggleCodeBlock: createChainMethodMock(),
    setHorizontalRule: createChainMethodMock(),
    setLink: createChainMethodMock(),
    unsetLink: createChainMethodMock(),
    insertTable: createChainMethodMock(),
    addColumnAfter: createChainMethodMock(),
    deleteColumn: createChainMethodMock(),
    addRowAfter: createChainMethodMock(),
    deleteRow: createChainMethodMock(),
    deleteTable: createChainMethodMock(),
    updateAttributes: createChainMethodMock(),
    run,
  };

  const chain: Record<string, unknown> = { run };
  for (const key of CHAIN_METHOD_NAMES) {
    chain[key] = (...args: unknown[]) => {
      chainMethods[key](...args);
      return chain;
    };
  }

  return {
    __chainMethods: chainMethods,
    chain: () => chain,
    can: () => ({
      undo: () => overrides.canUndo ?? true,
      redo: () => overrides.canRedo ?? true,
    }),
    getAttributes: vi.fn((type: string) => {
      if (type === "link") {
        // tiptap getAttributes는 mark가 없는 위치에선 빈 객체를 반환한다.
        return overrides.linkActive ? { href: "https://example.com" } : {};
      }

      if (type === "codeBlock") {
        return { language: overrides.codeBlockLanguage ?? null };
      }

      return {};
    }),
    isActive: vi.fn((type: string, attrs?: Record<string, unknown>) => {
      if (type === "link") return Boolean(overrides.linkActive);
      if (type === "table") return Boolean(overrides.tableActive);
      if (type === "codeBlock") return Boolean(overrides.codeBlockActive);

      if (type === "heading" && typeof attrs?.level === "number") {
        return overrides.headingLevels?.includes(attrs.level) ?? false;
      }

      return overrides.activeTypes?.includes(type) ?? false;
    }),
    isEditable: true,
    ...overrides,
  } as unknown as MockEditorType;
}

describe("BubbleMenuBar", () => {
  it("renders the merged formatting and block controls", () => {
    renderWithTooltipProvider(<BubbleMenuBar editor={createMockEditor()} />);

    expect(screen.getByTestId("bubble-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("bubble-toolbar-columns")).toBeInTheDocument();
    expect(
      screen.getByTestId("bubble-toolbar-column-primary"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("bubble-toolbar-column-secondary"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-undo")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-redo")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-heading-1")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-heading-2")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-heading-3")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-bold")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-italic")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-strike")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-inline-code")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-bullet-list")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-ordered-list")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-task-list")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-blockquote")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-code-block")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-divider")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-insert-table")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-block")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-add-link")).toBeInTheDocument();
  });

  it("shows table controls when a table is active", () => {
    renderWithTooltipProvider(
      <BubbleMenuBar editor={createMockEditor({ tableActive: true })} />,
    );

    expect(screen.getByTestId("toolbar-add-column")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-column")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-add-row")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-row")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-table")).toBeInTheDocument();
  });

  it("hides table controls when no table is active", () => {
    renderWithTooltipProvider(<BubbleMenuBar editor={createMockEditor()} />);

    expect(screen.queryByTestId("toolbar-add-column")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("toolbar-delete-column"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-add-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-delete-row")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("toolbar-delete-table"),
    ).not.toBeInTheDocument();
  });

  it("shows link edit and remove buttons when a link is active", () => {
    renderWithTooltipProvider(
      <BubbleMenuBar editor={createMockEditor({ linkActive: true })} />,
    );

    expect(screen.getByTestId("toolbar-edit-link")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-remove-link")).toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-add-link")).not.toBeInTheDocument();
  });

  it("opens the link editor popover when the link button is clicked", async () => {
    const user = userEvent.setup();

    renderWithTooltipProvider(<BubbleMenuBar editor={createMockEditor()} />);

    await user.click(screen.getByTestId("toolbar-add-link"));

    expect(screen.getByPlaceholderText("https://...")).toBeInTheDocument();
  });

  it("calls the block delete handler when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDeleteBlock = vi.fn();

    renderWithTooltipProvider(
      <BubbleMenuBar
        editor={createMockEditor()}
        onDeleteBlock={handleDeleteBlock}
      />,
    );

    await user.click(screen.getByTestId("toolbar-delete-block"));

    expect(handleDeleteBlock).toHaveBeenCalledTimes(1);
  });

  it("extends the active link range before updating the URL", async () => {
    const user = userEvent.setup();
    const editor = createMockEditor({ linkActive: true });

    renderWithTooltipProvider(<BubbleMenuBar editor={editor} />);

    await user.click(screen.getByTestId("toolbar-edit-link"));

    const input = screen.getByLabelText("링크 URL");
    await user.clear(input);
    await user.type(input, "https://updated.example");
    await user.keyboard("{Enter}");

    expect(editor.__chainMethods.extendMarkRange).toHaveBeenCalledWith("link");
    expect(editor.__chainMethods.setLink).toHaveBeenCalledWith({
      href: "https://updated.example",
    });
  });

  it("auto-selects the word at the caret before applying a link when nothing is selected", async () => {
    const user = userEvent.setup();
    // 가상의 ProseMirror 상태: "hello world" 단락에서 'r' 위치(parentOffset 7)에 캐럿
    const editor = createMockEditor({
      state: {
        selection: {
          empty: true,
          $from: {
            parent: { textContent: "hello world" },
            parentOffset: 7,
            start: () => 1,
          },
        },
      },
    });

    renderWithTooltipProvider(<BubbleMenuBar editor={editor} />);

    await user.click(screen.getByTestId("toolbar-add-link"));
    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "https://example.com");
    await user.keyboard("{Enter}");

    // "world"는 parent 내 6..11, blockStart 1 적용 시 절대 위치 7..12
    expect(editor.__chainMethods.setTextSelection).toHaveBeenCalledWith({
      from: 7,
      to: 12,
    });
    expect(editor.__chainMethods.setLink).toHaveBeenCalledWith({
      href: "https://example.com",
    });
  });

  it("does not call setTextSelection when the caret is not adjacent to a word", async () => {
    const user = userEvent.setup();
    // 빈 단락(공백 한 글자)에 캐럿이 있어 선택할 단어가 없는 경우
    const editor = createMockEditor({
      state: {
        selection: {
          empty: true,
          $from: {
            parent: { textContent: " " },
            parentOffset: 0,
            start: () => 1,
          },
        },
      },
    });

    renderWithTooltipProvider(<BubbleMenuBar editor={editor} />);

    await user.click(screen.getByTestId("toolbar-add-link"));
    const input = screen.getByLabelText("링크 URL");
    await user.type(input, "https://example.com");
    await user.keyboard("{Enter}");

    expect(editor.__chainMethods.setTextSelection).not.toHaveBeenCalled();
    expect(editor.__chainMethods.setLink).toHaveBeenCalledWith({
      href: "https://example.com",
    });
  });

  it("shows a code language selector when a code block is active", () => {
    renderWithTooltipProvider(
      <BubbleMenuBar
        editor={createMockEditor({
          codeBlockActive: true,
          codeBlockLanguage: "typescript",
        })}
      />,
    );

    expect(
      screen.getByTestId("toolbar-code-language-panel"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-code-language")).toHaveValue(
      "typescript",
    );
  });

  it("shows a Korean tooltip when a toolbar button is hovered", async () => {
    const user = userEvent.setup();

    renderWithTooltipProvider(<BubbleMenuBar editor={createMockEditor()} />);

    await user.hover(screen.getByTestId("toolbar-bold"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("굵게");
  });
});
