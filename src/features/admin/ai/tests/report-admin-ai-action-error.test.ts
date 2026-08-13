import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";

import { reportAdminAiActionError } from "../utils/report-admin-ai-action-error";
import { reportAdminAiOperationalError } from "../utils/report-admin-ai-operational-error";

vi.mock("../utils/report-admin-ai-operational-error", () => ({
  reportAdminAiOperationalError: vi.fn(),
}));

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("reportAdminAiActionError", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportAdminAiOperationalError).mockResolvedValue(
      undefined as never,
    );
  });

  it("adminUserId를 actorUserId로 전달하고 기본 database stage를 적용한다", async () => {
    const error = new Error("list validation failed");

    await reportAdminAiActionError({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
    });

    expect(reportAdminAiOperationalError).toHaveBeenCalledWith({
      actorUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });

  it("명시한 stage가 있으면 기본값 대신 그대로 전달한다", async () => {
    const error = new Error("validation failed");

    await reportAdminAiActionError({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    expect(reportAdminAiOperationalError).toHaveBeenCalledWith({
      actorUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });

  it("context와 fingerprintParts를 전달하면 그대로 포함한다", async () => {
    const error = new Error("list validation failed");

    await reportAdminAiActionError({
      adminUserId: ADMIN_USER_ID,
      context: {
        searchQuery: "search",
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      fingerprintParts: ["list", "validation"],
      message: "관리자 AI 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
    });

    expect(reportAdminAiOperationalError).toHaveBeenCalledWith({
      actorUserId: ADMIN_USER_ID,
      context: {
        searchQuery: "search",
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      fingerprintParts: ["list", "validation"],
      message: "관리자 AI 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });
});
