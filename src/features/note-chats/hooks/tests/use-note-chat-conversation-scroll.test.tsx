import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteChatConversationScroll } from "../use-note-chat-conversation-scroll";

type ScrollParams = Parameters<typeof useNoteChatConversationScroll>[0];

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  private readonly callback: ResizeObserverCallback;

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function createRect({
  top,
  bottom = top,
  left = 0,
  right = 100,
}: {
  top: number;
  bottom?: number;
  left?: number;
  right?: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    bottom,
    left,
    right,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockElementRect(element: Element, getRect: () => DOMRect) {
  return vi.spyOn(element, "getBoundingClientRect").mockImplementation(getRect);
}

function createScrollDom() {
  const viewport = document.createElement("div");
  const content = document.createElement("div");
  const messageEnd = document.createElement("div");

  content.appendChild(messageEnd);
  viewport.appendChild(content);
  document.body.appendChild(viewport);

  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: 500,
  });

  viewport.scrollTop = 0;

  mockElementRect(viewport, () =>
    createRect({
      top: 100,
      bottom: 600,
    }),
  );

  mockElementRect(messageEnd, () =>
    createRect({
      top: 600,
      bottom: 600,
    }),
  );

  const messageEndScrollIntoView = vi.fn();

  Object.defineProperty(messageEnd, "scrollIntoView", {
    configurable: true,
    value: messageEndScrollIntoView,
  });

  return {
    content,
    messageEnd,
    messageEndScrollIntoView,
    viewport,
  };
}

function prepareHook(overrides: Partial<ScrollParams> = {}) {
  const onLoadPreviousMessages =
    overrides.onLoadPreviousMessages ?? vi.fn().mockResolvedValue(undefined);

  const { result, rerender } = renderHook(
    ({
      conversationId,
      conversationHeight,
      pendingQuestionMessageId,
      hasPreviousMessages,
      hasDetail,
      isFetchingPreviousMessages,
    }) =>
      useNoteChatConversationScroll({
        conversationId,
        conversationHeight,
        pendingQuestionMessageId,
        hasPreviousMessages,
        hasDetail,
        isFetchingPreviousMessages,
        onLoadPreviousMessages,
      }),
    {
      initialProps: {
        conversationId: overrides.conversationId ?? "conversation-1",
        conversationHeight: null as number | null,
        pendingQuestionMessageId: overrides.pendingQuestionMessageId ?? null,
        hasPreviousMessages: overrides.hasPreviousMessages ?? false,
        hasDetail: overrides.hasDetail ?? true,
        isFetchingPreviousMessages:
          overrides.isFetchingPreviousMessages ?? false,
      },
    },
  );

  const dom = createScrollDom();

  result.current.scrollViewportRef.current = dom.viewport;
  result.current.messageEndRef.current = dom.messageEnd;

  rerender({
    conversationId: overrides.conversationId ?? "conversation-1",
    conversationHeight: 500,
    pendingQuestionMessageId: overrides.pendingQuestionMessageId ?? null,
    hasPreviousMessages: overrides.hasPreviousMessages ?? false,
    hasDetail: overrides.hasDetail ?? true,
    isFetchingPreviousMessages: overrides.isFetchingPreviousMessages ?? false,
  });

  return {
    ...dom,
    onLoadPreviousMessages,
    result,
    rerender,
  };
}

