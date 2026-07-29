import { beforeEach, describe, expect, it, vi } from "vitest";

import { OPERATIONAL_ERROR_SEVERITY } from "../constants";
import { recordOperationalError } from "../record";

const { logErrorMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: logErrorMock,
}));

function createLookupBuilder(result: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createInsertBuilder(result: unknown) {
  const builder = {
    insert: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(() => builder),
  };

  return builder;
}

describe("recordOperationalError", () => {
  beforeEach(() => {
    logErrorMock.mockReset();
  });

  it("creates a new operational error with sanitized context", async () => {
    const lookupBuilder = createLookupBuilder({ data: null, error: null });
    const insertBuilder = createInsertBuilder({
      data: { id: "error-id" },
      error: null,
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(insertBuilder),
    };

    const result = await recordOperationalError(
      {
        context: {
          entities: { feedbackId: "feedback-id" },
          push: {
            auth: "auth-secret",
            endpoint: "https://push.example.test/subscription",
            p256dh: "p256dh-secret",
          },
        },
        errorCode: "NOTIFICATION_CREATE_FAILED",
        feature: "notifications",
        message: "알림 생성에 실패했습니다.",
        operation: "create_user_notification",
        severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: "in_app_notification_create",
        userId: "user-id",
      },
      { supabase },
    );

    expect(result).toEqual({
      id: "error-id",
      ok: true,
      recorded: "created",
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          entities: { feedbackId: "feedback-id" },
          push: {
            auth: "[Redacted]",
            endpoint: "[Redacted]",
            p256dh: "[Redacted]",
          },
        },
        error_code: "NOTIFICATION_CREATE_FAILED",
        fingerprint: expect.any(String),
        status: "OPEN",
      }),
    );
  });

  it("aggregates an existing OPEN error with the same fingerprint", async () => {
    const lookupBuilder = createLookupBuilder({
      data: { id: "existing-id" },
      error: null,
    });
    const rpcMock = vi.fn().mockResolvedValue({
      data: "existing-id",
      error: null,
    });
    const supabase = {
      from: vi.fn().mockReturnValueOnce(lookupBuilder),
      rpc: rpcMock,
    };

    const result = await recordOperationalError(
      {
        errorCode: "PUSH_SEND_FAILED",
        feature: "notifications",
        message: "Push 전송에 실패했습니다.",
        operation: "dispatch_push",
        stage: "push_send",
      },
      { supabase },
    );

    expect(result).toEqual({
      id: "existing-id",
      ok: true,
      recorded: "aggregated",
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "increment_operational_error_occurrence",
      expect.objectContaining({
        p_id: "existing-id",
        p_message: "Push 전송에 실패했습니다.",
        p_severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      }),
    );
  });

  it("masks token-like strings in Error message and stack", async () => {
    const lookupBuilder = createLookupBuilder({ data: null, error: null });
    const insertBuilder = createInsertBuilder({
      data: { id: "error-id" },
      error: null,
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(lookupBuilder)
        .mockReturnValueOnce(insertBuilder),
    };
    const error = new Error(
      "request failed with Bearer secret-token and sb_service_role_secret",
    );
    error.stack =
      "Error: failed eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";

    await recordOperationalError(
      {
        error,
        errorCode: "PUSH_SEND_FAILED",
        feature: "notifications",
        message: "Push 전송에 실패했습니다.",
        operation: "dispatch_push",
        stage: "push_send",
      },
      { supabase },
    );

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          error: {
            message: "request failed with Bearer [Redacted] and [Redacted]",
            name: "Error",
            stack: "Error: failed [Redacted]",
          },
        },
      }),
    );
  });

  it("retries a unique violation once before falling back to logger", async () => {
    const uniqueViolation = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    };
    const firstLookupBuilder = createLookupBuilder({
      data: null,
      error: null,
    });
    const secondLookupBuilder = createLookupBuilder({
      data: null,
      error: null,
    });
    const firstInsertBuilder = createInsertBuilder({
      data: null,
      error: uniqueViolation,
    });
    const secondInsertBuilder = createInsertBuilder({
      data: null,
      error: uniqueViolation,
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(firstLookupBuilder)
        .mockReturnValueOnce(firstInsertBuilder)
        .mockReturnValueOnce(secondLookupBuilder)
        .mockReturnValueOnce(secondInsertBuilder),
    };

    const result = await recordOperationalError(
      {
        errorCode: "PUSH_SEND_FAILED",
        feature: "notifications",
        message: "Push 전송에 실패했습니다.",
        operation: "dispatch_push",
        stage: "push_send",
      },
      { supabase },
    );

    expect(result.ok).toBe(false);
    expect(supabase.from).toHaveBeenCalledTimes(4);
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: uniqueViolation,
        event: "operationalErrors.record.failed",
      }),
    );
  });

  it("falls back to logger when recording fails", async () => {
    const lookupBuilder = createLookupBuilder({
      data: null,
      error: { message: "database unavailable" },
    });
    const supabase = {
      from: vi.fn().mockReturnValueOnce(lookupBuilder),
    };

    const result = await recordOperationalError(
      {
        errorCode: "PUSH_SEND_FAILED",
        feature: "notifications",
        message: "Push 전송에 실패했습니다.",
        operation: "dispatch_push",
        stage: "push_send",
      },
      { supabase },
    );

    expect(result.ok).toBe(false);
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "operationalErrors.record.failed",
        fallback: {
          errorCode: "PUSH_SEND_FAILED",
          feature: "notifications",
          operation: "dispatch_push",
          stage: "push_send",
        },
      }),
    );
  });
});
