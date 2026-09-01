import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashNoteContent } from "@/features/review/lib/contentHash";
import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOT_FOUND_ERROR = new Error("NEXT_NOT_FOUND");
const CONFIRMED_AT = "2026-01-01T00:00:00.000Z";

const {
  createClientMock,
  getGradingByReviewLogMock,
  getNoteContentForComparisonMock,
  getPendingReviewLogMock,
  getReviewableNoteMock,
  notFoundMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getGradingByReviewLogMock: vi.fn(),
  getNoteContentForComparisonMock: vi.fn(),
  getPendingReviewLogMock: vi.fn(),
  getReviewableNoteMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/review/queries", () => ({
  getGradingByReviewLog: getGradingByReviewLogMock,
  getNoteContentForComparison: getNoteContentForComparisonMock,
  getPendingReviewLog: getPendingReviewLogMock,
  getReviewableNote: getReviewableNoteMock,
}));

vi.mock("@/features/review/components/BlankTestPage", () => ({
  BlankTestPage: ({
    noteId,
    noteTitle,
    restoredSession,
    reviewRound,
  }: {
    noteId: string;
    noteTitle: string;
    restoredSession: {
      userAnswer: string;
      grading: { score: number };
      basisContentChanged: boolean;
    } | null;
    reviewRound: number;
  }) => (
    <div
      data-basis-changed={
        restoredSession ? String(restoredSession.basisContentChanged) : ""
      }
      data-restored={
        restoredSession
          ? `${restoredSession.userAnswer}|${restoredSession.grading.score}`
          : "none"
      }
      data-testid="blank-test-page"
    >
      {`${noteId}|${noteTitle}|${reviewRound}`}
    </div>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import NoteReviewPage from "./page";

function createSupabaseMock(
  userId: string | null,
  options?: { emailConfirmedAt?: string | null | undefined },
) {
  const emailConfirmedAt =
    options && Object.prototype.hasOwnProperty.call(options, "emailConfirmedAt")
      ? options.emailConfirmedAt
      : CONFIRMED_AT;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email_confirmed_at: emailConfirmedAt }
            : null,
        },
      }),
    },
  };
}

