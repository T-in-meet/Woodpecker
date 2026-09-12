import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getLegalAcceptanceRequiredPathMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    getLegalAcceptanceRequiredPathMock: vi.fn(),
  }),
);

vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceRequiredPath: getLegalAcceptanceRequiredPathMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import * as notificationsReadRoute from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTIFICATION_ID = "22222222-2222-4222-8222-222222222222";

/**
 * Creates the Supabase surface used by the notification read route.
 */
function createSupabaseMock({
  rpcData = true,
  rpcError = null,
  user = { id: USER_ID },
}: {
  rpcData?: boolean | null;
  rpcError?: { message: string } | null;
  user?: { id: string } | null;
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: rpcError ? null : rpcData,
      error: rpcError,
    }),
  };
}

/**
 * Creates a JSON request for the notification read route.
 */
function createReadRequest(body: unknown) {
  return new Request("http://localhost/api/notifications/read", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/notifications/read", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    getLegalAcceptanceRequiredPathMock.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks a non-review notification as read for the current user", async () => {
    const supabase = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const response = await notificationsReadRoute.POST(
      createReadRequest({
        notificationId: NOTIFICATION_ID,
        type: "FEEDBACK_REPLY",
      }),
    );

    await expect(response.json()).resolves.toEqual({ updated: true });
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("mark_notification_as_read", {
      p_notification_id: NOTIFICATION_ID,
    });
  });

  // 복습 알림도 확인으로 소비한다. 복습 완료를 기다리지 않는다.
  it("marks review notifications as read", async () => {
    const supabase = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);

    const response = await notificationsReadRoute.POST(
      createReadRequest({
        notificationId: NOTIFICATION_ID,
        type: "REVIEW",
      }),
    );

    await expect(response.json()).resolves.toEqual({ updated: true });
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("mark_notification_as_read", {
      p_notification_id: NOTIFICATION_ID,
    });
  });

  it("returns bad request for invalid input", async () => {
    const response = await notificationsReadRoute.POST(
      createReadRequest({
        notificationId: "not-a-uuid",
        type: "FEEDBACK_REPLY",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
    });
    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns unauthorized without a logged-in user", async () => {
    const supabase = createSupabaseMock({ user: null });
    createClientMock.mockResolvedValue(supabase);

    const response = await notificationsReadRoute.POST(
      createReadRequest({
        notificationId: NOTIFICATION_ID,
        type: "FEEDBACK_REPLY",
      }),
    );

    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("blocks the read RPC when current legal acceptance is missing", async () => {
    const supabase = createSupabaseMock();
    createClientMock.mockResolvedValue(supabase);
    getLegalAcceptanceRequiredPathMock.mockResolvedValue(
      "/agreements?redirect=%2Fmypage",
    );

    const response = await notificationsReadRoute.POST(
      createReadRequest({
        notificationId: NOTIFICATION_ID,
        type: "FEEDBACK_REPLY",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "legal_acceptance_required",
      redirectTo: "/agreements?redirect=%2Fmypage",
    });
    expect(response.status).toBe(403);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns an error when the read RPC fails", async () => {
    const error = { message: "rpc failed" };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = createSupabaseMock({ rpcError: error });
    createClientMock.mockResolvedValue(supabase);

    const response = await notificationsReadRoute.POST(
      createReadRequest({
        notificationId: NOTIFICATION_ID,
        type: "FEEDBACK_REPLY",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "notification_read_failed",
    });
    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith({
      event: "notifications.read.failed",
      error,
    });
  });
});
