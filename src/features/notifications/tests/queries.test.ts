import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const { createServerComponentClientMock } = vi.hoisted(() => ({
  createServerComponentClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerComponentClient: createServerComponentClientMock,
}));

import {
  getHasAnyPushSubscription,
  getNotificationList,
  getUnreadCount,
} from "../queries";

function withAuth<T extends Record<string, unknown>>(
  supabase: T,
  userId: string | null,
) {
  return {
    ...supabase,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
  };
}

function createUnreadCountMock(count: number | null) {
  const statusEqMock = vi.fn().mockResolvedValue({ count, error: null });
  const typeEqMock = vi.fn().mockReturnValue({
    eq: statusEqMock,
  });
  const userEqMock = vi.fn().mockReturnValue({
    eq: typeEqMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    eq: userEqMock,
  });

  return {
    selectMock,
    statusEqMock,
    typeEqMock,
    userEqMock,
    supabase: withAuth(
      {
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      },
      USER_ID,
    ),
  };
}

function createNotificationListMock(data: unknown) {
  const limitMock = vi.fn().mockResolvedValue({ data, error: null });
  const orderMock = vi.fn().mockReturnValue({
    limit: limitMock,
  });
  const statusEqMock = vi.fn().mockReturnValue({
    order: orderMock,
  });
  const typeEqMock = vi.fn().mockReturnValue({
    eq: statusEqMock,
  });
  const userEqMock = vi.fn().mockReturnValue({
    eq: typeEqMock,
  });
  const selectMock = vi.fn().mockReturnValue({
    eq: userEqMock,
  });

  return {
    limitMock,
    orderMock,
    selectMock,
    statusEqMock,
    typeEqMock,
    userEqMock,
    supabase: withAuth(
      {
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      },
      USER_ID,
    ),
  };
}

function createHasAnyPushSubscriptionMock({
  count,
  error = null,
}: {
  count: number | null;
  error?: { message: string } | null;
}) {
  const userEqMock = vi.fn().mockResolvedValue({ count, error });
  const selectMock = vi.fn().mockReturnValue({
    eq: userEqMock,
  });

  return {
    selectMock,
    userEqMock,
    supabase: withAuth(
      {
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      },
      USER_ID,
    ),
  };
}

describe("notification queries", () => {
  beforeEach(() => {
    createServerComponentClientMock.mockReset();
  });

  it("counts SENT notifications for the current user", async () => {
    const { supabase, selectMock, userEqMock, typeEqMock, statusEqMock } =
      createUnreadCountMock(3);
    createServerComponentClientMock.mockResolvedValue(supabase);

    const result = await getUnreadCount();

    expect(supabase.from).toHaveBeenCalledWith("notifications");
    expect(selectMock).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(userEqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(typeEqMock).toHaveBeenCalledWith("type", "REVIEW");
    expect(statusEqMock).toHaveBeenCalledWith(
      "status",
      NOTIFICATION_STATUS.SENT,
    );
    expect(result).toBe(3);
  });

  it("uses an injected user id without opening the RSC client", async () => {
    const { supabase } = createUnreadCountMock(1);

    await expect(getUnreadCount({ supabase, userId: USER_ID })).resolves.toBe(
      1,
    );

    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(createServerComponentClientMock).not.toHaveBeenCalled();
  });

  it("returns an empty unread count when there is no logged-in user", async () => {
    createServerComponentClientMock.mockResolvedValue(
      withAuth({ from: vi.fn() }, null),
    );

    await expect(getUnreadCount()).resolves.toBe(0);
  });

  it("returns notification list items with joined note titles", async () => {
    const {
      supabase,
      selectMock,
      userEqMock,
      typeEqMock,
      statusEqMock,
      orderMock,
      limitMock,
    } = createNotificationListMock([
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "복습할 시간이에요!",
        body: "Notification body",
        type: "REVIEW",
        status: NOTIFICATION_STATUS.SENT,
        sent_at: "2026-04-27T01:00:00.000Z",
        read_at: null,
        note_id: "33333333-3333-4333-8333-333333333333",
        review_log_id: "44444444-4444-4444-8444-444444444444",
        note: { title: "Joined note title" },
      },
    ]);
    createServerComponentClientMock.mockResolvedValue(supabase);

    const result = await getNotificationList({ limit: 100 });

    expect(selectMock).toHaveBeenCalledWith(
      "id, title, body, type, status, sent_at, read_at, note_id, review_log_id, note:notes(title)",
    );
    expect(userEqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(typeEqMock).toHaveBeenCalledWith("type", "REVIEW");
    expect(statusEqMock).toHaveBeenCalledWith(
      "status",
      NOTIFICATION_STATUS.SENT,
    );
    expect(orderMock).toHaveBeenCalledWith("sent_at", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "복습할 시간이에요!",
        body: "Notification body",
        type: "REVIEW",
        status: NOTIFICATION_STATUS.SENT,
        sent_at: "2026-04-27T01:00:00.000Z",
        read_at: null,
        note_id: "33333333-3333-4333-8333-333333333333",
        review_log_id: "44444444-4444-4444-8444-444444444444",
        noteTitle: "Joined note title",
      },
    ]);
  });

  it("throws when notification list rows do not match the expected schema", async () => {
    const { supabase } = createNotificationListMock([
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Review due",
        body: null,
        type: "UNKNOWN",
        status: "SENT",
        sent_at: "2026-04-27T01:00:00.000Z",
        read_at: null,
        note_id: "33333333-3333-4333-8333-333333333333",
        review_log_id: null,
        note: null,
      },
    ]);
    createServerComponentClientMock.mockResolvedValue(supabase);

    await expect(getNotificationList()).rejects.toThrow();
  });

  it("throws when a review notification list row has no note id", async () => {
    const { supabase } = createNotificationListMock([
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Review due",
        body: null,
        type: "REVIEW",
        status: "SENT",
        sent_at: "2026-04-27T01:00:00.000Z",
        read_at: null,
        note_id: null,
        review_log_id: null,
        note: null,
      },
    ]);
    createServerComponentClientMock.mockResolvedValue(supabase);

    await expect(getNotificationList()).rejects.toThrow();
  });

  it("returns whether the current user has any push subscription", async () => {
    const { supabase, selectMock, userEqMock } =
      createHasAnyPushSubscriptionMock({ count: 2 });
    createServerComponentClientMock.mockResolvedValue(supabase);

    const result = await getHasAnyPushSubscription();

    expect(supabase.from).toHaveBeenCalledWith("push_subscriptions");
    expect(selectMock).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(userEqMock).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result).toBe(true);
  });

  it("returns false when there is no logged-in user for push subscriptions", async () => {
    const supabase = withAuth({ from: vi.fn() }, null);
    createServerComponentClientMock.mockResolvedValue(supabase);

    await expect(getHasAnyPushSubscription()).resolves.toBe(false);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns false when the current user has no push subscriptions", async () => {
    const { supabase } = createHasAnyPushSubscriptionMock({ count: 0 });
    createServerComponentClientMock.mockResolvedValue(supabase);

    await expect(getHasAnyPushSubscription()).resolves.toBe(false);
  });

  it("throws when the push subscription query fails", async () => {
    const error = { message: "database unavailable" };
    const { supabase } = createHasAnyPushSubscriptionMock({
      count: null,
      error,
    });
    createServerComponentClientMock.mockResolvedValue(supabase);

    await expect(getHasAnyPushSubscription()).rejects.toMatchObject(error);
  });
});