describe("NoteReviewPage", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getGradingByReviewLogMock.mockReset();
    getNoteContentForComparisonMock.mockReset();
    getPendingReviewLogMock.mockReset();
    getReviewableNoteMock.mockReset();
    notFoundMock.mockReset();
    redirectMock.mockReset();

    // 기본은 "복원할 채점 없음". 복원 흐름을 보는 테스트에서만 값을 채운다.
    getGradingByReviewLogMock.mockResolvedValue(null);

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    notFoundMock.mockImplementation(() => {
      throw NOT_FOUND_ERROR;
    });
  });

  it("redirects to login when the user is not authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(
      NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
    expect(getReviewableNoteMock).not.toHaveBeenCalled();
  });

  it("redirects to resend-email when the user has not confirmed email", async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock("user-123", { emailConfirmedAt: null }),
    );

    await expect(
      NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup`,
    );
    expect(getReviewableNoteMock).not.toHaveBeenCalled();
    expect(getPendingReviewLogMock).not.toHaveBeenCalled();
  });

  it("returns not found when the note does not exist for the current user", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue(null);
    getPendingReviewLogMock.mockResolvedValue(null);

    await expect(
      NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    ).rejects.toBe(NOT_FOUND_ERROR);

    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("renders an empty state when there is no pending review log", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: null,
      review_completed_at: "2026-01-07T00:00:00.000Z",
      review_round: 3,
    });
    getPendingReviewLogMock.mockResolvedValue(null);

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "이 노트는 모든 복습을 마쳤습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "노트로 돌아가기" }),
    ).toBeInTheDocument();
  });

  it("renders the completed state even when a pending review log is preserved", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-08T00:00:00.000Z",
      review_completed_at: "2026-01-07T00:00:00.000Z",
      review_round: 3,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      note_id: "11111111-1111-1111-1111-111111111111",
      round: 4,
      scheduled_at: "2026-01-08T00:00:00.000Z",
      completed_at: null,
    });

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "이 노트는 모든 복습을 마쳤습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("blank-test-page")).not.toBeInTheDocument();
    expect(getGradingByReviewLogMock).not.toHaveBeenCalled();
  });

  it("does not mark the note as completed when the next review is still scheduled", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-08T00:00:00.000Z",
      review_round: 3,
    });
    getPendingReviewLogMock.mockResolvedValue(null);

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "진행 중인 백지 테스트가 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "이 노트는 모든 복습을 마쳤습니다.",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the blank test page when a pending review exists", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-02T00:00:00.000Z",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      note_id: "11111111-1111-1111-1111-111111111111",
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(getReviewableNoteMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "user-123",
    );
    expect(getPendingReviewLogMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "user-123",
    );
    expect(screen.getByTestId("blank-test-page")).toHaveTextContent(
      "11111111-1111-1111-1111-111111111111|테스트 노트|1",
    );
    expect(
      screen.getByRole("navigation", { name: "breadcrumb" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "테스트 노트" })).toHaveAttribute(
      "href",
      "/notes/11111111-1111-1111-1111-111111111111",
    );
    expect(screen.getByText("백지 테스트")).toBeInTheDocument();
    expect(screen.getByTestId("blank-test-page")).toHaveAttribute(
      "data-restored",
      "none",
    );
  });

  it("restores the saved answer and grading when the round was already graded", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-02T00:00:00.000Z",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      note_id: "11111111-1111-1111-1111-111111111111",
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });
    getGradingByReviewLogMock.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      review_log_id: "22222222-2222-2222-2222-222222222222",
      round: 1,
      user_answer: "저장된 답안",
      score: 72,
      feedback: {
        summary: "저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
      created_at: "2026-01-02T01:00:00.000Z",
      graded_content_hash: hashNoteContent("원본 내용"),
    });
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "원본 내용",
    });

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(getGradingByReviewLogMock).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222",
      "user-123",
    );

    const blankTestPage = screen.getByTestId("blank-test-page");
    expect(blankTestPage).toHaveAttribute("data-restored", "저장된 답안|72");
    expect(blankTestPage).toHaveAttribute("data-basis-changed", "false");
  });

  // 채점 뒤 노트를 고치면 화면의 원본과 채점 기준이 갈린다. 그 사실을 화면에 넘겨야 한다.
  it("flags the restored grading when the note body changed after grading", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-02T00:00:00.000Z",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      note_id: "11111111-1111-1111-1111-111111111111",
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });
    getGradingByReviewLogMock.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      review_log_id: "22222222-2222-2222-2222-222222222222",
      round: 1,
      user_answer: "저장된 답안",
      score: 72,
      feedback: {
        summary: "저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
      created_at: "2026-01-02T01:00:00.000Z",
      graded_content_hash: hashNoteContent("채점 당시 원본"),
    });
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "수정된 원본",
    });

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(screen.getByTestId("blank-test-page")).toHaveAttribute(
      "data-basis-changed",
      "true",
    );
  });

  // 해시 도입 이전 채점은 기준 본문을 알 수 없다. 근거 없이 경고하지 않는다.
  it("does not flag a grading saved before the content hash existed", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-02T00:00:00.000Z",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      note_id: "11111111-1111-1111-1111-111111111111",
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });
    getGradingByReviewLogMock.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      review_log_id: "22222222-2222-2222-2222-222222222222",
      round: 1,
      user_answer: "저장된 답안",
      score: 72,
      feedback: {
        summary: "저장된 총평",
        missedConcepts: [],
        incorrectPoints: [],
      },
      created_at: "2026-01-02T01:00:00.000Z",
      graded_content_hash: null,
    });
    getNoteContentForComparisonMock.mockResolvedValue({
      content: "수정된 원본",
    });

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(screen.getByTestId("blank-test-page")).toHaveAttribute(
      "data-basis-changed",
      "false",
    );
  });

  // 복원은 부가 기능이다. 실패해도 백지 테스트 자체는 진행할 수 있어야 한다.
  it("falls back to the blank test page when restoring the saved grading fails", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      next_review_at: "2026-01-02T00:00:00.000Z",
      review_round: 0,
    });
    getPendingReviewLogMock.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      note_id: "11111111-1111-1111-1111-111111111111",
      round: 1,
      scheduled_at: "2026-01-02T00:00:00.000Z",
      completed_at: null,
    });
    getGradingByReviewLogMock.mockRejectedValue(new Error("grading lookup"));

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      await NoteReviewPage({
        params: Promise.resolve({
          noteId: "11111111-1111-1111-1111-111111111111",
        }),
      }),
    );

    expect(screen.getByTestId("blank-test-page")).toHaveAttribute(
      "data-restored",
      "none",
    );
    expect(getNoteContentForComparisonMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
