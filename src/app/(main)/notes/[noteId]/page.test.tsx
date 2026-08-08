import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { ROUTES } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/utils/formatDate";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOT_FOUND_ERROR = new Error("NEXT_NOT_FOUND");

type NoteDetailBodyProps = {
  noteId: string;
  title: string;
  content: string;
  reviewRound: number;
  isReviewCompleted: boolean;
  canStartReview: boolean;
  reviewStatusMessage: string;
  notificationTimeOfDay: string | null;
  nextScheduledAt: string | null;
};

const {
  createClientMock,
  getGradingsByNoteMock,
  getNoteByIdMock,
  hasCompletedReviewForNoteTodayMock,
  noteDetailBodyMock,
  notFoundMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getGradingsByNoteMock: vi.fn(),
  getNoteByIdMock: vi.fn(),
  hasCompletedReviewForNoteTodayMock: vi.fn(),
  noteDetailBodyMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

// 화면 렌더링은 NoteDetailBody.test.tsx가 검증한다.
// 이 테스트는 페이지가 인증·조회 결과를 어떤 props로 넘기는지에 집중한다.
vi.mock("@/features/notes/components/NoteDetailBody", () => ({
  NoteDetailBody: (props: NoteDetailBodyProps) => {
    noteDetailBodyMock(props);
    return <div data-testid="note-detail-body" />;
  },
}));

vi.mock("@/features/notes/queries", () => ({
  getNoteById: getNoteByIdMock,
}));

vi.mock("@/features/review/queries", () => ({
  getGradingsByNote: getGradingsByNoteMock,
  hasCompletedReviewForNoteToday: hasCompletedReviewForNoteTodayMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import NoteDetailPage from "./page";

function createSupabaseMock(
  userId: string | null,
  emailConfirmedAt?: string | null,
) {
  const resolvedEmailConfirmedAt =
    arguments.length > 1 ? emailConfirmedAt : "2026-03-29T00:00:00.000Z";

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email_confirmed_at: resolvedEmailConfirmedAt }
            : null,
        },
      }),
    },
  };
}

function createNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-123",
    title: "Test note",
    content: "note body",
    next_review_at: "2026-03-29T00:00:00.000Z",
    next_scheduled_at: "2026-03-29T09:00:00.000Z",
    notification_time_of_day: "21:30:00",
    review_round: 1,
    created_at: "2026-03-29T00:00:00.000Z",
    updated_at: "2026-03-29T01:00:00.000Z",
    user_id: "user-123",
    ...overrides,
  };
}

function lastBodyProps(): NoteDetailBodyProps {
  const call = noteDetailBodyMock.mock.calls.at(-1);
  if (!call) {
    throw new Error("NoteDetailBody가 렌더링되지 않았습니다.");
  }
  return call[0] as NoteDetailBodyProps;
}

async function renderPage(noteId = "note-123") {
  return render(await NoteDetailPage({ params: Promise.resolve({ noteId }) }));
}

