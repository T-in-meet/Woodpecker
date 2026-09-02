import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatConversationClient } from "./NoteChatConversationClient";

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const USER_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440002";
const SECOND_USER_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440003";

const mockConversationRefetch = vi.fn();
const mockMessagesRefetch = vi.fn();
const mockFetchNextPage = vi.fn();

const mockHandleQuestionSubmit = vi.fn();
const mockHandleQuestionUpdate = vi.fn();
const mockHandleRetry = vi.fn();
const mockOnCancel = vi.fn();

const mockHandleViewportScroll = vi.fn();
const mockRegisterUserMessageElement = vi.fn();
const mockScrollQuestionToViewportStart = vi.fn();
const mockScrollToLatestMessage = vi.fn();
const mockStopFollowingLatest = vi.fn();

const mockCancelNavigation = vi.fn();
const mockConfirmNavigation = vi.fn();

let mockConversationDetail: {
  conversation: {
    id: string;
    title: string;
  };
  hasRunningExecution: boolean;
} | null;

let mockMessages: Array<{
  id: string;
  role: "user" | "assistant";
  sequence_number: number;
}>;

let mockExecutionState: {
  canRetry: boolean;
  editingSequenceNumber: number | null;
  isAnswerGenerating: boolean;
  isStreaming: boolean;
  pendingQuestion: string | null;
  pendingQuestionMessageId: string | null;
  retryCount: number;
  retryQuestionMessageId: string | null;
  streamError: string | null;
  streamErrorCode: string | null;
  streamingAssistantMessageId: string | null;
  streamingContent: string;
};

let mockHasNextPage: boolean;
let mockIsFetchingNextPage: boolean;

vi.mock("../hooks/use-note-chat-conversation-query", () => ({
  useNoteChatConversationDetailQuery: () => ({
    data: mockConversationDetail,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: mockConversationRefetch,
  }),

  useNoteChatConversationMessagesQuery: () => ({
    data: {
      pages: [
        {
          assistantSources: [],
          messages: mockMessages,
          nextCursor: null,
        },
      ],
    },
    fetchNextPage: mockFetchNextPage,
    hasNextPage: mockHasNextPage,
    isError: false,
    isFetching: false,
    isFetchingNextPage: mockIsFetchingNextPage,
    isLoading: false,
    refetch: mockMessagesRefetch,
  }),
}));

vi.mock("../hooks/use-note-chat-daily-usage-query", () => ({
  useNoteChatDailyUsageQuery: () => ({
    data: null,
  }),
}));

vi.mock("../hooks/use-note-chat-conversation-execution", () => ({
  useNoteChatConversationExecution: ({
    conversationId,
    hasRunningExecution,
  }: {
    conversationId: string;
    hasRunningExecution: boolean;
  }) => {
    mockUseExecutionArgs({
      conversationId,
      hasRunningExecution,
    });

    return {
      ...mockExecutionState,
      handleQuestionSubmit: mockHandleQuestionSubmit,
      handleQuestionUpdate: mockHandleQuestionUpdate,
      handleRetry: mockHandleRetry,
      onCancel: mockOnCancel,
    };
  },
}));

vi.mock("../hooks/use-note-chat-conversation-scroll", () => ({
  useNoteChatConversationScroll: ({
    conversationId,
    pendingQuestionMessageId,
  }: {
    conversationId: string;
    pendingQuestionMessageId: string | null;
  }) => {
    mockUseScrollArgs({
      conversationId,
      pendingQuestionMessageId,
    });

    return {
      handleViewportScroll: mockHandleViewportScroll,
      messageEndRef: {
        current: null,
      },
      questionBottomSpacerHeight: 0,
      registerUserMessageElement: mockRegisterUserMessageElement,
      scrollQuestionToViewportStart: mockScrollQuestionToViewportStart,
      scrollToLatestMessage: mockScrollToLatestMessage,
      scrollViewportRef: {
        current: null,
      },
      shouldShowLatestMessageButton: false,
      stopFollowingLatest: mockStopFollowingLatest,
    };
  },
}));

