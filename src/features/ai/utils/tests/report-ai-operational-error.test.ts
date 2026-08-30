import { beforeEach, describe, expect, it, vi } from "vitest";

import { OPERATIONAL_ERROR_SEVERITY } from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_FEATURE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "../../../operational-errors/constants";
import {
  isReportedAiOperationalError,
  markAiOperationalErrorAsReported,
  reportAiOperationalError,
} from "../report-ai-operational-error";

vi.mock("@/features/operational-errors/report", () => ({
  reportOperationalError: vi.fn(),
}));

describe("reportAiOperationalError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI Foundation feature와 기본 severity를 적용하여 오류를 기록한다", async () => {
    const result = {
      status: "created",
      errorId: "error-id",
    };

    vi.mocked(reportOperationalError).mockResolvedValue(result as never);

    const response = await reportAiOperationalError({
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
      message: "OpenAI chat request failed",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
    });

    expect(response).toEqual(result);

    expect(reportOperationalError).toHaveBeenCalledWith(
      {
        actorUserId: null,
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        feature: AI_OPERATIONAL_ERROR_FEATURE,
        message: "OpenAI chat request failed",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        userId: null,
      },
      {},
    );
  });

  it("명시한 severity를 공통 오류 기록 함수에 전달한다", async () => {
    vi.mocked(reportOperationalError).mockResolvedValue({
      status: "created",
      errorId: "error-id",
    } as never);

    await reportAiOperationalError({
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_EMBEDDING_FAILED,
      message: "OpenAI embedding request failed",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_EMBEDDING,
      severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
    });

    expect(reportOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: AI_OPERATIONAL_ERROR_FEATURE,
        severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      }),
      {},
    );
  });

  it("optional 오류 정보를 정의한 경우 공통 오류 기록 함수에 전달한다", async () => {
    vi.mocked(reportOperationalError).mockResolvedValue({
      status: "created",
      errorId: "error-id",
    } as never);

    const error = new Error("OpenAI chat request failed");

    await reportAiOperationalError({
      actorUserId: "actor-user-id",
      context: {
        provider: "openai",
        model: "gpt-test",
      },
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
      fingerprintParts: ["openai", "gpt-test"],
      message: "OpenAI chat request failed",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
      userId: "user-id",
    });

    expect(reportOperationalError).toHaveBeenCalledWith(
      {
        actorUserId: "actor-user-id",
        context: {
          provider: "openai",
          model: "gpt-test",
        },
        error,
        errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
        feature: AI_OPERATIONAL_ERROR_FEATURE,
        fingerprintParts: ["openai", "gpt-test"],
        message: "OpenAI chat request failed",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
        severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
        userId: "user-id",
      },
      {},
    );
  });

  it("공통 오류 기록 함수의 반환 결과를 그대로 반환한다", async () => {
    const result = {
      status: "aggregated",
      errorId: "error-id",
    };

    vi.mocked(reportOperationalError).mockResolvedValue(result as never);

    const response = await reportAiOperationalError({
      errorCode: AI_OPERATIONAL_ERROR_CODE.OPENAI_CHAT_FAILED,
      message: "OpenAI chat request failed",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.PROVIDER,
    });

    expect(response).toEqual(result);
  });

  it("Error 객체에 AI 운영 오류 보고 완료 marker를 부여한다", () => {
    const error = new Error("reported");

    const markedError = markAiOperationalErrorAsReported(error);

    expect(markedError).toBe(error);
    expect(isReportedAiOperationalError(error)).toBe(true);
  });

  it("Error가 아닌 값은 AI 운영 오류 보고 완료로 판단하지 않는다", () => {
    expect(isReportedAiOperationalError("reported")).toBe(false);
    expect(isReportedAiOperationalError(null)).toBe(false);
  });
});
