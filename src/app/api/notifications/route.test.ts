import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  createClientMock,
  getAdminNotificationListMock,
  getAdminUnreadNotificationCountsMock,
  getNotificationListMock,
  getUnreadCountMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  getAdminNotificationListMock: vi.fn(),
  getAdminUnreadNotificationCountsMock: vi.fn(),
  getNotificationListMock: vi.fn(),
  getUnreadCountMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/notifications/queries", () => ({
  getNotificationList: getNotificationListMock,
  getUnreadCount: getUnreadCountMock,
}));

vi.mock("@/features/admin/notifications/queries", () => ({
  getAdminNotificationList: getAdminNotificationListMock,
  getAdminUnreadNotificationCounts: getAdminUnreadNotificationCountsMock,
}));

import * as notificationsRoute from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function createSupabaseMock(user: { id: string } | null = { id: USER_ID }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

function createAdminSupabaseMock(role: "ADMIN" | "USER" | null = "USER") {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: role ? { role } : null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return {
    eq,
    maybeSingle,
    select,
    supabase: {
      from: vi.fn().mockReturnValue({ select }),
    },
  };
}

describe("/api/notifications", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    createClientMock.mockReset();
    getAdminNotificationListMock.mockReset();
    getAdminUnreadNotificationCountsMock.mockReset();
    getNotificationListMock.mockReset();
    getUnreadCountMock.mockReset();
    createClientMock.mockResolvedValue(createSupabaseMock());
    createAdminClientMock.mockReturnValue(
      createAdminSupabaseMock("USER").supabase,
    );
    getAdminNotificationListMock.mockResolvedValue([]);
    getAdminUnreadNotificationCountsMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns bell notification items and unread count", async () => {
    const supabase = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    getNotificationListMock.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        sent_at: "2026-07-27T01:00:00.000Z",
        title: "복습할 시간이에요!",
      },
    ]);
    getUnreadCountMock.mockResolvedValue(1);

    const response = await notificationsRoute.GET();

    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          sent_at: "2026-07-27T01:00:00.000Z",
          title: "복습할 시간이에요!",
        },
      ],
      unreadCount: 1,
    });
    expect(response.status).toBe(200);
    expect(getNotificationListMock).toHaveBeenCalledWith({
      limit: 20,
      supabase,
      userId: USER_ID,
    });
    expect(getUnreadCountMock).toHaveBeenCalledWith({
      supabase,
      userId: USER_ID,
    });
    expect(getAdminNotificationListMock).not.toHaveBeenCalled();
    expect(getAdminUnreadNotificationCountsMock).not.toHaveBeenCalled();
  });

  it("merges admin notifications for admin users", async () => {
    const supabase = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    createAdminClientMock.mockReturnValue(
      createAdminSupabaseMock("ADMIN").supabase,
    );
    getNotificationListMock.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        sent_at: "2026-07-27T01:00:00.000Z",
        title: "개인 알림",
      },
    ]);
    getUnreadCountMock.mockResolvedValue(1);
    getAdminNotificationListMock.mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        sent_at: "2026-07-27T02:00:00.000Z",
        source: "ADMIN",
        title: "운영 오류 알림",
      },
    ]);
    getAdminUnreadNotificationCountsMock.mockResolvedValue({
      OPERATIONAL_ERROR: 2,
    });

    const response = await notificationsRoute.GET();

    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          sent_at: "2026-07-27T02:00:00.000Z",
          source: "ADMIN",
          title: "운영 오류 알림",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          sent_at: "2026-07-27T01:00:00.000Z",
          title: "개인 알림",
        },
      ],
      unreadCount: 3,
    });
    expect(response.status).toBe(200);
    expect(getAdminNotificationListMock).toHaveBeenCalledWith({
      adminUserId: USER_ID,
      limit: 20,
    });
    expect(getAdminUnreadNotificationCountsMock).toHaveBeenCalledWith({
      adminUserId: USER_ID,
    });
  });

  it("returns unauthorized when there is no logged-in user", async () => {
    createClientMock.mockResolvedValue(createSupabaseMock(null));

    const response = await notificationsRoute.GET();

    await expect(response.json()).resolves.toEqual({
      error: "unauthorized",
    });
    expect(response.status).toBe(401);
    expect(getNotificationListMock).not.toHaveBeenCalled();
    expect(getUnreadCountMock).not.toHaveBeenCalled();
  });

  it("logs and returns an error when notification lookup fails", async () => {
    const error = new Error("query failed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    getNotificationListMock.mockRejectedValue(error);
    getUnreadCountMock.mockResolvedValue(0);

    const response = await notificationsRoute.GET();

    await expect(response.json()).resolves.toEqual({
      error: "notifications_lookup_failed",
    });
    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith({
      event: "notifications.get.failed",
      error,
    });
  });
});
