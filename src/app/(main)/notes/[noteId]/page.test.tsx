import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteReviewRoute, ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const NOT_FOUND_ERROR = new Error("NEXT_NOT_FOUND");

const { createClientMock, getNoteByIdMock, notFoundMock, redirectMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    getNoteByIdMock: vi.fn(),
    notFoundMock: vi.fn(),
    redirectMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("@/features/notifications/components/NotificationTimePicker", () => ({
  NotificationTimePicker: ({
    initialTime,
    noteId,
  }: {
    initialTime: string | null;
    noteId: string;
  }) => (
    <div data-testid="notification-time-picker">
      {noteId}:{initialTime ?? "default"}
    </div>
  ),
}));

vi.mock("@/features/notes/queries", () => ({
  getNoteById: getNoteByIdMock,
}));

vi.mock("@/features/notes/components/NoteViewer", () => ({
  NoteViewer: ({ content }: { content: string }) => (
    <div data-testid="note-viewer">{content}</div>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
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

describe("NoteDetailPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));

    createClientMock.mockReset();
    getNoteByIdMock.mockReset();
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

      expect(redirectMock).toHaveBeenCalledWith(ROUTES.VERIFY_EMAIL);
      expect(getNoteByIdMock).not.toHaveBeenCalled();
    },
  );

  it("renders a review entry point when the note is due for review", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: "Test note",
      content: "note body",
      next_review_at: "2026-03-29T09:00:00.000Z",
      notification_time_of_day: "21:30:00",
      review_round: 1,
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T01:00:00.000Z",
      user_id: "user-123",
    });

    render(
      await NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    );

    expect(getNoteByIdMock).toHaveBeenCalledWith("note-123", "user-123");
    expect(
      screen.getByRole("heading", { name: "Test note" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("note-viewer")).toHaveTextContent("note body");
    expect(screen.getByTestId("notification-time-picker")).toHaveTextContent(
      "note-123:21:30:00",
    );
    expect(
      screen.getByText("지금 백지 테스트를 진행할 수 있습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "백지 테스트 시작" }),
    ).toHaveAttribute("href", getNoteReviewRoute("note-123"));
    expect(
      screen.getByRole("button", { name: "노트 삭제" }),
    ).toBeInTheDocument();
  });

  it("shows the next review schedule when the note is not due yet", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: "Future review note",
      content: "note body",
      next_review_at: "2026-03-30T09:00:00.000Z",
      notification_time_of_day: null,
      review_round: 1,
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T01:00:00.000Z",
      user_id: "user-123",
    });

    render(
      await NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    );

    expect(
      screen.getByText(
        "다음 백지 테스트가 예정되어 있습니다. 원하면 지금 미리 진행할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "백지 테스트 시작" }),
    ).toHaveAttribute("href", getNoteReviewRoute("note-123"));
  });

  it("shows a completed badge when the note finished every review round", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));
    getNoteByIdMock.mockResolvedValue({
      id: "note-123",
      title: "Completed note",
      content: "note body",
      next_review_at: null,
      notification_time_of_day: null,
      review_round: 3,
      created_at: "2026-03-29T00:00:00.000Z",
      updated_at: "2026-03-29T01:00:00.000Z",
      user_id: "user-123",
    });

    render(
      await NoteDetailPage({ params: Promise.resolve({ noteId: "note-123" }) }),
    );

    expect(screen.getByText("학습 완료")).toBeInTheDocument();
    expect(
      screen.getByText("1-3-7 복습을 모두 마쳤습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "백지 테스트 시작" }),
    ).not.toBeInTheDocument();
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
