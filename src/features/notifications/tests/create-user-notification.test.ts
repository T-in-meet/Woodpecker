import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";

const {
  createAdminClientMock,
  dispatchPushToUserMock,
  recordOperationalErrorMock,
  reportOperationalErrorMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  dispatchPushToUserMock: vi.fn(),
  recordOperationalErrorMock: vi.fn(),
  reportOperationalErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/features/operational-errors/record", () => ({
  recordOperationalError: recordOperationalErrorMock,
}));

vi.mock("@/features/operational-errors/report", () => ({
  reportOperationalError: reportOperationalErrorMock,
}));

vi.mock("../dispatch-push", () => ({
  dispatchPushToUser: dispatchPushToUserMock,
}));

import { createAdminNotification } from "../create-admin-notification";
import { createUserNotification } from "../create-user-notification";

function createInsertChain(result: unknown) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return {
    from: vi.fn().mockReturnValue({ insert }),
    insert,
    select,
    single,
  };
}

function createSelectEqChain(result: unknown) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });

  return {
    eq,
    select,
  };
}

describe("createUserNotification", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    dispatchPushToUserMock.mockReset();
    recordOperationalErrorMock.mockReset();
    reportOperationalErrorMock.mockReset();
  });

  it("creates an in-app notification", async () => {
    const supabase = createInsertChain({
      data: { id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    createAdminClientMock.mockReturnValue(supabase);

    const result = await createUserNotification({
      body: "답변이 등록되었습니다.",
      clickPath: "/mypage?feedbackId=feedback-id",
      metadata: { feedbackId: "feedback-id" },
      operation: "feedback_reply_notification",
      pushEnabled: false,
      title: "피드백 답변이 등록되었습니다.",
      type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
      userId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      ok: true,
    });
    expect(supabase.from).toHaveBeenCalledWith("notifications");
    expect(supabase.insert).toHaveBeenCalledWith({
      body: "답변이 등록되었습니다.",
      click_path: "/mypage?feedbackId=feedback-id",
      metadata: { feedbackId: "feedback-id" },
      note_id: null,
      review_log_id: null,
      status: NOTIFICATION_STATUS.SENT,
      title: "피드백 답변이 등록되었습니다.",
      type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
      user_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(reportOperationalErrorMock).not.toHaveBeenCalled();
  });

  it("keeps reserved push payload fields from being overridden by metadata", async () => {
    const supabase = createInsertChain({
      data: { id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    createAdminClientMock.mockReturnValue(supabase);
    dispatchPushToUserMock.mockResolvedValue({
      expiredSubscriptions: 0,
      failed: 0,
      sent: 1,
    });

    await createUserNotification({
      clickPath: "/mypage?feedbackId=feedback-id",
      metadata: {
        feedbackId: "feedback-id",
        notificationId: "metadata-notification-id",
        type: "metadata-type",
        url: "/metadata-url",
      },
      operation: "feedback_reply_notification",
      title: "피드백 답변이 등록되었습니다.",
      type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
      userId: "22222222-2222-4222-8222-222222222222",
    });

    expect(dispatchPushToUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feedbackId: "feedback-id",
          notificationId: "11111111-1111-4111-8111-111111111111",
          type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
          url: "/mypage?feedbackId=feedback-id",
        }),
      }),
      expect.any(Object),
    );
  });

  it("records an operational error when creation fails", async () => {
    const error = { message: "insert failed" };
    const supabase = createInsertChain({ data: null, error });
    createAdminClientMock.mockReturnValue(supabase);
    reportOperationalErrorMock.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      ok: true,
      recorded: "created",
    });

    const result = await createUserNotification({
      actorUserId: "44444444-4444-4444-8444-444444444444",
      clickPath: "/mypage?feedbackId=feedback-id",
      operation: "feedback_reply_notification",
      pushEnabled: false,
      title: "피드백 답변이 등록되었습니다.",
      type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
      userId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result).toEqual({ error, ok: false });
    expect(reportOperationalErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "44444444-4444-4444-8444-444444444444",
        error,
        errorCode: "NOTIFICATION_CREATE_FAILED",
        feature: "notifications",
        operation: "feedback_reply_notification",
        stage: "in_app_notification_create",
        userId: "22222222-2222-4222-8222-222222222222",
      }),
    );
  });
});

