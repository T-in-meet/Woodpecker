import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteChatConversationScroll } from "../use-note-chat-conversation-scroll";

const mockLoadPreviousMessages = vi.fn();

function createScrollParams(
  overrides: Partial<Parameters<typeof useNoteChatConversationScroll>[0]> = {},
): Parameters<typeof useNoteChatConversationScroll>[0] {
  return {
    conversationHeight: 500,
    editingSequenceNumber: null,
    hasDetail: true,
    hasPreviousMessages: false,
    isFetchingPreviousMessages: false,
    messageCount: 1,
    onLoadPreviousMessages: mockLoadPreviousMessages,
    pendingQuestion: null,
    streamingContent: "",
    ...overrides,
  };
}

describe("useNoteChatConversationScroll", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);

      return 1;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  it("최초 Conversation과 높이가 준비되면 최신 메시지 위치로 즉시 이동한다", () => {
    const scrollIntoView = vi.fn();

    const { result } = renderHook(() =>
      useNoteChatConversationScroll(createScrollParams()),
    );

    result.current.messageEndRef.current = {
      scrollIntoView,
    } as unknown as HTMLDivElement;

    /*
     * requestAnimationFrame이 최초 render effect 시점에 실행되므로
     * ref를 연결한 뒤 높이 값을 변경해 effect를 다시 실행합니다.
     */
    const { rerender } = renderHook(
      ({ conversationHeight }) =>
        useNoteChatConversationScroll(
          createScrollParams({
            conversationHeight,
          }),
        ),
      {
        initialProps: {
          conversationHeight: null as number | null,
        },
      },
    );

    rerender({
      conversationHeight: 500,
    });

    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it("하단 근처에서는 streamingContent 변경 시 최신 메시지 위치로 이동한다", () => {
    const scrollIntoView = vi.fn();

    const { result, rerender } = renderHook(
      ({ conversationHeight, streamingContent }) =>
        useNoteChatConversationScroll(
          createScrollParams({
            conversationHeight,
            streamingContent,
          }),
        ),
      {
        initialProps: {
          conversationHeight: null as number | null,
          streamingContent: "",
        },
      },
    );

    result.current.messageEndRef.current = {
      scrollIntoView,
    } as unknown as HTMLDivElement;

    result.current.scrollViewportRef.current = {
      scrollHeight: 1000,
      scrollTop: 450,
      clientHeight: 500,
    } as HTMLDivElement;

    /*
     * 실제 화면처럼 ref가 연결된 뒤 대화 영역 높이가 준비되도록 해
     * 최초 스크롤을 완료합니다.
     */
    rerender({
      conversationHeight: 500,
      streamingContent: "",
    });

    act(() => {
      result.current.handleViewportScroll();
    });

    expect(result.current.shouldShowLatestMessageButton).toBe(false);

    scrollIntoView.mockClear();

    rerender({
      conversationHeight: 500,
      streamingContent: "새 토큰",
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
    });
  });

  it("하단에서 64px 초과 떨어져 있으면 streamingContent 변경 시 자동으로 이동하지 않는다", () => {
    const scrollIntoView = vi.fn();

    const { result, rerender } = renderHook(
      ({ streamingContent }) =>
        useNoteChatConversationScroll(
          createScrollParams({
            streamingContent,
          }),
        ),
      {
        initialProps: {
          streamingContent: "",
        },
      },
    );

    result.current.messageEndRef.current = {
      scrollIntoView,
    } as unknown as HTMLDivElement;

    result.current.scrollViewportRef.current = {
      scrollHeight: 1200,
      scrollTop: 500,
      clientHeight: 500,
    } as HTMLDivElement;

    act(() => {
      result.current.handleViewportScroll();
    });

    expect(result.current.shouldShowLatestMessageButton).toBe(true);

    scrollIntoView.mockClear();

    rerender({
      streamingContent: "새 토큰",
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("하단에서 정확히 64px 떨어져 있으면 streamingContent 변경 시 자동으로 이동하지 않는다", () => {
    const scrollIntoView = vi.fn();

    const { result, rerender } = renderHook(
      ({ conversationHeight, streamingContent }) =>
        useNoteChatConversationScroll(
          createScrollParams({
            conversationHeight,
            streamingContent,
          }),
        ),
      {
        initialProps: {
          conversationHeight: null as number | null,
          streamingContent: "",
        },
      },
    );

    result.current.messageEndRef.current = {
      scrollIntoView,
    } as unknown as HTMLDivElement;

    result.current.scrollViewportRef.current = {
      scrollHeight: 1000,
      scrollTop: 436,
      clientHeight: 500,
    } as HTMLDivElement;

    /*
     * ref가 연결된 뒤 높이를 준비해 최초 스크롤을 완료합니다.
     */
    rerender({
      conversationHeight: 500,
      streamingContent: "",
    });

    act(() => {
      result.current.handleViewportScroll();
    });

    expect(result.current.shouldShowLatestMessageButton).toBe(true);

    scrollIntoView.mockClear();

    rerender({
      conversationHeight: 500,
      streamingContent: "새 토큰",
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("최신 메시지 이동을 요청하면 최신 메시지 위치로 부드럽게 이동한다", () => {
    const scrollIntoView = vi.fn();

    const { result } = renderHook(() =>
      useNoteChatConversationScroll(
        createScrollParams({
          conversationHeight: null,
          hasDetail: false,
          messageCount: 0,
        }),
      ),
    );

    result.current.messageEndRef.current = {
      scrollIntoView,
    } as unknown as HTMLDivElement;

    act(() => {
      result.current.scrollToLatestMessage();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
    });
  });

  it("상단 근처로 스크롤하면 이전 메시지를 조회하고 prepend 후 위치를 유지한다", async () => {
    let scrollHeight = 1000;
    const viewport = {
      clientHeight: 500,
      scrollTop: 20,
    } as HTMLDivElement;

    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });

    mockLoadPreviousMessages.mockImplementation(async () => {
      scrollHeight = 1300;
    });

    const { result } = renderHook(() =>
      useNoteChatConversationScroll(
        createScrollParams({
          hasPreviousMessages: true,
          onLoadPreviousMessages: mockLoadPreviousMessages,
        }),
      ),
    );

    result.current.scrollViewportRef.current = viewport;

    await act(async () => {
      result.current.handleViewportScroll();
    });

    expect(mockLoadPreviousMessages).toHaveBeenCalledTimes(1);
    expect(viewport.scrollTop).toBe(320);
  });

  it("하단 스크롤은 이전 메시지 조회를 트리거하지 않는다", () => {
    const { result } = renderHook(() =>
      useNoteChatConversationScroll(
        createScrollParams({
          hasPreviousMessages: true,
        }),
      ),
    );

    result.current.scrollViewportRef.current = {
      clientHeight: 500,
      scrollHeight: 1000,
      scrollTop: 450,
    } as HTMLDivElement;

    act(() => {
      result.current.handleViewportScroll();
    });

    expect(mockLoadPreviousMessages).not.toHaveBeenCalled();
  });
});
