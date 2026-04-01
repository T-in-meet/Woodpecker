import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BubbleMenuBar } from "../components/BubbleMenuBar";

vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bubble-menu">{children}</div>
  ),
}));

function createMockEditor(overrides: Record<string, unknown> = {}) {
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
    isActive: vi.fn((type: string) => {
      if (type === "link" && overrides.linkActive) return true;
      return false;
    }),
    getAttributes: vi.fn(() => ({ href: "https://example.com" })),
    ...overrides,
  } as never;
}

describe("BubbleMenuBar", () => {
  it("renders inline formatting buttons", () => {
    render(<BubbleMenuBar editor={createMockEditor()} />);

    expect(screen.getByLabelText("굵게")).toBeInTheDocument();
    expect(screen.getByLabelText("기울임")).toBeInTheDocument();
    expect(screen.getByLabelText("취소선")).toBeInTheDocument();
    expect(screen.getByLabelText("인라인 코드")).toBeInTheDocument();
  });

  it("shows link add button when no link is active", () => {
    render(<BubbleMenuBar editor={createMockEditor()} />);

    expect(screen.getByLabelText("링크 추가")).toBeInTheDocument();
    expect(screen.queryByLabelText("링크 편집")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("링크 제거")).not.toBeInTheDocument();
  });

  it("shows link edit and remove buttons when a link is active", () => {
    render(<BubbleMenuBar editor={createMockEditor({ linkActive: true })} />);

    expect(screen.getByLabelText("링크 편집")).toBeInTheDocument();
    expect(screen.getByLabelText("링크 제거")).toBeInTheDocument();
    expect(screen.queryByLabelText("링크 추가")).not.toBeInTheDocument();
  });
});