describe("createAdminNotification", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    dispatchPushToUserMock.mockReset();
    recordOperationalErrorMock.mockReset();
    reportOperationalErrorMock.mockReset();
  });

  it("keeps reserved admin push payload fields from being overridden by metadata", async () => {
    const eventChain = createInsertChain({
      data: { id: "55555555-5555-4555-8555-555555555555" },
      error: null,
    });
    const profilesChain = createSelectEqChain({
      data: [{ id: "11111111-1111-4111-8111-111111111111" }],
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table === "admin_notification_events") {
        return { insert: eventChain.insert };
      }

      return { select: profilesChain.select };
    });

    createAdminClientMock.mockReturnValue({ from });
    dispatchPushToUserMock.mockResolvedValue({
      expiredSubscriptions: 0,
      failed: 0,
      sent: 1,
    });

    const result = await createAdminNotification({
      clickPath: "/admin/feedbacks/feedback-id",
      feedbackId: "77777777-7777-4777-8777-777777777777",
      metadata: {
        adminNotificationEventId: "metadata-event-id",
        feedbackId: "feedback-id",
        type: "metadata-type",
        url: "/metadata-url",
      },
      title: "새 사용자 피드백이 등록되었습니다.",
      type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    });

    expect(result).toEqual({
      id: "55555555-5555-4555-8555-555555555555",
      ok: true,
      targetAdminCount: 1,
    });
    expect(eventChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback_id: "77777777-7777-4777-8777-777777777777",
      }),
    );
    expect(dispatchPushToUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminNotificationEventId: "55555555-5555-4555-8555-555555555555",
          feedbackId: "feedback-id",
          type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
          url: "/admin/feedbacks/feedback-id",
        }),
      }),
      expect.objectContaining({
        operation: "create_admin_feedback_notification",
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("stores null feedback_id for an operational error event", async () => {
    const eventChain = createInsertChain({
      data: { id: "55555555-5555-4555-8555-555555555555" },
      error: null,
    });
    const profilesChain = createSelectEqChain({ data: [], error: null });

    const from = vi.fn((table: string) => {
      if (table === "admin_notification_events") {
        return { insert: eventChain.insert };
      }

      if (table === "profiles") {
        return { select: profilesChain.select };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createAdminClientMock.mockReturnValue({ from });

    const result = await createAdminNotification({
      clickPath: "/admin/operational-errors/error-id",
      pushEnabled: false,
      title: "새 운영 오류가 기록되었습니다.",
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });

    expect(result).toEqual({
      id: "55555555-5555-4555-8555-555555555555",
      ok: true,
      targetAdminCount: 0,
    });

    expect(eventChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ feedback_id: null }),
    );
  });

  it("records an operational error when admin notification event creation fails", async () => {
    const insertError = { message: "event insert failed" };
    const eventChain = createInsertChain({
      data: null,
      error: insertError,
    });

    const from = vi.fn((table: string) => {
      if (table === "admin_notification_events") {
        return { insert: eventChain.insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    createAdminClientMock.mockReturnValue({ from });

    recordOperationalErrorMock.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      ok: true,
      recorded: "created",
    });

    const result = await createAdminNotification({
      clickPath: "/admin/feedbacks/feedback-id",
      createdBy: "44444444-4444-4444-8444-444444444444",
      feedbackId: "77777777-7777-4777-8777-777777777777",
      title: "새 사용자 피드백이 등록되었습니다.",
      type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    });

    expect(result).toEqual({
      error: insertError,
      failureStage: "in_app_notification_create",
      ok: false,
      operationalErrorRecorded: true,
    });

    expect(dispatchPushToUserMock).not.toHaveBeenCalled();

    expect(recordOperationalErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "44444444-4444-4444-8444-444444444444",
        context: {
          clickPath: "/admin/feedbacks/feedback-id",
          feedbackId: "77777777-7777-4777-8777-777777777777",
          notificationType: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
        },
        error: insertError,
        errorCode: "ADMIN_NOTIFICATION_CREATE_FAILED",
        feature: "notifications",
        message: "새 피드백 관리자 알림 생성에 실패했습니다.",
        operation: "create_admin_feedback_notification",
        stage: "in_app_notification_create",
      }),
    );
  });

  it("records an operational error when admin target lookup fails", async () => {
    const lookupError = { message: "profiles lookup failed" };
    const eventChain = createInsertChain({
      data: { id: "55555555-5555-4555-8555-555555555555" },
      error: null,
    });
    const profilesChain = createSelectEqChain({
      data: null,
      error: lookupError,
    });
    const from = vi.fn((table: string) => {
      if (table === "admin_notification_events") {
        return { insert: eventChain.insert };
      }

      return { select: profilesChain.select };
    });

    createAdminClientMock.mockReturnValue({ from });
    recordOperationalErrorMock.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      ok: true,
      recorded: "created",
    });

    const result = await createAdminNotification({
      clickPath: "/admin/feedbacks/feedback-id",
      createdBy: "44444444-4444-4444-8444-444444444444",
      feedbackId: "77777777-7777-4777-8777-777777777777",
      title: "새 사용자 피드백이 등록되었습니다.",
      type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    });

    expect(result).toEqual({
      error: lookupError,
      failureStage: "admin_notification_target_lookup",
      ok: false,
      operationalErrorRecorded: true,
    });
    expect(dispatchPushToUserMock).not.toHaveBeenCalled();
    expect(recordOperationalErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "44444444-4444-4444-8444-444444444444",
        context: {
          adminNotificationEventId: "55555555-5555-4555-8555-555555555555",
          clickPath: "/admin/feedbacks/feedback-id",
          feedbackId: "77777777-7777-4777-8777-777777777777",
          notificationType: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
        },
        error: lookupError,
        errorCode: "ADMIN_NOTIFICATION_TARGET_LOOKUP_FAILED",
        feature: "notifications",
        operation: "create_admin_feedback_notification",
        stage: "admin_notification_target_lookup",
      }),
    );
  });
});
