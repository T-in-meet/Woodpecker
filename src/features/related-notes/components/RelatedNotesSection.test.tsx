import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RelatedNotesSection } from "./RelatedNotesSection";

const {
  useBeforeUnloadGuardMock,
  useInternalNavigationGuardMock,
  useRelatedNotesMock,
  useRequestRelatedNoteRecommendationMock,
} = vi.hoisted(() => ({
  useBeforeUnloadGuardMock: vi.fn(),
  useInternalNavigationGuardMock: vi.fn(),
  useRelatedNotesMock: vi.fn(),
  useRequestRelatedNoteRecommendationMock: vi.fn(),
}));

vi.mock("@/hooks/useBeforeUnloadGuard", () => ({
  useBeforeUnloadGuard: useBeforeUnloadGuardMock,
}));

vi.mock("@/hooks/useInternalNavigationGuard", () => ({
  useInternalNavigationGuard: useInternalNavigationGuardMock,
}));

vi.mock("../hooks/use-related-notes", () => ({
  useRelatedNotes: useRelatedNotesMock,
}));

vi.mock("../hooks/use-request-related-note-recommendation", () => ({
  useRequestRelatedNoteRecommendation: useRequestRelatedNoteRecommendationMock,
}));

vi.mock("@/components/common/NavigationGuardAlertDialog", () => ({
  NavigationGuardAlertDialog: ({ open }: { open: boolean }) =>
    open ? <div>이동 확인 다이얼로그</div> : null,
}));

