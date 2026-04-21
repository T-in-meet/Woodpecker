import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const { createClientMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/features/notes/components/NoteForm", () => ({
  NoteForm: () => <div>note form</div>,
}));

import NewNotePage from "./page";

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

describe("NewNotePage", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    redirectMock.mockReset();

    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  it("redirects to login when the user is not authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    await expect(NewNotePage()).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it.each([null, undefined])(
    "redirects to verify email when email_confirmed_at is %s",
    async (emailConfirmedAt) => {
      createClientMock.mockResolvedValue(
        createSupabaseMock("user-123", emailConfirmedAt),
      );

      await expect(NewNotePage()).rejects.toBe(REDIRECT_ERROR);

      expect(redirectMock).toHaveBeenCalledWith(ROUTES.VERIFY_EMAIL);
    },
  );

  it("renders the note form when the user is authenticated", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock("user-123"));

    render(await NewNotePage());

    expect(screen.getByText("note form")).toBeInTheDocument();
  });
});
