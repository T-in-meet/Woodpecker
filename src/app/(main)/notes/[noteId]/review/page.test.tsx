import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOT_FOUND_ERROR = new Error("NEXT_NOT_FOUND");

const {
  createClientMock,
  getPendingReviewLogMock,
  getReviewableNoteMock,
  notFoundMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getPendingReviewLogMock: vi.fn(),
  getReviewableNoteMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/review/queries", () => ({
  getPendingReviewLog: getPendingReviewLogMock,
  getReviewableNote: getReviewableNoteMock,
}));

vi.mock("@/features/review/components/BlankTestPage", () => ({
  BlankTestPage: ({
    noteId,
    noteTitle,
    reviewLogId,
    reviewRound,
  }: {
    noteId: string;
    noteTitle: string;
    reviewLogId: string;
    reviewRound: number;
  }) => (
    <div data-testid="blank-test-page">
      {`${noteId}|${noteTitle}|${reviewLogId}|${reviewRound}`}
    </div>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import NoteReviewPage from "./page";

function createSupabaseMock(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
  };
}

describe("NoteReviewPage", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getPendingReviewLogMock.mockReset();
    getReviewableNoteMock.mockReset();
    notFoundMock.mockReset();
    redirectMock.mockReset();

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
      language: "markdown",
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

  it("renders the blank test page when a pending review exists", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getReviewableNoteMock.mockResolvedValue({
      title: "테스트 노트",
      language: "markdown",
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
      "11111111-1111-1111-1111-111111111111|테스트 노트|22222222-2222-2222-2222-222222222222|1",
    );
  });
});
