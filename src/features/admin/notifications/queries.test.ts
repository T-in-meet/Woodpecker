import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";

const { requireAdminMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
}));

vi.mock("../utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

import {
  getAdminNotificationList,
  getAdminUnreadNotificationCounts,
} from "./queries";

const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
type QueryOptions = Parameters<typeof getAdminUnreadNotificationCounts>[0];
type SupabaseOption = NonNullable<NonNullable<QueryOptions>["supabase"]>;

function createRpcSupabaseMock(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });

  return {
    rpc,
    supabase: { rpc } as unknown as SupabaseOption,
  };
}

describe("getAdminUnreadNotificationCounts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireAdminMock.mockReset();
  });

  it("returns unread admin notification counts from the RPC result", async () => {
    const { rpc, supabase } = createRpcSupabaseMock([
      {
        type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
        unread_count: 2,
      },
      {
        type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
        unread_count: 1,
      },
    ]);

    const result = await getAdminUnreadNotificationCounts({
      adminUserId: ADMIN_USER_ID,
      supabase,
    });

    expect(result).toEqual({
      [ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED]: 1,
      [ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR]: 2,
    });
    expect(rpc).toHaveBeenCalledWith("get_admin_unread_notification_counts", {
      p_admin_user_id: ADMIN_USER_ID,
    });
  });

  it("returns a sparse map and ignores unsupported RPC rows", async () => {
    const { supabase } = createRpcSupabaseMock([
      {
        type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
        unread_count: 0,
      },
      {
        type: "UNKNOWN",
        unread_count: 10,
      },
    ]);

    const result = await getAdminUnreadNotificationCounts({
      adminUserId: ADMIN_USER_ID,
      supabase,
    });

    expect(result).toEqual({});
  });

  it("throws when the count RPC fails", async () => {
    const rpcError = { message: "count lookup failed" };
    const { supabase } = createRpcSupabaseMock(null, rpcError);

    await expect(
      getAdminUnreadNotificationCounts({
        adminUserId: ADMIN_USER_ID,
        supabase,
      }),
    ).rejects.toBe(rpcError);
  });
});

describe("getAdminNotificationList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireAdminMock.mockReset();
  });

  it("returns unread admin notifications as notification list items", async () => {
    const { rpc, supabase } = createRpcSupabaseMock([
      {
        body: "notifications / dispatch_push / push_send",
        click_path:
          "/admin/operational-errors/55555555-5555-4555-8555-555555555555",
        created_at: "2026-07-27T01:00:00.000Z",
        id: "22222222-2222-4222-8222-222222222222",
        title: "Push 알림 전송에 실패했습니다.",
        type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
      },
    ]);

    const result = await getAdminNotificationList({
      adminUserId: ADMIN_USER_ID,
      limit: 10,
      supabase,
    });

    expect(rpc).toHaveBeenCalledWith("get_admin_unread_notification_list", {
      p_admin_user_id: ADMIN_USER_ID,
      p_limit: 10,
    });
    expect(result).toEqual([
      {
        body: "notifications / dispatch_push / push_send",
        click_path:
          "/admin/operational-errors/55555555-5555-4555-8555-555555555555",
        id: "22222222-2222-4222-8222-222222222222",
        note_id: null,
        noteTitle: null,
        read_at: null,
        review_log_id: null,
        sent_at: "2026-07-27T01:00:00.000Z",
        source: "ADMIN",
        status: "SENT",
        title: "Push 알림 전송에 실패했습니다.",
        type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
      },
    ]);
  });

  it("normalizes the list limit before calling the RPC", async () => {
    const { rpc, supabase } = createRpcSupabaseMock([]);

    await getAdminNotificationList({
      adminUserId: ADMIN_USER_ID,
      limit: 100,
      supabase,
    });

    expect(rpc).toHaveBeenCalledWith("get_admin_unread_notification_list", {
      p_admin_user_id: ADMIN_USER_ID,
      p_limit: 50,
    });
  });
});