describe("NoteDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));

    createClientMock.mockReset();
    getNoteByIdMock.mockReset();
    hasCompletedReviewForNoteTodayMock.mockReset();
    hasCompletedReviewForNoteTodayMock.mockResolvedValue(false);
    getGradingsByNoteMock.mockReset();
    getGradingsByNoteMock.mockResolvedValue([]);
    noteDetailBodyMock.mockReset();
    redirectMock.mockReset();
    notFoundMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    notFoundMock.mockImplementation(() => {
      throw NOT_FOUND_ERROR;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redirects to login when the user is not authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(
      NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getNoteByIdMock).not.toHaveBeenCalled();
  });

  it.each([null, undefined])(
    "redirects to verify email when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      createClientMock.mockResolvedValue(
        createSupabaseMock("user-123", emailConfirmedAt),
      );

      await expect(
        NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
      ).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(
        `${ROUTES.RESEND_EMAIL}?purpose=signup`,
      );
      expect(getNoteByIdMock).not.toHaveBeenCalled();
    },
  );

  it("allows starting a review when the notification time has passed", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(createNote());

    await renderPage();

    expect(getNoteByIdMock).toHaveBeenCalledWith("note-123", "user-123");
    expect(lastBodyProps()).toMatchObject({
      noteId: "note-123",
      title: "Test note",
      content: "note body",
      reviewRound: 1,
      isReviewCompleted: false,
      canStartReview: true,
      reviewStatusMessage: "지금 백지 테스트를 진행할 수 있습니다.",
      notificationTimeOfDay: "21:30:00",
      nextScheduledAt: "2026-03-29T09:00:00.000Z",
    });
  });

  it("renders a breadcrumb linking back to home and the notes list", async () => {
    // 공백이 없어 줄바꿈으로 도망갈 수 없는 제목. truncate가 빠지면 breadcrumb 줄을 밀어버린다.
    const longTitle =
      "SupabaseRowLevelSecurityPolicyMigrationChecklistForNoteReviewSchedulingRpcAndPartialUniqueIndexes";
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: longTitle,
      content: "note body",
      next_review_at: "2026-03-29T00:00:00.000Z",
      next_scheduled_at: "2026-03-29T09:00:00.000Z",
      notification_time_of_day: "21:30:00",
      review_round: 1,
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T01:00:00.000Z",
      user_id: "user-123",
    });

    render(
      await NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    );

    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(
      within(breadcrumb).getByRole("link", { name: "홈" }),
    ).toHaveAttribute("href", ROUTES.HOME);
    expect(
      within(breadcrumb).getByRole("link", { name: "노트 목록" }),
    ).toHaveAttribute("href", ROUTES.NOTES);

    // 마지막 항목은 링크가 아닌 현재 위치이며, 잘린 제목 대신 title로 전체 제목을 노출한다.
    const currentPage = within(breadcrumb).getByText(longTitle);
    expect(currentPage).toHaveAttribute("aria-current", "page");
    expect(currentPage).toHaveAttribute("title", longTitle);
    expect(currentPage).toHaveClass("truncate");
  });

  it("shows '다음 예정' (not 'due now') when notification time is still in the future today", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(
      createNote({
        title: "Same-day, before notification",
        next_scheduled_at: "2026-03-29T18:00:00.000Z",
        notification_time_of_day: "03:00:00",
      }),
    );

    await renderPage();

    expect(lastBodyProps()).toMatchObject({
      canStartReview: true,
      reviewStatusMessage: `다음 예정: ${formatDateTime(
        "2026-03-29T18:00:00.000Z",
      )}`,
    });
  });

  it("shows the next review schedule using the actual notification time", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(
      createNote({
        title: "Future review note",
        next_review_at: "2026-03-30T15:00:00.000Z",
        next_scheduled_at: "2026-03-30T01:00:00.000Z",
        notification_time_of_day: "10:00:00",
      }),
    );

    await renderPage();

    expect(lastBodyProps()).toMatchObject({
      canStartReview: true,
      reviewStatusMessage: `다음 예정: ${formatDateTime(
        "2026-03-30T01:00:00.000Z",
      )}`,
    });
  });

  it("blocks a new review and reflects the daily limit when already completed today", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(
      createNote({
        title: "Already done today",
        next_review_at: "2026-03-30T15:00:00.000Z",
        next_scheduled_at: "2026-03-30T09:00:00.000Z",
        notification_time_of_day: null,
      }),
    );
    hasCompletedReviewForNoteTodayMock.mockResolvedValue(true);

    await renderPage();

    expect(lastBodyProps()).toMatchObject({
      canStartReview: false,
      reviewStatusMessage: `오늘 백지 테스트 완료. 다음 예정: ${formatDateTime(
        "2026-03-30T09:00:00.000Z",
      )}`,
    });
  });

  it("falls back to allowing review when the daily-completion lookup fails", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(
      createNote({
        title: "Future review note",
        next_review_at: "2026-03-30T09:00:00.000Z",
        next_scheduled_at: "2026-03-30T09:00:00.000Z",
        notification_time_of_day: null,
      }),
    );
    hasCompletedReviewForNoteTodayMock.mockRejectedValue(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await renderPage();

    expect(lastBodyProps()).toMatchObject({ canStartReview: true });
    errorSpy.mockRestore();
  });

  it("marks the note completed when every review round is finished", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(
      createNote({
        title: "Completed note",
        next_review_at: null,
        next_scheduled_at: null,
        notification_time_of_day: null,
        review_round: MAX_REVIEW_ROUND,
      }),
    );

    await renderPage();

    expect(lastBodyProps()).toMatchObject({
      isReviewCompleted: true,
      canStartReview: false,
      reviewStatusMessage: "1-3-7 복습을 모두 마쳤습니다.",
      nextScheduledAt: null,
    });
    expect(hasCompletedReviewForNoteTodayMock).not.toHaveBeenCalled();
  });

  it("returns not found when the note does not exist for the current user", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue(null);

    await expect(
      NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    ).rejects.toBe(NOT_FOUND_ERROR);

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
