import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";

import {
  OPERATIONAL_ERROR_OPERATIONS,
  OPERATIONAL_ERROR_SEVERITY,
} from "./constants";

const {
  createAdminNotificationMock,
  logErrorMock,
  recordOperationalErrorMock,
} = vi.hoisted(() => ({
  createAdminNotificationMock: vi.fn(),
  logErrorMock: vi.fn(),
  recordOperationalErrorMock: vi.fn(),
}));

vi.mock("@/features/notifications/create-admin-notification", () => ({
  createAdminNotification: createAdminNotificationMock,
}));

vi.mock("@/lib/logger", () => ({
  logError: logErrorMock,
}));

vi.mock("./record", () => ({
  recordOperationalError: recordOperationalErrorMock,
}));

import { reportOperationalError } from "./report";

const OPERATIONAL_ERROR_ID = "11111111-1111-4111-8111-111111111111";

describe("reportOperationalError", () => {
  beforeEach(() => {
    createAdminNotificationMock.mockReset();
    logErrorMock.mockReset();
    recordOperationalErrorMock.mockReset();
    createAdminNotificationMock.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      ok: true,
      targetAdminCount: 1,
    });
  });

  it("creates an admin notification when a WARN or ERROR operational error is created", async () => {
    recordOperationalErrorMock.mockResolvedValue({
      id: OPERATIONAL_ERROR_ID,
      ok: true,
      recorded: "created",
    });

    const result = await reportOperationalError({
      actorUserId: "33333333-3333-4333-8333-333333333333",
      errorCode: "PUSH_SEND_FAILED",
      feature: "notifications",
      message: "Push 알림 전송에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
      severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      stage: "push_send",
      userId: "44444444-4444-4444-8444-444444444444",
    });

    expect(result).toEqual({
      id: OPERATIONAL_ERROR_ID,
      ok: true,
      recorded: "created",
    });
    expect(createAdminNotificationMock).toHaveBeenCalledWith({
      body: "notifications / dispatch_push / push_send",
      clickPath: `/admin/operational-errors/${OPERATIONAL_ERROR_ID}`,
      createdBy: "33333333-3333-4333-8333-333333333333",
      metadata: {
        errorCode: "PUSH_SEND_FAILED",
        feature: "notifications",
        operation: OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
        operationalErrorId: OPERATIONAL_ERROR_ID,
        severity: OPERATIONAL_ERROR_SEVERITY.WARN,
        stage: "push_send",
      },
      pushEnabled: true,
      title: "Push 알림 전송에 실패했습니다.",
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });
  });

  it("does not create an admin notification when the operational error is aggregated", async () => {
    recordOperationalErrorMock.mockResolvedValue({
      id: OPERATIONAL_ERROR_ID,
      ok: true,
      recorded: "aggregated",
    });

    await reportOperationalError({
      errorCode: "PUSH_SEND_FAILED",
      feature: "notifications",
      message: "Push 알림 전송에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
      stage: "push_send",
    });

    expect(createAdminNotificationMock).not.toHaveBeenCalled();
  });

  it("does not create an admin notification for INFO severity", async () => {
    recordOperationalErrorMock.mockResolvedValue({
      id: OPERATIONAL_ERROR_ID,
      ok: true,
      recorded: "created",
    });

    await reportOperationalError({
      errorCode: "PUSH_SUBSCRIPTION_GONE",
      feature: "notifications",
      message: "만료된 Push 구독이 확인되었습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
      severity: OPERATIONAL_ERROR_SEVERITY.INFO,
      stage: "push_subscription_cleanup",
    });

    expect(createAdminNotificationMock).not.toHaveBeenCalled();
  });

  it("does not create a recursive admin notification for operational-error admin notification failures", async () => {
    recordOperationalErrorMock.mockResolvedValue({
      id: OPERATIONAL_ERROR_ID,
      ok: true,
      recorded: "created",
    });

    await reportOperationalError({
      errorCode: "PUSH_SEND_FAILED",
      feature: "notifications",
      message: "운영 오류 관리자 알림 Push 전송에 실패했습니다.",
      operation:
        OPERATIONAL_ERROR_OPERATIONS.CREATE_ADMIN_OPERATIONAL_ERROR_NOTIFICATION,
      severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      stage: "push_send",
    });

    expect(createAdminNotificationMock).not.toHaveBeenCalled();
  });

  it("keeps the original record result when admin notification creation throws", async () => {
    const expectedResult = {
      id: OPERATIONAL_ERROR_ID,
      ok: true,
      recorded: "created",
    } as const;
    const notificationError = new Error("admin notification failed");
    recordOperationalErrorMock.mockResolvedValue(expectedResult);
    createAdminNotificationMock.mockRejectedValue(notificationError);

    const result = await reportOperationalError({
      errorCode: "PUSH_SEND_FAILED",
      feature: "notifications",
      message: "Push 알림 전송에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.DISPATCH_PUSH,
      severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      stage: "push_send",
    });

    expect(result).toEqual(expectedResult);
    expect(logErrorMock).toHaveBeenCalledWith({
      error: notificationError,
      event: "operationalErrors.report.adminNotificationFailed",
      operationalErrorId: OPERATIONAL_ERROR_ID,
    });
  });
});
