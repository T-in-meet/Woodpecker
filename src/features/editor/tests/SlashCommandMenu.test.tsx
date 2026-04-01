import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  SlashCommandMenu,
  type SlashCommandMenuRef,
} from "../components/SlashCommandMenu";
import {
  SLASH_COMMAND_ITEMS,
  type SlashCommandItem,
} from "../utils/slashCommand";

const MOCK_ITEMS: SlashCommandItem[] = [
  {
    title: "제목 1",
    description: "큰 제목",
    icon: "heading-1",
    command: vi.fn(),
  },
  {
    title: "글머리 기호 목록",
    description: "순서 없는 목록",
    icon: "list",
    command: vi.fn(),
  },
  {
    title: "코드 블록",
    description: "코드 작성 영역",
    icon: "code",
    command: vi.fn(),
  },
];

function makeSuggestionKeyDownProps(key: string): SuggestionKeyDownProps {
  return {
    event: new KeyboardEvent("keydown", { key }),
    range: { from: 0, to: 0 },
    view: {} as SuggestionKeyDownProps["view"],
  };
}

describe("SlashCommandMenu", () => {
  it("renders all items", () => {
    render(<SlashCommandMenu items={MOCK_ITEMS} command={vi.fn()} />);

    expect(screen.getByText("제목 1")).toBeInTheDocument();
    expect(screen.getByText("글머리 기호 목록")).toBeInTheDocument();
    expect(screen.getByText("코드 블록")).toBeInTheDocument();
  });

  it("renders '결과 없음' when items is empty", () => {
    render(<SlashCommandMenu items={[]} command={vi.fn()} />);

    expect(screen.getByText("결과 없음")).toBeInTheDocument();
  });

  it("calls command when an item is clicked", async () => {
    const user = userEvent.setup();
    const command = vi.fn();

    render(<SlashCommandMenu items={MOCK_ITEMS} command={command} />);

    await user.click(screen.getByText("코드 블록"));

    expect(command).toHaveBeenCalledWith(MOCK_ITEMS[2]);
  });

  it("navigates selection with ArrowDown via onKeyDown", () => {
    const ref = createRef<SlashCommandMenuRef>();
    const command = vi.fn();

    render(<SlashCommandMenu ref={ref} items={MOCK_ITEMS} command={command} />);

    const handled = ref.current!.onKeyDown(
      makeSuggestionKeyDownProps("ArrowDown"),
    );
    expect(handled).toBe(true);
  });

  it("navigates selection with ArrowUp via onKeyDown", () => {
    const ref = createRef<SlashCommandMenuRef>();

    render(<SlashCommandMenu ref={ref} items={MOCK_ITEMS} command={vi.fn()} />);

    const handled = ref.current!.onKeyDown(
      makeSuggestionKeyDownProps("ArrowUp"),
    );
    expect(handled).toBe(true);
  });

  it("executes command on Enter via onKeyDown", () => {
    const ref = createRef<SlashCommandMenuRef>();
    const command = vi.fn();

    render(<SlashCommandMenu ref={ref} items={MOCK_ITEMS} command={command} />);

    ref.current!.onKeyDown(makeSuggestionKeyDownProps("Enter"));

    expect(command).toHaveBeenCalledWith(MOCK_ITEMS[0]);
  });

  it("returns false for unhandled keys", () => {
    const ref = createRef<SlashCommandMenuRef>();

    render(<SlashCommandMenu ref={ref} items={MOCK_ITEMS} command={vi.fn()} />);

    const handled = ref.current!.onKeyDown(makeSuggestionKeyDownProps("Tab"));
    expect(handled).toBe(false);
  });
});

describe("SLASH_COMMAND_ITEMS filtering", () => {
  function filterItems(query: string): SlashCommandItem[] {
    return SLASH_COMMAND_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()),
    );
  }

  it("returns all items for empty query", () => {
    expect(filterItems("")).toHaveLength(SLASH_COMMAND_ITEMS.length);
  });

  it("filters by title", () => {
    const results = filterItems("제목");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((r) => r.title.includes("제목"))).toBe(true);
  });

  it("filters by description", () => {
    const results = filterItems("코드");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for non-matching query", () => {
    expect(filterItems("zzz_no_match")).toHaveLength(0);
  });

  it("is case-insensitive for ASCII queries", () => {
    const lower = filterItems("table");
    const upper = filterItems("TABLE");
    expect(lower).toEqual(upper);
  });
});