vi.mock("../hooks/use-viewport-remaining-height", () => ({
  useViewportRemainingHeight: () => ({
    containerRef: {
      current: null,
    },
    height: null,
  }),
}));

vi.mock("@/hooks/useInternalNavigationGuard", () => ({
  useInternalNavigationGuard: () => ({
    cancelNavigation: mockCancelNavigation,
    confirmNavigation: mockConfirmNavigation,
    isNavigationPending: false,
  }),
}));

vi.mock("@/hooks/useBeforeUnloadGuard", () => ({
  useBeforeUnloadGuard: vi.fn(),
}));

vi.mock("@/components/common/NavigationGuardAlertDialog", () => ({
  NavigationGuardAlertDialog: () => null,
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

const mockUseExecutionArgs = vi.fn();
const mockUseScrollArgs = vi.fn();

vi.mock("./NoteChatConversationContent", () => ({
  NoteChatConversationContent: ({
    messages,
    onCancel,
    onRetry,
    onSubmit,
    onUpdateQuestion,
  }: {
    messages: Array<{
      id: string;
      role: string;
      sequence_number: number;
    }>;
    onCancel: () => void;
    onRetry: () => Promise<void>;
    onSubmit: (question: string) => Promise<void>;
    onUpdateQuestion: (params: {
      messageId: string;
      question: string;
      sequenceNumber: number;
    }) => Promise<void>;
  }) => (
    <div>
      <div data-testid="message-ids">
        {messages.map((message) => message.id).join(",")}
      </div>

      <button
        type="button"
        onClick={() => {
          void onSubmit("새 질문");
        }}
      >
        질문 전송
      </button>

      <button
        type="button"
        onClick={() => {
          void onUpdateQuestion({
            messageId: USER_MESSAGE_ID,
            question: "수정한 질문",
            sequenceNumber: 3,
          });
        }}
      >
        질문 수정
      </button>

      <button
        type="button"
        onClick={() => {
          void onRetry();
        }}
      >
        재시도
      </button>

      <button type="button" onClick={onCancel}>
        답변 표시 중지
      </button>
    </div>
  ),
}));

describe("NoteChatConversationClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockConversationDetail = {
      conversation: {
        id: CONVERSATION_ID,
        title: "테스트 대화",
      },
      hasRunningExecution: false,
    };

    mockMessages = [];

    mockExecutionState = {
      canRetry: false,
      editingSequenceNumber: null,
      isAnswerGenerating: false,
      isStreaming: false,
      pendingQuestion: null,
      pendingQuestionMessageId: null,
      retryCount: 0,
      retryQuestionMessageId: null,
      streamError: null,
      streamErrorCode: null,
      streamingAssistantMessageId: null,
      streamingContent: "",
    };

    mockHasNextPage = false;
    mockIsFetchingNextPage = false;

    mockHandleQuestionSubmit.mockResolvedValue(undefined);
    mockHandleQuestionUpdate.mockResolvedValue(undefined);
    mockHandleRetry.mockResolvedValue(undefined);
    mockFetchNextPage.mockResolvedValue(undefined);
  });

  it("서버 running Claim 상태를 execution hook에 전달한다", () => {
    mockConversationDetail = {
      ...mockConversationDetail!,
      hasRunningExecution: true,
    };

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(mockUseExecutionArgs).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      hasRunningExecution: true,
    });
  });

  it("새 질문 전송 시 pending 질문 TOP 이동을 예약한 뒤 질문 실행을 호출한다", () => {
    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "질문 전송",
      }),
    );

    expect(mockScrollQuestionToViewportStart).toHaveBeenCalledTimes(1);
    expect(mockScrollQuestionToViewportStart).toHaveBeenCalledWith(null);

    expect(mockHandleQuestionSubmit).toHaveBeenCalledTimes(1);
    expect(mockHandleQuestionSubmit).toHaveBeenCalledWith("새 질문");

    expect(
      mockScrollQuestionToViewportStart.mock.invocationCallOrder[0],
    ).toBeLessThan(mockHandleQuestionSubmit.mock.invocationCallOrder[0]!);
  });

  it("기존 질문 수정 시 해당 Message ID를 TOP 기준으로 잡은 뒤 질문 수정을 호출한다", () => {
    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "질문 수정",
      }),
    );

    expect(mockScrollQuestionToViewportStart).toHaveBeenCalledTimes(1);
    expect(mockScrollQuestionToViewportStart).toHaveBeenCalledWith(
      USER_MESSAGE_ID,
    );

    expect(mockHandleQuestionUpdate).toHaveBeenCalledTimes(1);
    expect(mockHandleQuestionUpdate).toHaveBeenCalledWith({
      messageId: USER_MESSAGE_ID,
      question: "수정한 질문",
      sequenceNumber: 3,
    });

    expect(
      mockScrollQuestionToViewportStart.mock.invocationCallOrder[0],
    ).toBeLessThan(mockHandleQuestionUpdate.mock.invocationCallOrder[0]!);
  });

  it("실패한 질문 재시도 시 기존 User Message를 TOP으로 이동한 뒤 재시도한다", () => {
    mockExecutionState.retryQuestionMessageId = USER_MESSAGE_ID;
    mockExecutionState.canRetry = true;

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "재시도",
      }),
    );

    expect(mockScrollQuestionToViewportStart).toHaveBeenCalledTimes(1);
    expect(mockScrollQuestionToViewportStart).toHaveBeenCalledWith(
      USER_MESSAGE_ID,
    );

    expect(mockHandleRetry).toHaveBeenCalledTimes(1);

    expect(
      mockScrollQuestionToViewportStart.mock.invocationCallOrder[0],
    ).toBeLessThan(mockHandleRetry.mock.invocationCallOrder[0]!);
  });

  it("재시도할 User Message ID가 없으면 스크롤 이동과 재시도를 실행하지 않는다", () => {
    mockExecutionState.retryQuestionMessageId = null;

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "재시도",
      }),
    );

    expect(mockScrollQuestionToViewportStart).not.toHaveBeenCalled();
    expect(mockHandleRetry).not.toHaveBeenCalled();
  });

  it("답변 표시 중지 시 최신 메시지 follow를 먼저 해제한 뒤 stream 표시를 중지한다", () => {
    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "답변 표시 중지",
      }),
    );

    expect(mockStopFollowingLatest).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);

    expect(mockStopFollowingLatest.mock.invocationCallOrder[0]).toBeLessThan(
      mockOnCancel.mock.invocationCallOrder[0]!,
    );
  });

  it("질문 수정 중에는 수정 대상 sequence 이후의 저장 메시지를 Content에 전달하지 않는다", () => {
    mockMessages = [
      {
        id: "message-1",
        role: "user",
        sequence_number: 1,
      },
      {
        id: "message-2",
        role: "assistant",
        sequence_number: 2,
      },
      {
        id: USER_MESSAGE_ID,
        role: "user",
        sequence_number: 3,
      },
      {
        id: "message-4",
        role: "assistant",
        sequence_number: 4,
      },
      {
        id: SECOND_USER_MESSAGE_ID,
        role: "user",
        sequence_number: 5,
      },
    ];

    mockExecutionState.editingSequenceNumber = 3;

    render(<NoteChatConversationClient conversationId={CONVERSATION_ID} />);

    expect(screen.getByTestId("message-ids")).toHaveTextContent(
      "message-1,message-2",
    );

    expect(screen.getByTestId("message-ids")).not.toHaveTextContent(
      USER_MESSAGE_ID,
    );

    expect(screen.getByTestId("message-ids")).not.toHaveTextContent(
      "message-4",
    );

    expect(screen.getByTestId("message-ids")).not.toHaveTextContent(
      SECOND_USER_MESSAGE_ID,
    );
  });
});
