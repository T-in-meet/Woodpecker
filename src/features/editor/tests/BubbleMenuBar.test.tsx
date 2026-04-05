import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BubbleMenuBar } from "../components/BubbleMenuBar";

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
) {
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "run") return vi.fn(() => true);

        return () => chain;
      },
    },
  );

  return {
    chain: () => chain,
    can: () => ({
      undo: () => overrides.canUndo ?? true,
      redo: () => overrides.canRedo ?? true,
    }),
    getAttributes: vi.fn((type: string) => {
      if (type === "link") {
        return { href: "https://example.com" };
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
  } as never;
}

describe("BubbleMenuBar", () => {
  it("renders the merged formatting and block controls", () => {
    render(<BubbleMenuBar editor={createMockEditor()} />);

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
    expect(screen.getByTestId("toolbar-add-link")).toBeInTheDocument();
  });

  it("shows table controls when a table is active", () => {
    render(<BubbleMenuBar editor={createMockEditor({ tableActive: true })} />);

    expect(screen.getByTestId("toolbar-add-column")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-column")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-add-row")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-row")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-delete-table")).toBeInTheDocument();
  });

  it("hides table controls when no table is active", () => {
    render(<BubbleMenuBar editor={createMockEditor()} />);

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
    render(<BubbleMenuBar editor={createMockEditor({ linkActive: true })} />);

    expect(screen.getByTestId("toolbar-edit-link")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-remove-link")).toBeInTheDocument();
    expect(screen.queryByTestId("toolbar-add-link")).not.toBeInTheDocument();
  });

  it("opens the link editor popover when the link button is clicked", async () => {
    const user = userEvent.setup();

    render(<BubbleMenuBar editor={createMockEditor()} />);

    await user.click(screen.getByTestId("toolbar-add-link"));

    expect(screen.getByPlaceholderText("https://...")).toBeInTheDocument();
  });

  it("shows a code language selector when a code block is active", () => {
    render(
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
});
