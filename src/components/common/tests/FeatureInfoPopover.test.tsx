import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeatureInfoPopover } from "../FeatureInfoPopover";

const popoverState = vi.hoisted(() => ({
  onOpenChange: null as ((open: boolean) => void) | null,
  contentPosition: null as {
    align: "start" | "center" | "end" | undefined;
    alignOffset: number | undefined;
  } | null,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    onOpenChange,
  }: {
    children: ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => {
    popoverState.onOpenChange = onOpenChange ?? null;
    return children;
  },
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
  PopoverContent: ({
    align,
    alignOffset,
    children,
  }: {
    align?: "start" | "center" | "end";
    alignOffset?: number;
    children: ReactNode;
  }) => {
    popoverState.contentPosition = { align, alignOffset };
    return <div>{children}</div>;
  },
}));

function makeRect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right: left + width,
    top: 0,
    bottom: 24,
    width,
    height: 24,
    toJSON: () => ({}),
  };
}

describe("FeatureInfoPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    popoverState.onOpenChange = null;
    popoverState.contentPosition = null;
  });

  it("팝오버의 왼쪽 정렬 offset으로 dialog 중앙에 배치한다", () => {
    document.documentElement.style.fontSize = "16px";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });

    render(
      <div role="dialog">
        <FeatureInfoPopover centerOnScreen>안내</FeatureInfoPopover>
      </div>,
    );

    const dialog = screen.getByRole("dialog");
    const trigger = screen.getByRole("button", { name: "기능 안내 보기" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(
      makeRect(224, 576),
    );
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      makeRect(280, 24),
    );

    act(() => popoverState.onOpenChange?.(true));

    expect(popoverState.contentPosition).toEqual({
      align: "start",
      // dialog center(512) - content half width(144) - trigger left(280)
      alignOffset: 88,
    });
  });
});