vi.mock("@/components/common/FeatureInfoPopover", () => ({
  FeatureInfoPopover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("./AddRelatedNoteDialog", () => ({
  AddRelatedNoteDialog: () => <button type="button">관련 노트 추가</button>,
}));

vi.mock("./RelatedNoteItem", () => ({
  RelatedNoteItem: ({ relatedNote }: { relatedNote: { title: string } }) => (
    <div>{relatedNote.title}</div>
  ),
}));

const noteId = "11111111-1111-4111-8111-111111111111";
const executionClaimId = "88888888-8888-4888-8888-888888888888";

const startRecommendationPollingMock = vi.fn();
const mutateMock = vi.fn();
const cancelNavigationMock = vi.fn();
const confirmNavigationMock = vi.fn();

type ExecutionStatus = "running" | "succeeded" | "failed" | "stale";

type MockRelatedNotesSectionDataOptions = {
  hasRunningRecommendationExecution?: boolean;
  hasFailedRecommendationExecution?: boolean;
  latestRecommendationExecution?: {
    id: string;
    status: ExecutionStatus;
  } | null;
  isPollingTimedOut?: boolean;
  isRecommendationPolling?: boolean;
  recommendationUsage?: {
    used: number;
    limit: number;
  } | null;
};

function mockRelatedNotesSectionData({
  hasRunningRecommendationExecution = false,
  hasFailedRecommendationExecution = false,
  latestRecommendationExecution = null,
  isPollingTimedOut = false,
  isRecommendationPolling = false,
  recommendationUsage = null,
}: MockRelatedNotesSectionDataOptions = {}) {
  useRelatedNotesMock.mockReturnValue({
    data: {
      hasFailedRecommendationExecution,
      hasRunningRecommendationExecution,
      latestRecommendationExecution,
      recommendationUsage,
      relatedNotes: [],
    },
    isError: false,
    isLoading: false,
    isPollingTimedOut,
    isRecommendationPolling,
    startRecommendationPolling: startRecommendationPollingMock,
  } as never);
}

function mockRelatedNotesSectionError() {
  useRelatedNotesMock.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    isPollingTimedOut: false,
    isRecommendationPolling: false,
    startRecommendationPolling: startRecommendationPollingMock,
  } as never);
}

function mockRecommendationRequest({
  isPending = false,
  isError = false,
  error = null,
}: {
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
} = {}) {
  useRequestRelatedNoteRecommendationMock.mockReturnValue({
    error,
    isError,
    isPending,
    mutate: mutateMock,
  } as never);
}

describe("RelatedNotesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRelatedNotesSectionData();
    mockRecommendationRequest();

    useInternalNavigationGuardMock.mockReturnValue({
      cancelNavigation: cancelNavigationMock,
      confirmNavigation: confirmNavigationMock,
      isNavigationPending: false,
    });

    useBeforeUnloadGuardMock.mockReturnValue(undefined);
  });

  it("AI 추천 버튼을 누르면 수동 추천 요청 mutation을 실행한다", () => {
    render(<RelatedNotesSection noteId={noteId} />);

    fireEvent.click(screen.getByRole("button", { name: "AI 추천" }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("request hook에 Claim polling 시작 callback을 전달한다", () => {
    render(<RelatedNotesSection noteId={noteId} />);

    expect(useRequestRelatedNoteRecommendationMock).toHaveBeenCalledWith(
      noteId,
      {
        onAccepted: startRecommendationPollingMock,
      },
    );
  });

  it("Server Action 요청 중이면 AI 추천 버튼을 비활성화하고 진행 상태를 표시한다", () => {
    mockRecommendationRequest({
      isPending: true,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(screen.getByText("관련 노트를 찾고 있어요")).toBeInTheDocument();
  });

  it("Claim polling 중이면 AI 추천 버튼을 비활성화하고 진행 상태를 표시한다", () => {
    mockRelatedNotesSectionData({
      isRecommendationPolling: true,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(screen.getByText("관련 노트를 찾고 있어요")).toBeInTheDocument();
  });

  it("AI 추천 execution이 running이면 AI 추천 버튼을 비활성화하고 진행 상태를 표시한다", () => {
    mockRelatedNotesSectionData({
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "running",
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(screen.getByText("관련 노트를 찾고 있어요")).toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("현재 Note version의 AI 추천 execution이 succeeded이면 버튼을 비활성화하고 최신 상태를 표시한다", () => {
    mockRelatedNotesSectionData({
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "succeeded",
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(screen.getByText("AI 추천이 최신 상태입니다.")).toBeInTheDocument();
  });

  it("현재 Note version에 성공한 execution이 없으면 AI 추천 버튼을 다시 사용할 수 있다", () => {
    mockRelatedNotesSectionData({
      latestRecommendationExecution: null,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
    expect(
      screen.queryByText("AI 추천이 최신 상태입니다."),
    ).not.toBeInTheDocument();
  });

  it("AI 추천 polling 시간이 초과되면 버튼을 비활성화하고 지연 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionData({
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "running",
      },
      isPollingTimedOut: true,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(
      screen.getByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트를 찾고 있어요"),
    ).not.toBeInTheDocument();
  });

  it("Server Action 요청이 실패하면 Action 오류 메시지를 표시한다", () => {
    mockRecommendationRequest({
      isError: true,
      error: new Error("관련 노트 추천 요청에 실패했습니다."),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("관련 노트 추천 요청에 실패했습니다."),
    ).toBeInTheDocument();
  });

  it("AI 추천 execution이 failed이면 실패 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionData({
      hasFailedRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "failed",
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("관련 노트 추천에 실패했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트를 찾고 있어요"),
    ).not.toBeInTheDocument();
  });

  it("일일 AI 추천 사용량이 있으면 사용량을 표시한다", () => {
    mockRelatedNotesSectionData({
      recommendationUsage: {
        used: 0,
        limit: 1,
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByText("오늘 0/1회 사용")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
  });

  it("일일 AI 추천 사용량이 제한에 도달하면 버튼을 비활성화하고 제한 안내와 사용량을 표시한다", () => {
    mockRelatedNotesSectionData({
      recommendationUsage: {
        used: 1,
        limit: 1,
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(
      screen.getByText("오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (1/1)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("오늘 1/1회 사용")).not.toBeInTheDocument();
  });

  it("일일 추천 제한에 도달했더라도 실행 중이면 실행 안내를 우선 표시한다", () => {
    mockRelatedNotesSectionData({
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "running",
      },
      recommendationUsage: {
        used: 1,
        limit: 1,
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByText("관련 노트를 찾고 있어요")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (1/1)",
      ),
    ).not.toBeInTheDocument();
  });

  it("일일 추천 제한에 도달했더라도 실행 실패 상태면 실패 안내를 우선 표시한다", () => {
    mockRelatedNotesSectionData({
      hasFailedRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "failed",
      },
      recommendationUsage: {
        used: 1,
        limit: 1,
      },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("관련 노트 추천에 실패했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (1/1)",
      ),
    ).not.toBeInTheDocument();
  });

  it("recommendationUsage가 null이면 일일 사용량을 표시하지 않는다", () => {
    mockRelatedNotesSectionData({
      recommendationUsage: null,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.queryByText(/오늘 \d+\/\d+회 사용/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/오늘은 이 노트의 AI 추천을 더 생성할 수 없어요/),
    ).not.toBeInTheDocument();
  });

  it("추천 요청 또는 실행 중에는 페이지 이탈 guard를 활성화한다", () => {
    mockRelatedNotesSectionData({
      isRecommendationPolling: true,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(useInternalNavigationGuardMock).toHaveBeenCalledWith({
      enabled: true,
    });
    expect(useBeforeUnloadGuardMock).toHaveBeenCalledWith({
      enabled: true,
    });
  });

  it("추천 요청과 실행이 없으면 페이지 이탈 guard를 비활성화한다", () => {
    render(<RelatedNotesSection noteId={noteId} />);

    expect(useInternalNavigationGuardMock).toHaveBeenCalledWith({
      enabled: false,
    });
    expect(useBeforeUnloadGuardMock).toHaveBeenCalledWith({
      enabled: false,
    });
  });

  it("Related Notes 조회에 실패하면 실패 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionError();

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("관련 노트를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("아직 연결된 관련 노트가 없습니다."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("AI 추천 실행이 끝나고 사용량이 없으면 빈 Related Notes 안내를 표시한다", () => {
    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.queryByText("관련 노트를 찾고 있어요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 추천에 실패했습니다."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("아직 연결된 관련 노트가 없습니다."),
    ).toBeInTheDocument();
  });
});
