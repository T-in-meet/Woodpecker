import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatConversationClient } from "./NoteChatConversationClient";

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";

const mockInvalidateQueries = vi.fn();
const mockRefetch = vi.fn();
const mockStart = vi.fn();
const mockUpdate = vi.fn();
const mockCancel = vi.fn();
const mockReset = vi.fn();
const mockHandleViewportScroll = vi.fn();
const mockScrollToLatestMessage = vi.fn();

let mockConversationDetail: {
  conversation: {
    id: string;
    title: string;
  };
  messages: Array<{
    id: string;
    role: string;
    sequence_number: number;
  }>;
  assistantSources: [];
  hasRunningExecution: boolean;
} | null;

let mockIsStreaming: boolean;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("../hooks/use-note-chat-conversation-query", () => ({
  useNoteChatConversationDetailQuery: () => ({
    data: mockConversationDetail,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: mockRefetch,
  }),
}));

vi.mock("../hooks/use-note-chat-daily-usage-query", () => ({
  useNoteChatDailyUsageQuery: () => ({
    data: null,
  }),
}));

vi.mock("../hooks/use-note-chat-stream", () => ({
  useNoteChatStream: () => ({
    cancel: mockCancel,
    content: "",
    error: null,
    errorCode: null,
    isStreaming: mockIsStreaming,
    reset: mockReset,
    start: mockStart,
    update: mockUpdate,
  }),
}));

vi.mock("../hooks/use-note-chat-conversation-scroll", () => ({
  useNoteChatConversationScroll: () => ({
    handleViewportScroll: mockHandleViewportScroll,
    messageEndRef: {
      current: null,
    },
    scrollToLatestMessage: mockScrollToLatestMessage,
    scrollViewportRef: {
      current: null,
    },
    shouldShowLatestMessageButton: false,
  }),
}));

vi.mock("../hooks/use-viewport-remaining-height", () => ({
  useViewportRemainingHeight: () => ({
    containerRef: {
      current: null,
    },
    height: null,
  }),
}));

vi.mock("./NoteChatBreadcrumb", () => ({
  NoteChatBreadcrumb: () => <div>breadcrumb</div>,
}));

vi.mock("./NoteChatConversationMenu", () => ({
  NoteChatConversationMenu: () => <div>menu</div>,
}));

vi.mock("./NoteChatConversationSkeleton", () => ({
  NoteChatConversationSkeleton: () => <div>skeleton</div>,
}));

vi.mock("./NoteChatConversationError", () => ({
  NoteChatConversationError: () => <div>error</div>,
}));

vi.mock("./NoteChatConversationNotFound", () => ({
  NoteChatConversationNotFound: () => <div>not found</div>,
}));

vi.mock("./NoteChatConversationContent", () => ({
  NoteChatConversationContent: ({
    isStreaming,
    isAnswerGenerating,
    canRetry,
  }: {
    isStreaming: boolean;
    isAnswerGenerating: boolean;
    canRetry: boolean;
  }) => (
    <div>
      <div data-testid="is-streaming">{String(isStreaming)}</div>
      <div data-testid="is-answer-generating">{String(isAnswerGenerating)}</div>
      <div data-testid="can-retry">{String(canRetry)}</div>

      {isAnswerGenerating ? <div>답변 생성 중...</div> : null}

      {isStreaming ? <button>답변 표시 중지</button> : null}

      <textarea aria-label="질문 입력" disabled={isAnswerGenerating} />
    </div>
  ),
}));

describe("NoteChatConversationClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsStreaming = false;

    mockConversationDetail = {
      conversation: {
        id: CONVERSATION_ID,
        title: "테스트 대화",
      },
      messages: [],
      assistantSources: [],
      hasRunningExecution: false,
    };
  });

  it("서버에 running Claim이 있으면 답변 생성 중 상태로 복원한다", () => {
    mockConversationDetail = {
      ...mockConversationDetail!,
      hasRunningExecution: true,
    };

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(screen.getByTestId("is-streaming")).toHaveTextContent("false");
    expect(screen.getByTestId("is-answer-generating")).toHaveTextContent(
      "true",
    );

    expect(screen.getByText("답변 생성 중...")).toBeInTheDocument();
  });

  it("서버 running 복원 상태에서는 질문 입력을 비활성화한다", () => {
    mockConversationDetail = {
      ...mockConversationDetail!,
      hasRunningExecution: true,
    };

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(screen.getByRole("textbox", { name: "질문 입력" })).toBeDisabled();
  });

  it("서버 running 복원 상태에서는 로컬 stream이 아니므로 답변 표시 중지 버튼을 표시하지 않는다", () => {
    mockConversationDetail = {
      ...mockConversationDetail!,
      hasRunningExecution: true,
    };

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(
      screen.queryByRole("button", { name: "답변 표시 중지" }),
    ).not.toBeInTheDocument();
  });

  it("서버 running 복원 상태에서는 재시도를 허용하지 않는다", () => {
    mockConversationDetail = {
      ...mockConversationDetail!,
      hasRunningExecution: true,
    };

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(screen.getByTestId("can-retry")).toHaveTextContent("false");
  });

  it("running Claim이 없고 로컬 stream도 없으면 답변 생성 중 상태를 해제한다", () => {
    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(screen.getByTestId("is-streaming")).toHaveTextContent("false");
    expect(screen.getByTestId("is-answer-generating")).toHaveTextContent(
      "false",
    );

    expect(screen.queryByText("답변 생성 중...")).not.toBeInTheDocument();

    expect(
      screen.getByRole("textbox", { name: "질문 입력" }),
    ).not.toBeDisabled();
  });

  it("로컬 stream 중에는 답변 생성 중 상태와 답변 표시 중지 버튼을 함께 표시한다", () => {
    mockIsStreaming = true;

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(screen.getByTestId("is-streaming")).toHaveTextContent("true");
    expect(screen.getByTestId("is-answer-generating")).toHaveTextContent(
      "true",
    );

    expect(
      screen.getByRole("button", { name: "답변 표시 중지" }),
    ).toBeInTheDocument();
  });
});