describe("useNoteChatConversationScroll", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];

    vi.stubGlobal(
      "ResizeObserver",
      MockResizeObserver as unknown as typeof ResizeObserver,
    );

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    );

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("최초 Conversation이 준비되면 최신 메시지 위치로 한 번 이동한다", () => {
    const { messageEndScrollIntoView } = prepareHook();

    expect(messageEndScrollIntoView).toHaveBeenCalledTimes(1);
    expect(messageEndScrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "end",
    });
  });

  it("최초 이동 이후 콘텐츠 높이가 변해도 자동 follow하지 않는다", () => {
    const { messageEndScrollIntoView } = prepareHook();

    messageEndScrollIntoView.mockClear();

    const resizeObserver = MockResizeObserver.instances.at(-1);

    expect(resizeObserver).toBeDefined();

    act(() => {
      resizeObserver?.trigger();
    });

    expect(messageEndScrollIntoView).not.toHaveBeenCalled();
  });

  it("새 pending 질문이 늦게 등록되어도 viewport 시작점으로 이동한다", () => {
    const { content, result, viewport } = prepareHook();

    viewport.scrollTop = 300;

    act(() => {
      result.current.scrollQuestionToViewportStart(null);
    });

    const pendingQuestion = document.createElement("li");

    content.insertBefore(pendingQuestion, result.current.messageEndRef.current);

    mockElementRect(pendingQuestion, () =>
      createRect({
        top: 250,
        bottom: 300,
      }),
    );

    act(() => {
      result.current.registerUserMessageElement(null, pendingQuestion);
    });

    expect(viewport.scrollTop).toBe(450);
  });

  it("저장된 기존 질문을 Message ID로 viewport 시작점에 맞춘다", () => {
    const { content, result, viewport } = prepareHook();

    const storedQuestion = document.createElement("li");

    content.insertBefore(storedQuestion, result.current.messageEndRef.current);

    mockElementRect(storedQuestion, () =>
      createRect({
        top: 300,
        bottom: 350,
      }),
    );

    viewport.scrollTop = 100;

    act(() => {
      result.current.registerUserMessageElement("message-1", storedQuestion);

      result.current.scrollQuestionToViewportStart("message-1");
    });

    expect(viewport.scrollTop).toBe(300);
  });

  it("질문 수정 중 stored → pending → stored 전환에서도 같은 질문의 TOP 기준 DOM을 이어받는다", () => {
    const { content, result, rerender } = prepareHook();

    const storedQuestion = document.createElement("li");

    content.insertBefore(storedQuestion, result.current.messageEndRef.current);

    mockElementRect(storedQuestion, () =>
      createRect({
        top: 200,
        bottom: 250,
      }),
    );

    act(() => {
      result.current.registerUserMessageElement("message-1", storedQuestion);

      result.current.scrollQuestionToViewportStart("message-1");
    });

    rerender({
      conversationId: "conversation-1",
      conversationHeight: 500,
      pendingQuestionMessageId: "message-1",
      hasPreviousMessages: false,
      hasDetail: true,
      isFetchingPreviousMessages: false,
    });

    storedQuestion.remove();

    act(() => {
      result.current.registerUserMessageElement("message-1", null);
    });

    const pendingQuestion = document.createElement("li");

    content.insertBefore(pendingQuestion, result.current.messageEndRef.current);

    mockElementRect(pendingQuestion, () =>
      createRect({
        top: 300,
        bottom: 350,
      }),
    );

    act(() => {
      result.current.registerUserMessageElement(null, pendingQuestion);
    });

    const resizeObserver = MockResizeObserver.instances.at(-1);

    expect(resizeObserver).toBeDefined();

    act(() => {
      resizeObserver?.trigger();
    });

    expect(result.current.questionBottomSpacerHeight).toBe(200);

    pendingQuestion.remove();

    act(() => {
      result.current.registerUserMessageElement(null, null);
    });

    const nextStoredQuestion = document.createElement("li");

    content.insertBefore(
      nextStoredQuestion,
      result.current.messageEndRef.current,
    );

    mockElementRect(nextStoredQuestion, () =>
      createRect({
        top: 350,
        bottom: 400,
      }),
    );

    act(() => {
      result.current.registerUserMessageElement(
        "message-1",
        nextStoredQuestion,
      );
    });

    act(() => {
      resizeObserver?.trigger();
    });

    expect(result.current.questionBottomSpacerHeight).toBe(250);
  });

  it("질문 TOP 정렬 후 콘텐츠 높이가 증가해도 자동 follow하지 않는다", () => {
    const { content, messageEndScrollIntoView, result } = prepareHook();

    const question = document.createElement("li");

    content.insertBefore(question, result.current.messageEndRef.current);

    mockElementRect(question, () =>
      createRect({
        top: 200,
        bottom: 250,
      }),
    );

    act(() => {
      result.current.registerUserMessageElement("message-1", question);

      result.current.scrollQuestionToViewportStart("message-1");
    });

    messageEndScrollIntoView.mockClear();

    const resizeObserver = MockResizeObserver.instances.at(-1);

    act(() => {
      resizeObserver?.trigger();
    });

    expect(messageEndScrollIntoView).not.toHaveBeenCalled();
  });

  it("최신 메시지 이동을 선택하면 smooth 이동하고 follow를 활성화한다", () => {
    const { messageEndScrollIntoView, result } = prepareHook();

    messageEndScrollIntoView.mockClear();

    act(() => {
      result.current.scrollToLatestMessage();
    });

    expect(messageEndScrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "end",
    });

    messageEndScrollIntoView.mockClear();

    const resizeObserver = MockResizeObserver.instances.at(-1);

    act(() => {
      resizeObserver?.trigger();
    });

    expect(messageEndScrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "end",
    });
  });

  it("follow 상태에서는 콘텐츠 높이 증가를 최신 메시지까지 따라간다", () => {
    const { messageEndScrollIntoView, result } = prepareHook();

    act(() => {
      result.current.scrollToLatestMessage();
    });

    messageEndScrollIntoView.mockClear();

    const resizeObserver = MockResizeObserver.instances.at(-1);

    act(() => {
      resizeObserver?.trigger();
    });

    expect(messageEndScrollIntoView).toHaveBeenCalledTimes(1);
    expect(messageEndScrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "end",
    });
  });

  it("사용자가 위 방향 wheel 입력을 하면 follow를 중지한다", () => {
    const { messageEndScrollIntoView, result, viewport } = prepareHook();

    act(() => {
      result.current.scrollToLatestMessage();
    });

    messageEndScrollIntoView.mockClear();

    act(() => {
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -100,
        }),
      );
    });

    const resizeObserver = MockResizeObserver.instances.at(-1);

    act(() => {
      resizeObserver?.trigger();
    });

    expect(messageEndScrollIntoView).not.toHaveBeenCalled();
  });

  it("follow 중 scrollbar로 scrollTop이 감소하면 follow를 중지한다", () => {
    const { messageEndScrollIntoView, result, viewport } = prepareHook();

    /*
     * 최신 메시지 이동을 선택하여 follow를 활성화합니다.
     */
    act(() => {
      result.current.scrollToLatestMessage();
    });

    messageEndScrollIntoView.mockClear();

    /*
     * latest 이동 이후 현재 위치를 기준으로 삼습니다.
     */
    viewport.scrollTop = 800;

    act(() => {
      result.current.handleViewportScroll();
    });

    /*
     * wheel/touch/key 이벤트 없이 scrollbar thumb/track으로
     * 위쪽으로 이동한 상황을 scrollTop 감소만으로 재현합니다.
     */
    viewport.scrollTop = 500;

    act(() => {
      result.current.handleViewportScroll();
    });

    /*
     * 이후 스트리밍으로 콘텐츠 높이가 증가해 ResizeObserver가 실행되어도
     * follow가 이미 종료되었으므로 최신 메시지까지 자동 이동하면 안 됩니다.
     */
    const resizeObserver = MockResizeObserver.instances.at(-1);

    expect(resizeObserver).toBeDefined();

    act(() => {
      resizeObserver?.trigger();
    });

    expect(messageEndScrollIntoView).not.toHaveBeenCalled();
  });

  it("최신 메시지가 viewport 밖에 있으면 최신 메시지 버튼을 표시하고 다시 안으로 들어오면 숨긴다", () => {
    const { messageEnd, result, viewport } = prepareHook();

    let messageEndTop = 700;

    mockElementRect(messageEnd, () =>
      createRect({
        top: messageEndTop,
        bottom: messageEndTop,
      }),
    );

    act(() => {
      result.current.handleViewportScroll();
    });

    expect(result.current.shouldShowLatestMessageButton).toBe(true);

    messageEndTop = 500;

    act(() => {
      viewport.scrollTop = 100;
      result.current.handleViewportScroll();
    });

    expect(result.current.shouldShowLatestMessageButton).toBe(false);
  });

  it("이전 메시지를 prepend한 뒤에도 기존 visual anchor의 viewport 위치를 유지한다", async () => {
    let anchorTop = 150;

    const onLoadPreviousMessages = vi.fn(async () => {
      anchorTop = 350;
    });

    const { content, result, viewport } = prepareHook({
      hasPreviousMessages: true,
      onLoadPreviousMessages,
    });

    const anchor = document.createElement("li");

    content.insertBefore(anchor, result.current.messageEndRef.current);

    mockElementRect(anchor, () =>
      createRect({
        top: anchorTop,
        bottom: anchorTop + 50,
      }),
    );

    viewport.scrollTop = 20;

    act(() => {
      result.current.handleViewportScroll();
    });

    await waitFor(() => {
      expect(onLoadPreviousMessages).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(viewport.scrollTop).toBe(220);
    });
  });

  it("prepend 위치 복원으로 발생한 programmatic scroll은 다음 이전 메시지 조회를 다시 시작하지 않는다", async () => {
    let anchorTop = 150;

    const onLoadPreviousMessages = vi.fn(async () => {
      anchorTop = 350;
    });

    const { content, result, viewport } = prepareHook({
      hasPreviousMessages: true,
      onLoadPreviousMessages,
    });

    const anchor = document.createElement("li");

    content.insertBefore(anchor, result.current.messageEndRef.current);

    mockElementRect(anchor, () =>
      createRect({
        top: anchorTop,
        bottom: anchorTop + 50,
      }),
    );

    /*
     * 가장 오래된 메시지가 viewport에 노출된 상태에서
     * 첫 이전 메시지 조회를 시작합니다.
     */
    viewport.scrollTop = 20;

    act(() => {
      result.current.handleViewportScroll();
    });

    await waitFor(() => {
      expect(onLoadPreviousMessages).toHaveBeenCalledTimes(1);
    });

    /*
     * prepend된 콘텐츠 높이만큼 visual anchor 복원이 수행되어
     * 코드가 scrollTop을 20 → 220으로 직접 변경합니다.
     */
    await waitFor(() => {
      expect(viewport.scrollTop).toBe(220);
    });

    /*
     * 브라우저가 위 programmatic scrollTop 변경에 대한 scroll event를
     * 뒤늦게 전달한 상황을 재현합니다.
     *
     * 가장 오래된 메시지는 여전히 viewport에 보이지만,
     * 이 이벤트는 사용자 스크롤이 아니므로 다음 페이지 조회를
     * 다시 시작하면 안 됩니다.
     */
    act(() => {
      result.current.handleViewportScroll();
    });

    expect(onLoadPreviousMessages).toHaveBeenCalledTimes(1);
  });

  it("이전 메시지 조회가 진행 중이면 중복 조회하지 않는다", async () => {
    let resolveLoad: (() => void) | null = null;

    const onLoadPreviousMessages = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const { result, viewport } = prepareHook({
      hasPreviousMessages: true,
      onLoadPreviousMessages,
    });

    viewport.scrollTop = 0;

    act(() => {
      result.current.handleViewportScroll();
      result.current.handleViewportScroll();
      result.current.handleViewportScroll();
    });

    expect(onLoadPreviousMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad?.();
      await Promise.resolve();
    });
  });

  it("질문 수정으로 아래 콘텐츠가 제거되어 scrollTop이 clamp되어도 pending DOM handoff 후 질문을 viewport 시작점으로 복원한다", () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);

      return animationFrameCallbacks.length;
    });

    const viewport = {
      clientHeight: 500,
      scrollTop: 600,
      getBoundingClientRect: () =>
        ({
          top: 100,
          bottom: 600,
        }) as DOMRect,
    } as unknown as HTMLDivElement;

    const storedQuestion = {
      isConnected: true,
      getBoundingClientRect: () =>
        ({
          top: 100,
          bottom: 160,
        }) as DOMRect,
    } as unknown as HTMLLIElement;

    const pendingQuestion = {
      isConnected: true,
      getBoundingClientRect: () =>
        ({
          top: 300,
          bottom: 360,
        }) as DOMRect,
    } as unknown as HTMLLIElement;

    const messageEnd = {
      getBoundingClientRect: () =>
        ({
          top: 400,
          bottom: 400,
        }) as DOMRect,
    } as unknown as HTMLDivElement;

    const { result, rerender } = renderHook(
      ({ pendingQuestionMessageId }) =>
        useNoteChatConversationScroll({
          conversationId: "conversation-1",
          conversationHeight: 500,
          pendingQuestionMessageId,
          hasPreviousMessages: false,
          hasDetail: true,
          isFetchingPreviousMessages: false,
          onLoadPreviousMessages: vi.fn().mockResolvedValue(undefined),
        }),
      {
        initialProps: {
          pendingQuestionMessageId: null as string | null,
        },
      },
    );

    /*
     * renderHook 직후 conversationHeight가 이미 준비되어 있으므로
     * 최초 Conversation 최신 위치 이동 effect가 rAF를 하나 예약합니다.
     *
     * 아직 viewport/messageEnd ref를 연결하기 전이므로 이 frame은
     * 실제 scroll 동작 없이 종료됩니다.
     */
    expect(animationFrameCallbacks).toHaveLength(1);

    act(() => {
      animationFrameCallbacks.shift()?.(0);
    });

    expect(animationFrameCallbacks).toHaveLength(0);

    result.current.scrollViewportRef.current = viewport;
    result.current.messageEndRef.current = messageEnd;

    /*
     * 수정 전 stored 질문을 등록하고 해당 질문을 semantic target으로
     * viewport 시작점에 맞춥니다.
     */
    act(() => {
      result.current.registerUserMessageElement(
        "user-message-1",
        storedQuestion,
      );
      result.current.scrollQuestionToViewportStart("user-message-1");
    });

    expect(animationFrameCallbacks).toHaveLength(1);

    act(() => {
      animationFrameCallbacks.shift()?.(0);
    });

    expect(animationFrameCallbacks).toHaveLength(0);
    expect(viewport.scrollTop).toBe(600);

    /*
     * 질문 수정 lifecycle에서 같은 Message ID가 pending 질문과 연결됩니다.
     */
    rerender({
      pendingQuestionMessageId: "user-message-1",
    });

    /*
     * 아래 메시지 제거로 브라우저가 기존 scrollTop을 clamp한 상황입니다.
     */
    viewport.scrollTop = 250;

    /*
     * stored DOM이 제거되고 같은 semantic target의 pending DOM으로
     * 실제 element가 handoff됩니다.
     */
    act(() => {
      result.current.registerUserMessageElement("user-message-1", null);
      result.current.registerUserMessageElement(null, pendingQuestion);
    });

    expect(animationFrameCallbacks).toHaveLength(1);

    /*
     * spacer 반영 이후 예약된 handoff 정렬을 실행합니다.
     *
     * pending 질문은 viewport top보다 200px 아래이므로
     * scrollTop이 250 → 450으로 복원되어야 합니다.
     */
    act(() => {
      animationFrameCallbacks.shift()?.(0);
    });

    expect(animationFrameCallbacks).toHaveLength(0);
    expect(viewport.scrollTop).toBe(450);
  });

  it("더 최신 active 질문 DOM handoff가 발생하면 이전 handoff의 stale requestAnimationFrame 정렬을 무효화한다", () => {
    const animationFrameCallbacks: FrameRequestCallback[] = [];

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameCallbacks.push(callback);

      return animationFrameCallbacks.length;
    });

    const viewport = {
      clientHeight: 500,
      scrollTop: 200,
      getBoundingClientRect: () =>
        ({
          top: 100,
          bottom: 600,
        }) as DOMRect,
    } as unknown as HTMLDivElement;

    const storedQuestion = {
      isConnected: true,
      getBoundingClientRect: () =>
        ({
          top: 100,
          bottom: 160,
        }) as DOMRect,
    } as unknown as HTMLLIElement;

    const firstPendingQuestion = {
      isConnected: true,
      getBoundingClientRect: () =>
        ({
          top: 300,
          bottom: 360,
        }) as DOMRect,
    } as unknown as HTMLLIElement;

    const secondStoredQuestion = {
      isConnected: true,
      getBoundingClientRect: () =>
        ({
          top: 180,
          bottom: 240,
        }) as DOMRect,
    } as unknown as HTMLLIElement;

    const messageEnd = {
      getBoundingClientRect: () =>
        ({
          top: 400,
          bottom: 400,
        }) as DOMRect,
    } as unknown as HTMLDivElement;

    const { result, rerender } = renderHook(
      ({ pendingQuestionMessageId }) =>
        useNoteChatConversationScroll({
          conversationId: "conversation-1",
          conversationHeight: 500,
          pendingQuestionMessageId,
          hasPreviousMessages: false,
          hasDetail: true,
          isFetchingPreviousMessages: false,
          onLoadPreviousMessages: vi.fn().mockResolvedValue(undefined),
        }),
      {
        initialProps: {
          pendingQuestionMessageId: null as string | null,
        },
      },
    );

    /*
     * 최초 Conversation 최신 위치 이동 effect가 예약한 rAF를 먼저 소진합니다.
     */
    expect(animationFrameCallbacks).toHaveLength(1);

    act(() => {
      animationFrameCallbacks.shift()?.(0);
    });

    expect(animationFrameCallbacks).toHaveLength(0);

    result.current.scrollViewportRef.current = viewport;
    result.current.messageEndRef.current = messageEnd;

    /*
     * 기존 stored 질문을 active semantic target으로 설정하고
     * 최초 질문 정렬 frame을 먼저 소진합니다.
     */
    act(() => {
      result.current.registerUserMessageElement(
        "user-message-1",
        storedQuestion,
      );
      result.current.scrollQuestionToViewportStart("user-message-1");
    });

    expect(animationFrameCallbacks).toHaveLength(1);

    act(() => {
      animationFrameCallbacks.shift()?.(0);
    });

    expect(animationFrameCallbacks).toHaveLength(0);

    rerender({
      pendingQuestionMessageId: "user-message-1",
    });

    /*
     * 첫 번째 handoff: stored → pending.
     *
     * 이 시점에 firstPendingQuestion을 위한 alignment frame이 예약됩니다.
     */
    act(() => {
      result.current.registerUserMessageElement("user-message-1", null);
      result.current.registerUserMessageElement(null, firstPendingQuestion);
    });

    expect(animationFrameCallbacks).toHaveLength(1);

    const staleAlignmentFrame = animationFrameCallbacks.shift();

    expect(staleAlignmentFrame).toBeDefined();
    expect(animationFrameCallbacks).toHaveLength(0);

    /*
     * 첫 번째 frame이 실행되기 전에 두 번째 handoff가 발생합니다.
     *
     * pending → stored 전환으로 새로운 alignment version이 생성되며,
     * firstPendingQuestion용 frame은 stale 상태가 됩니다.
     */
    act(() => {
      result.current.registerUserMessageElement(null, null);
      result.current.registerUserMessageElement(
        "user-message-1",
        secondStoredQuestion,
      );
    });

    expect(animationFrameCallbacks).toHaveLength(1);

    const latestAlignmentFrame = animationFrameCallbacks.shift();

    expect(latestAlignmentFrame).toBeDefined();
    expect(animationFrameCallbacks).toHaveLength(0);

    const scrollTopBeforeStaleFrame = viewport.scrollTop;

    /*
     * 오래된 pending DOM용 frame은 version guard에 의해
     * scrollTop을 변경하지 않아야 합니다.
     */
    act(() => {
      staleAlignmentFrame?.(0);
    });

    expect(viewport.scrollTop).toBe(scrollTopBeforeStaleFrame);

    /*
     * 가장 최근 stored DOM용 frame만 현재 active element를 기준으로
     * viewport 위치를 보정해야 합니다.
     *
     * stored 질문 top 180 - viewport top 100 = 80px이므로
     * scrollTop이 정확히 80px 증가해야 합니다.
     */
    act(() => {
      latestAlignmentFrame?.(0);
    });

    expect(viewport.scrollTop).toBe(scrollTopBeforeStaleFrame + 80);
  });
});
