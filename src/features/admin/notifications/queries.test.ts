import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";

const { requireAdminMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
}));

vi.mock("../utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

import { getAdminUnreadNotificationCounts } from "./queries";

const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
type QueryOptions = Parameters<typeof getAdminUnreadNotificationCounts>[0];
type SupabaseOption = NonNullable<NonNullable<QueryOptions>["supabase"]>;

function createSelectResult(data: unknown, error: unknown = null) {
  return { data, error };
}

function createSupabaseMock({
  events,
  reads,
  readsError = null,
}: {
  events: unknown[];
  reads: unknown[];
  readsError?: unknown;
}) {
  const eventsSelect = vi.fn().mockResolvedValue(createSelectResult(events));
  const readsEq = vi
    .fn()
    .mockResolvedValue(createSelectResult(reads, readsError));
  const readsSelect = vi.fn().mockReturnValue({ eq: readsEq });
  const from = vi.fn((table: string) => {
    if (table === "admin_notification_events") {
      return { select: eventsSelect };
    }

    if (table === "admin_notification_reads") {
      return { select: readsSelect };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    eventsSelect,
    from,
    readsEq,
    readsSelect,
    supabase: { from } as unknown as SupabaseOption,
  };
}

describe("getAdminUnreadNotificationCounts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireAdminMock.mockReset();
  });

  it("counts unread admin notifications by type", async () => {
    const { readsEq, supabase } = createSupabaseMock({
      events: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
        },
      ],
      reads: [
        {
          event_id: "33333333-3333-4333-8333-333333333333",
        },
      ],
    });

    const result = await getAdminUnreadNotificationCounts({
      adminUserId: ADMIN_USER_ID,
      supabase,
    });

    expect(result).toEqual({
      [ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED]: 1,
      [ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR]: 1,
    });
    expect(readsEq).toHaveBeenCalledWith("admin_user_id", ADMIN_USER_ID);
  });

  it("returns a sparse map when all notifications of a type are read", async () => {
    const { supabase } = createSupabaseMock({
      events: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
        },
      ],
      reads: [
        {
          event_id: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });

    const result = await getAdminUnreadNotificationCounts({
      adminUserId: ADMIN_USER_ID,
      supabase,
    });

    expect(result).toEqual({});
  });

  it("does not treat another admin user's read row as current admin read state", async () => {
    const { supabase } = createSupabaseMock({
      events: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
        },
      ],
      reads: [],
    });

    const result = await getAdminUnreadNotificationCounts({
      adminUserId: ADMIN_USER_ID,
      supabase,
    });

    expect(result).toEqual({
      [ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR]: 1,
    });
  });

  it("throws when read state lookup fails", async () => {
    const readsError = { message: "read lookup failed" };
    const { supabase } = createSupabaseMock({
      events: [],
      reads: [],
      readsError,
    });

    await expect(
      getAdminUnreadNotificationCounts({
        adminUserId: ADMIN_USER_ID,
        supabase,
      }),
    ).rejects.toBe(readsError);
  });
});
