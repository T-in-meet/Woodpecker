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

/** Related Notes 컴포넌트 테스트용 quota 상태입니다. */
type RecommendationQuota = {
  canRequestForNote: boolean;
  isNoteLimitReached: boolean;
  isUserLimitReached: boolean;
  noteLimit: number;
  userLimit: number;
  userUsed: number | null;
};

/** Related Notes 컴포넌트 테스트용 quota 조회 상태입니다. */
type RecommendationQuotaState =
  | {
      status: "available";
      quota: RecommendationQuota;
    }
  | { status: "not_applicable" }
  | { status: "unavailable" };

type MockRelatedNotesSectionDataOptions = {
  hasRunningRecommendationExecution?: boolean;
  hasFailedRecommendationExecution?: boolean;
  latestRecommendationExecution?: {
    id: string;
    status: ExecutionStatus;
  } | null;
  isRecommendationPolling?: boolean;
  recommendationQuota?: RecommendationQuotaState;
  relatedNotes?: Array<{ noteId: string; title: string }>;
};

/** 필요한 quota 필드만 덮어쓸 수 있는 기본 테스트 값을 만듭니다. */
function createRecommendationQuota(
  overrides: Partial<RecommendationQuota> = {},
): RecommendationQuotaState {
  return {
    status: "available",
    quota: {
      canRequestForNote: true,
      isNoteLimitReached: false,
      isUserLimitReached: false,
      noteLimit: 1,
      userLimit: 10,
      userUsed: 0,
      ...overrides,
    },
  };
}

function mockRelatedNotesSectionData({
  hasRunningRecommendationExecution = false,
  hasFailedRecommendationExecution = false,
  latestRecommendationExecution = null,
  isRecommendationPolling = false,
  recommendationQuota = { status: "not_applicable" },
  relatedNotes = [],
}: MockRelatedNotesSectionDataOptions = {}) {
  useRelatedNotesMock.mockReturnValue({
    data: {
      hasFailedRecommendationExecution,
      hasRunningRecommendationExecution,
      latestRecommendationExecution,
      recommendationQuota,
      relatedNotes,
    },
    isError: false,
    isLoading: false,
    isRecommendationPolling,
    startRecommendationPolling: startRecommendationPollingMock,
  } as never);
}

