import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";

/**
 * 테스트에서 사용하는 Assistant 응답 본문입니다.
 */
const ASSISTANT_MESSAGE_CONTENT = "요약된 AI 응답입니다.";

/**
 * 기존 navigator.clipboard property descriptor입니다.
 */
let originalClipboardDescriptor: PropertyDescriptor | undefined;

/**
 * Assistant 메시지를 list item의 올바른 부모와 함께 렌더링합니다.
 *
 * @param props Assistant 메시지 테스트 속성
 * @param props.isStreaming 현재 응답 스트리밍 여부
 */
function renderAssistantMessage({ isStreaming }: { isStreaming?: boolean }) {
  render(
    <ul>
      <NoteChatAssistantMessage
        text={ASSISTANT_MESSAGE_CONTENT}
        {...(isStreaming !== undefined ? { isStreaming } : {})}
      />
    </ul>,
  );
}

describe("NoteChatAssistantMessage", () => {
  beforeEach(() => {
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (originalClipboardDescriptor) {
      Object.defineProperty(
        navigator,
        "clipboard",
        originalClipboardDescriptor,
      );
    }
  });

  it("스트리밍 중인 assistant 메시지에는 응답 액션을 표시하지 않는다", () => {
    renderAssistantMessage({ isStreaming: true });

    expect(
      screen.queryByRole("button", { name: "응답 복사" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "응답 신고" }),
    ).not.toBeInTheDocument();
  });

  it("스트리밍이 완료된 assistant 메시지에는 응답 복사와 신고 액션을 표시한다", () => {
    renderAssistantMessage({});

    expect(
      screen.getByRole("button", { name: "응답 복사" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "응답 신고" })).toHaveAttribute(
      "href",
      "/mypage?section=support&tab=inquiry",
    );
  });

  it("복사 버튼 클릭 시 응답 본문을 클립보드에 복사하고 2초 후 기본 상태로 복원한다", async () => {
    const writeText = vi.fn<Clipboard["writeText"]>().mockResolvedValue();
    let resetCopiedState: (() => void) | null = null;

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    vi.spyOn(window, "setTimeout").mockImplementation(((
      handler: Parameters<typeof window.setTimeout>[0],
      timeout?: Parameters<typeof window.setTimeout>[1],
    ) => {
      if (timeout === 2000 && typeof handler === "function") {
        resetCopiedState = handler;
      }

      return 1 as unknown as ReturnType<typeof window.setTimeout>;
    }) as typeof window.setTimeout);

    renderAssistantMessage({});

    fireEvent.click(screen.getByRole("button", { name: "응답 복사" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(ASSISTANT_MESSAGE_CONTENT);
    expect(
      screen.getByRole("button", { name: "복사 완료" }),
    ).toBeInTheDocument();

    expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
    expect(resetCopiedState).not.toBeNull();

    act(() => {
      resetCopiedState?.();
    });

    expect(
      screen.getByRole("button", { name: "응답 복사" }),
    ).toBeInTheDocument();
  });
});
