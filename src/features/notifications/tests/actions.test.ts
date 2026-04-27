import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "33333333-3333-4333-8333-333333333333";
const ENDPOINT = "https://push.example.test/subscription-id";
const CONFIRMED_AT = "2026-04-27T00:00:00.000Z";

const { createClientMock, redirectMock, revalidatePathMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    redirectMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import {
  markNotificationAsReadAction,
  setNotificationTimeAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "../actions";

function createSupabaseMock({
  userId = USER_ID,
  emailConfirmedAt = CONFIRMED_AT,
  upsertError = null,
  deleteError = null,
  rpcData = true,
  rpcError = null,
}: {
  userId?: string | null;
  emailConfirmedAt?: string | null;
  upsertError?: { message: string } | null;
  deleteError?: { message: string } | null;
  rpcData?: boolean | null;
  rpcError?: { message: string } | null;
} = {}) {
  const upsertMock = vi.fn().mockResolvedValue({ error: upsertError });
  const deleteUserEqMock = vi.fn().mockResolvedValue({ error: deleteError });
  const deleteEndpointEqMock = vi.fn().mockReturnValue({
    eq: deleteUserEqMock,
  });
  const deleteMock = vi.fn().mockReturnValue({
    eq: deleteEndpointEqMock,
  });
  const fromMock = vi.fn().mockReturnValue({
    upsert: upsertMock,
    delete: deleteMock,
  });
  const rpcMock = vi.fn().mockResolvedValue({
    data: rpcError ? null : rpcData,
    error: rpcError,
  });

  return {
    deleteEndpointEqMock,
    deleteMock,
    deleteUserEqMock,
    fromMock,
    rpcMock,
    upsertMock,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: userId
              ? { id: userId, email_confirmed_at: emailConfirmedAt }
              : null,
          },
        }),
      },
      from: fromMock,
      rpc: rpcMock,
    },
  };
}

function createPushSubscriptionInput() {
  return {
    endpoint: ENDPOINT,
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-secret",
    },
  };
}

describe("notification server actions", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a validation error without opening a Supabase client for an invalid subscription", async () => {
    const result = await subscribeToPushAction({ endpoint: "not-a-url" });

    expect(result).toEqual({
      success: false,
      error: "브라우저 구독 정보가 올바르지 않습니다.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("upserts a valid push subscription by endpoint", async () => {
    const { supabase, upsertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const result = await subscribeToPushAction(createPushSubscriptionInput());

    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_id: USER_ID,
        endpoint: ENDPOINT,
        p256dh: "p256dh-key",
        auth: "auth-secret",
      },
      { onConflict: "endpoint" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
    expect(result).toEqual({ success: true });
  });

  it("deletes the current user's matching push subscription", async () => {
    const { supabase, fromMock, deleteEndpointEqMock, deleteUserEqMock } =
      createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const result = await unsubscribeFromPushAction(ENDPOINT);

    expect(fromMock).toHaveBeenCalledWith("push_subscriptions");
    expect(deleteEndpointEqMock).toHaveBeenCalledWith("endpoint", ENDPOINT);
    expect(deleteUserEqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result).toEqual({ success: true });
  });

  it("calls the read RPC instead of updating notifications directly", async () => {
    const { supabase, fromMock, rpcMock } = createSupabaseMock({
      rpcData: true,
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await markNotificationAsReadAction(NOTIFICATION_ID);

    expect(rpcMock).toHaveBeenCalledWith("mark_notification_as_read", {
      p_notification_id: NOTIFICATION_ID,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, updated: true });
  });

  it("uses the notification time RPC default when clearing the override", async () => {
    const { supabase, rpcMock } = createSupabaseMock({ rpcData: null });
    createClientMock.mockResolvedValue(supabase);

    const result = await setNotificationTimeAction(NOTE_ID, null);

    expect(rpcMock).toHaveBeenCalledWith("update_notification_time_of_day", {
      p_note_id: NOTE_ID,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      getNoteDetailRoute(NOTE_ID),
    );
    expect(result).toEqual({ success: true });
  });

  it("returns a note validation error before setting notification time", async () => {
    const result = await setNotificationTimeAction("not-a-uuid", "09:30");

    expect(result).toEqual({
      success: false,
      error: "알림 대상을 찾을 수 없습니다.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a time validation error before setting notification time", async () => {
    const result = await setNotificationTimeAction(NOTE_ID, "24:00");

    expect(result).toEqual({
      success: false,
      error: "알림 시간이 올바르지 않습니다.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("redirects unverified users before mutating notification data", async () => {
    const { supabase, upsertMock } = createSupabaseMock({
      emailConfirmedAt: null,
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(
      subscribeToPushAction(createPushSubscriptionInput()),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(ROUTES.VERIFY_EMAIL);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