function mockRelatedNotesSectionError() {
  useRelatedNotesMock.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
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
    expect(screen.getByText("관련 노트를 찾고 있어요...")).toBeInTheDocument();
  });

  it("Claim polling 중이면 AI 추천 버튼을 비활성화하고 진행 상태를 표시한다", () => {
    mockRelatedNotesSectionData({
      isRecommendationPolling: true,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(screen.getByText("관련 노트를 찾고 있어요...")).toBeInTheDocument();
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
    expect(screen.getByText("관련 노트를 찾고 있어요...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("현재 Note version의 AI 추천 execution이 succeeded이면 Note 할당량 소진보다 최신 상태를 우선 표시한다", () => {
    mockRelatedNotesSectionData({
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "succeeded",
      },
      recommendationQuota: createRecommendationQuota({
        canRequestForNote: false,
        isNoteLimitReached: true,
        userUsed: 1,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(screen.getByText("최신 상태 · 오늘 1/10회")).toBeInTheDocument();
    expect(screen.queryByText(/오늘 추천 완료/)).not.toBeInTheDocument();
  });

  it("현재 Note version에 성공한 execution이 없으면 AI 추천 버튼을 다시 사용할 수 있다", () => {
    mockRelatedNotesSectionData({
      latestRecommendationExecution: null,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
    expect(screen.queryByText(/최신 상태/)).not.toBeInTheDocument();
  });

  it("AI 추천 execution이 stale로 복구되면 AI 추천 버튼을 다시 사용할 수 있다", () => {
    mockRelatedNotesSectionData({
      hasRunningRecommendationExecution: false,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "stale",
      },
      isRecommendationPolling: false,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
    expect(
      screen.queryByText(/관련 노트를 찾고 있어요/),
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
      screen.queryByText(/관련 노트를 찾고 있어요/),
    ).not.toBeInTheDocument();
  });

  it("AI 추천을 요청할 수 있으면 사용자 전체 일일 사용량과 추천 가능 상태를 표시한다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: createRecommendationQuota({
        userUsed: 4,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByText("추천 가능 · 오늘 4/10회")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
  });

  it("구 DB fallback에서는 Note 추천 가능 여부를 유지하고 알 수 없는 사용자 전체 사용량은 표시하지 않는다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: createRecommendationQuota({
        userUsed: null,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByText("추천 가능")).toBeInTheDocument();
    expect(screen.queryByText(/오늘 \d+\/10회/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
  });

  it("TypeScript 표시 상수와 다른 서버 한도도 서버 판정과 반환값을 기준으로 표시한다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: createRecommendationQuota({
        userLimit: 20,
        userUsed: 10,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
    expect(screen.getByText("추천 가능 · 오늘 10/20회")).toBeInTheDocument();
    expect(screen.queryByText(/오늘 할당량 소진/)).not.toBeInTheDocument();
  });

  it("현재 Note의 일일 추천 할당량을 소진하면 버튼을 비활성화하고 오늘 추천 완료 상태와 사용자 전체 사용량을 표시한다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: createRecommendationQuota({
        canRequestForNote: false,
        isNoteLimitReached: true,
        userUsed: 1,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(
      screen.getByText("오늘 추천 완료 · 오늘 1/10회"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/오늘 할당량 소진/)).not.toBeInTheDocument();
  });

  it("사용자 전체 일일 추천 할당량을 소진하면 버튼을 비활성화하고 오늘 할당량 소진 상태와 사용량을 표시한다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: createRecommendationQuota({
        canRequestForNote: false,
        isUserLimitReached: true,
        userUsed: 10,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(
      screen.getByText("오늘 할당량 소진 · 오늘 10/10회"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/오늘 추천 완료/)).not.toBeInTheDocument();
  });

  it("사용자 전체 일일 추천 할당량 소진은 최신 상태보다 우선 표시한다", () => {
    mockRelatedNotesSectionData({
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "succeeded",
      },
      recommendationQuota: createRecommendationQuota({
        canRequestForNote: false,
        isUserLimitReached: true,
        userUsed: 10,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("오늘 할당량 소진 · 오늘 10/10회"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/최신 상태/)).not.toBeInTheDocument();
  });

  it("일일 추천 제한에 도달했더라도 실행 중이면 실행 안내를 우선 표시한다", () => {
    mockRelatedNotesSectionData({
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "running",
      },
      recommendationQuota: createRecommendationQuota({
        canRequestForNote: false,
        isNoteLimitReached: true,
        userUsed: 1,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("관련 노트를 찾고 있어요... · 오늘 1/10회"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/오늘 추천 완료/)).not.toBeInTheDocument();
  });

  it("일일 추천 제한에 도달했더라도 실행 실패 상태면 실패 안내를 우선 표시한다", () => {
    mockRelatedNotesSectionData({
      hasFailedRecommendationExecution: true,
      latestRecommendationExecution: {
        id: executionClaimId,
        status: "failed",
      },
      recommendationQuota: createRecommendationQuota({
        canRequestForNote: false,
        isNoteLimitReached: true,
        userUsed: 1,
      }),
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(
      screen.getByText("관련 노트 추천에 실패했습니다. · 오늘 1/10회"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/오늘 추천 완료/)).not.toBeInTheDocument();
  });

  it("긴 요청 오류와 quota 문구에 축소 및 줄바꿈 가능한 스타일을 적용한다", () => {
    const longErrorMessage =
      "관련 노트 추천 요청에 실패했습니다. 잠시 후 다시 시도해주세요.";

    mockRelatedNotesSectionData({
      recommendationQuota: createRecommendationQuota({
        userUsed: 4,
      }),
    });
    mockRecommendationRequest({
      error: new Error(longErrorMessage),
      isError: true,
    });

    render(<RelatedNotesSection noteId={noteId} />);

    const status = screen.getByText(`${longErrorMessage} · 오늘 4/10회`);

    expect(status).toHaveClass("min-w-0", "max-w-full", "break-words");
    expect(status.parentElement).toHaveClass("min-w-0");
    expect(status.parentElement).not.toHaveClass("shrink-0");
    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
  });

  it("ADMIN quota 미적용 상태는 추천 버튼을 막거나 일일 추천 상태를 표시하지 않는다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: { status: "not_applicable" },
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.queryByText(/추천 가능/)).not.toBeInTheDocument();
    expect(screen.queryByText(/오늘 추천 완료/)).not.toBeInTheDocument();
    expect(screen.queryByText(/오늘 할당량 소진/)).not.toBeInTheDocument();
    expect(screen.queryByText(/오늘 \d+\/10회/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 추천" })).toBeEnabled();
  });

  it("일반 사용자 quota를 확인하지 못하면 목록을 유지하고 추천 버튼을 비활성화한다", () => {
    mockRelatedNotesSectionData({
      recommendationQuota: { status: "unavailable" },
      relatedNotes: [
        {
          noteId: "22222222-2222-4222-8222-222222222222",
          title: "기존 관련 노트",
        },
      ],
    });

    render(<RelatedNotesSection noteId={noteId} />);

    expect(screen.getByText("기존 관련 노트")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 추천" })).toBeDisabled();
    expect(
      screen.getByText(
        "AI 추천 가능 여부를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ),
    ).toBeInTheDocument();
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
      screen.queryByText(/관련 노트를 찾고 있어요/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/관련 노트 추천에 실패했습니다/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("아직 연결된 관련 노트가 없습니다."),
    ).toBeInTheDocument();
  });
});
