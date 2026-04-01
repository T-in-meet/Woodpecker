import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FixedToolbar } from "../components/FixedToolbar";

function createMockEditor(overrides: Record<string, unknown> = {}) {
  const chainMethods: Record<string, () => typeof chain> = {};
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
      undo: () => true,
      redo: () => true,
    }),
    isActive: vi.fn((type: string) => {
      if (type === "table" && overrides.tableActive) return true;
      return false;
    }),
    getAttributes: vi.fn(() => ({ href: "" })),
    ...chainMethods,
    ...overrides,
  } as never;
}

describe("FixedToolbar", () => {
  it("renders undo and redo buttons", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("실행 취소")).toBeInTheDocument();
    expect(screen.getByLabelText("다시 실행")).toBeInTheDocument();
  });

  it("renders heading buttons", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("제목 1")).toBeInTheDocument();
    expect(screen.getByLabelText("제목 2")).toBeInTheDocument();
    expect(screen.getByLabelText("제목 3")).toBeInTheDocument();
  });

  it("renders inline formatting buttons", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("굵게")).toBeInTheDocument();
    expect(screen.getByLabelText("기울임")).toBeInTheDocument();
    expect(screen.getByLabelText("취소선")).toBeInTheDocument();
    expect(screen.getByLabelText("인라인 코드")).toBeInTheDocument();
  });

  it("renders list buttons", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("글머리 기호 목록")).toBeInTheDocument();
    expect(screen.getByLabelText("번호 목록")).toBeInTheDocument();
    expect(screen.getByLabelText("체크리스트")).toBeInTheDocument();
  });

  it("renders block element buttons", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("인용문")).toBeInTheDocument();
    expect(screen.getByLabelText("코드 블록")).toBeInTheDocument();
    expect(screen.getByLabelText("구분선")).toBeInTheDocument();
  });

  it("renders table insert button", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("표 삽입")).toBeInTheDocument();
  });

  it("shows table manipulation buttons when table is active", () => {
    render(<FixedToolbar editor={createMockEditor({ tableActive: true })} />);

    expect(screen.getByLabelText("오른쪽에 열 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("열 삭제")).toBeInTheDocument();
    expect(screen.getByLabelText("아래에 행 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("행 삭제")).toBeInTheDocument();
    expect(screen.getByLabelText("표 삭제")).toBeInTheDocument();
  });

  it("hides table manipulation buttons when table is not active", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.queryByLabelText("오른쪽에 열 추가")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("표 삭제")).not.toBeInTheDocument();
  });

  it("renders link add button", () => {
    render(<FixedToolbar editor={createMockEditor()} />);

    expect(screen.getByLabelText("링크 추가")).toBeInTheDocument();
  });

  it("shows link edit popover when link button is clicked", async () => {
    const user = userEvent.setup();

    render(<FixedToolbar editor={createMockEditor()} />);

    await user.click(screen.getByLabelText("링크 추가"));

    expect(screen.getByLabelText("링크 URL")).toBeInTheDocument();
  });
});
