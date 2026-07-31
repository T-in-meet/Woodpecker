import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";

import {
  markAdminNotificationsAsReadAction,
  markAllAdminNotificationsAsReadAction,
} from "./actions";

const { createAdminClientMock, requireAdminMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  requireAdminMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("../utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

function createSupabaseMock({
  events,
  eventsError = null,
  readsError = null,
}: {
  events: unknown[] | null;
  eventsError?: unknown;
  readsError?: unknown;
}) {
  const eventsSelectResult = {
    eq: vi.fn(),
    then: vi.fn(
      (resolve: (value: { data: unknown[] | null; error: unknown }) => void) =>
        resolve({ data: events, error: eventsError }),
    ),
  };
  const eventsClickPathEq = vi.fn().mockResolvedValue({
    data: events,
    error: eventsError,
  });
  const eventsTypeEq = vi.fn().mockReturnValue({
    eq: eventsClickPathEq,
  });
  eventsSelectResult.eq = eventsTypeEq;
  const eventsSelect = vi.fn().mockReturnValue({
    eq: eventsSelectResult.eq,
    then: eventsSelectResult.then,
  });
  const readsUpsert = vi.fn().mockResolvedValue({
    error: readsError,
  });
  const from = vi.fn((table: string) => {
    if (table === "admin_notification_events") {
      return {
        select: eventsSelect,
      };
    }

    if (table === "admin_notification_reads") {
      return {
        upsert: readsUpsert,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    eventsClickPathEq,
    eventsSelect,
    eventsSelectResult,
    eventsTypeEq,
    from,
    readsUpsert,
    supabase: { from },
  };
}

describe("markAdminNotificationsAsReadAction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createAdminClientMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue("admin-user-id");
  });

  it("marks matching admin notification events as read for the current admin", async () => {
    const supabaseMock = createSupabaseMock({
      events: [{ id: "event-1" }, { id: "event-2" }],
    });
    createAdminClientMock.mockReturnValue(supabaseMock.supabase);

    const result = await markAdminNotificationsAsReadAction({
      clickPath: "/admin/operational-errors/error-id",
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });

    expect(result).toEqual({ ok: true, updated: 2 });
    expect(supabaseMock.eventsSelect).toHaveBeenCalledWith("id");
    expect(supabaseMock.eventsTypeEq).toHaveBeenCalledWith(
      "type",
      ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    );
    expect(supabaseMock.eventsClickPathEq).toHaveBeenCalledWith(
      "click_path",
      "/admin/operational-errors/error-id",
    );
    expect(supabaseMock.readsUpsert).toHaveBeenCalledWith(
      [
        {
          admin_user_id: "admin-user-id",
          event_id: "event-1",
        },
        {
          admin_user_id: "admin-user-id",
          event_id: "event-2",
        },
      ],
      { onConflict: "event_id,admin_user_id" },
    );
  });

  it("returns success without upsert when there are no matching events", async () => {
    const supabaseMock = createSupabaseMock({
      events: [],
    });
    createAdminClientMock.mockReturnValue(supabaseMock.supabase);

    const result = await markAdminNotificationsAsReadAction({
      clickPath: "/admin/feedbacks/feedback-id",
      type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    });

    expect(result).toEqual({ ok: true, updated: 0 });
    expect(supabaseMock.readsUpsert).not.toHaveBeenCalled();
  });

  it("returns a validation error for an invalid target", async () => {
    const result = await markAdminNotificationsAsReadAction({
      clickPath: "",
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });

    expect(result).toEqual({
      message: "관리자 알림 대상이 올바르지 않습니다.",
      ok: false,
    });
    expect(requireAdminMock).not.toHaveBeenCalled();
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("returns an error when matching events cannot be loaded", async () => {
    const supabaseMock = createSupabaseMock({
      events: null,
      eventsError: { message: "lookup failed" },
    });
    createAdminClientMock.mockReturnValue(supabaseMock.supabase);

    const result = await markAdminNotificationsAsReadAction({
      clickPath: "/admin/operational-errors/error-id",
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });

    expect(result).toEqual({
      message: "관리자 알림 조회에 실패했습니다.",
      ok: false,
    });
    expect(supabaseMock.readsUpsert).not.toHaveBeenCalled();
  });

  it("returns an error when read state cannot be saved", async () => {
    const supabaseMock = createSupabaseMock({
      events: [{ id: "event-1" }],
      readsError: { message: "upsert failed" },
    });
    createAdminClientMock.mockReturnValue(supabaseMock.supabase);

    const result = await markAdminNotificationsAsReadAction({
      clickPath: "/admin/operational-errors/error-id",
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });

    expect(result).toEqual({
      message: "관리자 알림 읽음 처리에 실패했습니다.",
      ok: false,
    });
  });

  it("marks all admin notification events as read without touching user notifications", async () => {
    const supabaseMock = createSupabaseMock({
      events: [{ id: "event-1" }, { id: "event-2" }],
    });
    createAdminClientMock.mockReturnValue(supabaseMock.supabase);

    const result = await markAllAdminNotificationsAsReadAction();

    expect(result).toEqual({ ok: true, updated: 2 });
    expect(supabaseMock.from).toHaveBeenCalledWith("admin_notification_events");
    expect(supabaseMock.eventsSelect).toHaveBeenCalledWith("id");
    expect(supabaseMock.readsUpsert).toHaveBeenCalledWith(
      [
        {
          admin_user_id: "admin-user-id",
          event_id: "event-1",
        },
        {
          admin_user_id: "admin-user-id",
          event_id: "event-2",
        },
      ],
      { onConflict: "event_id,admin_user_id" },
    );
    expect(supabaseMock.from).not.toHaveBeenCalledWith("notifications");
  });

  it("returns success without upsert when there are no admin notification events", async () => {
    const supabaseMock = createSupabaseMock({
      events: [],
    });
    createAdminClientMock.mockReturnValue(supabaseMock.supabase);

    const result = await markAllAdminNotificationsAsReadAction();

    expect(result).toEqual({ ok: true, updated: 0 });
    expect(supabaseMock.readsUpsert).not.toHaveBeenCalled();
  });
});
