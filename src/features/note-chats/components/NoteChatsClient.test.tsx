import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatsClient } from "./NoteChatsClient";

const mockRefetch = vi.fn();

let mockConversationListQuery = {
  data: undefined,
  isError: true,
  isFetching: false,
  isLoading: false,
  refetch: mockRefetch,
};

vi.mock("../hooks/use-note-chat-conversation-list-query", () => ({
  useNoteChatConversationListQuery: () => mockConversationListQuery,
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

vi.mock("./NoteChatConversationSearch", () => ({
  NoteChatConversationSearch: () => <div>search</div>,
}));

vi.mock("./NoteChatCreateDialog", () => ({
  NoteChatCreateDialog: () => <div>create dialog</div>,
}));

vi.mock("./NoteChatConversationList", () => ({
  NoteChatConversationList: () => <div>conversation list</div>,
}));

vi.mock("./NoteChatConversationListSkeleton", () => ({
  NoteChatConversationListSkeleton: () => <div>conversation list skeleton</div>,
}));

describe("NoteChatsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockConversationListQuery = {
      data: undefined,
      isError: true,
      isFetching: false,
      isLoading: false,
      refetch: mockRefetch,
    };

    mockRefetch.mockResolvedValue(undefined);
  });

  it("대화 목록 조회 실패 상태에서 다시 시도하면 목록 Query를 재조회한다", () => {
    render(<NoteChatsClient />);

    expect(
      screen.getByText("대화 목록을 불러오지 못했습니다."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "다시 시도",
      }),
    );

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("대화 목록 재조회 중에는 다시 시도 버튼을 비활성화한다", () => {
    mockConversationListQuery = {
      ...mockConversationListQuery,
      isFetching: true,
    };

    render(<NoteChatsClient />);

    expect(
      screen.getByRole("button", {
        name: "다시 불러오는 중...",
      }),
    ).toBeDisabled();
  });
});
