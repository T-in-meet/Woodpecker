import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
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

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import {
  checkPushSubscriptionOwnedAction,
  markNotificationAsReadAction,
  setNotificationScheduleAction,
  setNotificationTimeAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "../actions";
import { addDaysToDateKey, getKstDateKey } from "../lib/time";

function createSupabaseMock({
  userId = USER_ID,
  emailConfirmedAt = CONFIRMED_AT,
  upsertError = null,
  deleteError = null,
  selectCount = 0,
  selectError = null,
  rpcData = true,
  rpcError = null,
}: {
  userId?: string | null;
  emailConfirmedAt?: string | null;
  upsertError?: { message: string } | null;
  deleteError?: { message: string } | null;
  selectCount?: number | null;
  selectError?: { message: string } | null;
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
  const selectUserEqMock = vi
    .fn()
    .mockResolvedValue({ count: selectCount, error: selectError });
  const selectEndpointEqMock = vi.fn().mockReturnValue({
    eq: selectUserEqMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    eq: selectEndpointEqMock,
  });
  const fromMock = vi.fn().mockReturnValue({
    upsert: upsertMock,
    delete: deleteMock,
    select: selectMock,
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
    selectEndpointEqMock,
    selectMock,
    selectUserEqMock,
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

  it("upserts a valid push subscription endpoint through the current user session", async () => {
    const { supabase, fromMock, upsertMock } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const result = await subscribeToPushAction(createPushSubscriptionInput());

    expect(fromMock).toHaveBeenCalledWith("push_subscriptions");
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

  it("returns an error when RLS blocks claiming an endpoint owned by another user", async () => {
    const { supabase, upsertMock } = createSupabaseMock({
      upsertError: { message: "new row violates row-level security policy" },
    });
    createClientMock.mockResolvedValue(supabase);

    const result = await subscribeToPushAction(createPushSubscriptionInput());

    expect(upsertMock).toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error:
        "푸시 알림 구독에 실패했습니다. 브라우저 알림 구독을 해제한 뒤 다시 시도해주세요.",
    });
  });

  it("deletes only the current user's push subscription endpoint", async () => {
    const {
      supabase,
      fromMock,
      deleteMock,
      deleteEndpointEqMock,
      deleteUserEqMock,
    } = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const result = await unsubscribeFromPushAction(ENDPOINT);

    expect(fromMock).toHaveBeenCalledWith("push_subscriptions");
    expect(deleteMock).toHaveBeenCalled();
    expect(deleteEndpointEqMock).toHaveBeenCalledWith("endpoint", ENDPOINT);
    expect(deleteUserEqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(revalidatePathMock).toHaveBeenCalledWith(ROUTES.MYPAGE);
    expect(result).toEqual({ success: true });
  });

  it("requires authentication before unsubscribing", async () => {
    const { supabase } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const result = await unsubscribeFromPushAction(ENDPOINT);

    expect(result).toEqual({
      success: false,
      error: "로그인이 필요합니다.",
    });
  });

  it("reports ownership when the current user has a row for the endpoint", async () => {
    const {
      supabase,
      fromMock,
      selectMock,
      selectEndpointEqMock,
      selectUserEqMock,
    } = createSupabaseMock({ selectCount: 1 });
    createClientMock.mockResolvedValue(supabase);

    const result = await checkPushSubscriptionOwnedAction(ENDPOINT);

    expect(fromMock).toHaveBeenCalledWith("push_subscriptions");
    expect(selectMock).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(selectEndpointEqMock).toHaveBeenCalledWith("endpoint", ENDPOINT);
    expect(selectUserEqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result).toEqual({ owned: true });
  });

  it("reports non-ownership when no row matches the current user and endpoint", async () => {
    const { supabase } = createSupabaseMock({ selectCount: 0 });
    createClientMock.mockResolvedValue(supabase);

    const result = await checkPushSubscriptionOwnedAction(ENDPOINT);

    expect(result).toEqual({ owned: false });
  });

  it("returns owned:false for an invalid endpoint without opening a Supabase client", async () => {
    const result = await checkPushSubscriptionOwnedAction("not-a-url");

    expect(createClientMock).not.toHaveBeenCalled();
    expect(result).toEqual({ owned: false });
  });

  it("returns owned:false when the user is not authenticated", async () => {
    const { supabase } = createSupabaseMock({ userId: null });
    createClientMock.mockResolvedValue(supabase);

    const result = await checkPushSubscriptionOwnedAction(ENDPOINT);

    expect(result).toEqual({ owned: false });
  });

  it("calls the read RPC instead of updating notifications directly", async () => {
    const { supabase, fromMock, rpcMock } = createSupabaseMock({
      rpcData: true,
    });
    createClientMock.mockResolvedValue(supabase);

    const redirectPath = getNoteDetailRoute(NOTE_ID);
    const result = await markNotificationAsReadAction(
      NOTIFICATION_ID,
      redirectPath,
    );

    expect(requireCurrentLegalAcceptance).toHaveBeenCalledWith(
      USER_ID,
      redirectPath,
    );
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

    expect(requireCurrentLegalAcceptance).toHaveBeenCalledWith(
      USER_ID,
      getNoteDetailRoute(NOTE_ID),
    );
    expect(rpcMock).toHaveBeenCalledWith("update_notification_time_of_day", {
      p_note_id: NOTE_ID,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      getNoteDetailRoute(NOTE_ID),
    );
    expect(result).toEqual({ success: true });
  });

  it("moves the pending notification to the chosen KST date and time", async () => {
    const { supabase, rpcMock } = createSupabaseMock({ rpcData: null });
    createClientMock.mockResolvedValue(supabase);
    const targetDate = addDaysToDateKey(getKstDateKey(new Date()), 3);

    const result = await setNotificationScheduleAction(
      NOTE_ID,
      targetDate,
      "21:30",
    );

    expect(rpcMock).toHaveBeenCalledWith("update_notification_schedule", {
      p_note_id: NOTE_ID,
      p_scheduled_at: `${targetDate}T12:30:00.000Z`,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      getNoteDetailRoute(NOTE_ID),
    );
    expect(result).toEqual({ success: true });
  });

  it("allows moving a schedule one year ahead", async () => {
    const { supabase, rpcMock } = createSupabaseMock({ rpcData: null });
    createClientMock.mockResolvedValue(supabase);
    const longTermDate = addDaysToDateKey(getKstDateKey(new Date()), 365);

    const result = await setNotificationScheduleAction(
      NOTE_ID,
      longTermDate,
      "21:30",
    );

    expect(rpcMock).toHaveBeenCalledWith("update_notification_schedule", {
      p_note_id: NOTE_ID,
      p_scheduled_at: `${longTermDate}T12:30:00.000Z`,
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects a past date before calling supabase", async () => {
    const pastDate = addDaysToDateKey(getKstDateKey(new Date()), -1);

    const result = await setNotificationScheduleAction(
      NOTE_ID,
      pastDate,
      "21:30",
    );

    expect(result).toEqual({
      success: false,
      error: "오늘 이후 날짜로만 옮길 수 있습니다.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns a date validation error before moving the schedule", async () => {
    const result = await setNotificationScheduleAction(
      NOTE_ID,
      "2026-02-31",
      "21:30",
    );

    expect(result).toEqual({
      success: false,
      error: "알림 일정이 올바르지 않습니다.",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("explains that there is nothing left to reschedule", async () => {
    const { supabase } = createSupabaseMock({
      rpcError: { message: "no pending review log" },
    });
    createClientMock.mockResolvedValue(supabase);
    const targetDate = addDaysToDateKey(getKstDateKey(new Date()), 1);

    const result = await setNotificationScheduleAction(
      NOTE_ID,
      targetDate,
      "21:30",
    );

    expect(result).toEqual({
      success: false,
      error: "일정을 바꿀 복습이 없습니다.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // 발송이 진행 중일 때만 막힌다. 이미 나간 알림은 다시 옮길 수 있다.
  it("asks the user to retry while a dispatch is in flight", async () => {
    const { supabase } = createSupabaseMock({
      rpcError: { message: "notification dispatch in progress" },
    });
    createClientMock.mockResolvedValue(supabase);
    const targetDate = addDaysToDateKey(getKstDateKey(new Date()), 1);

    const result = await setNotificationScheduleAction(
      NOTE_ID,
      targetDate,
      "21:30",
    );

    expect(result).toEqual({
      success: false,
      error: "알림을 보내는 중입니다. 잠시 후 다시 시도해주세요.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("explains that a time earlier today can no longer be chosen", async () => {
    const { supabase } = createSupabaseMock({
      rpcError: { message: "schedule in the past" },
    });
    createClientMock.mockResolvedValue(supabase);
    const targetDate = getKstDateKey(new Date());

    const result = await setNotificationScheduleAction(
      NOTE_ID,
      targetDate,
      "00:01",
    );

    expect(result).toEqual({
      success: false,
      error: "이미 지난 시각으로는 옮길 수 없습니다.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
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
    const { supabase } = createSupabaseMock({
      emailConfirmedAt: null,
    });
    createClientMock.mockResolvedValue(supabase);

    await expect(
      subscribeToPushAction(createPushSubscriptionInput()),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(redirectMock).toHaveBeenCalledWith(
      `${ROUTES.RESEND_EMAIL}?purpose=signup`,
    );
  });
});
