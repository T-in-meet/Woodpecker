import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
  OPERATIONAL_ERROR_SEVERITY,
} from "@/features/operational-errors/constants";
import {
  reportOperationalError,
  type ReportOperationalErrorOptions,
} from "@/features/operational-errors/report";

import { reportAdminAiOperationalError } from "../utils/report-admin-ai-operational-error";

vi.mock("@/features/operational-errors/report", () => ({
  reportOperationalError: vi.fn(),
}));

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FAMILY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("reportAdminAiOperationalError", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportOperationalError).mockResolvedValue(undefined as never);
  });

  it("Admin AI feature와 기본 severity를 적용해 운영 오류를 보고한다", async () => {
    await reportAdminAiOperationalError({
      actorUserId: ADMIN_USER_ID,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    expect(reportOperationalError).toHaveBeenCalledWith(
      {
        actorUserId: ADMIN_USER_ID,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
        feature: ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
        message: "관리자 AI agent 목록 조회에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
        severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
        userId: null,
      },
      {},
    );
  });

  it("명시한 severity와 userId를 그대로 전달한다", async () => {
    await reportAdminAiOperationalError({
      actorUserId: ADMIN_USER_ID,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
      message: "관리자 AI 모델 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
      severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      userId: USER_ID,
    });

    expect(reportOperationalError).toHaveBeenCalledWith(
      {
        actorUserId: ADMIN_USER_ID,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
        feature: ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
        message: "관리자 AI 모델 조회에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
        severity: OPERATIONAL_ERROR_SEVERITY.WARN,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
        userId: USER_ID,
      },
      {},
    );
  });

  it("optional 오류 정보를 전달하면 공통 운영 오류 입력에 포함한다", async () => {
    const error = new Error("prompt graph validation failed");

    await reportAdminAiOperationalError({
      actorUserId: ADMIN_USER_ID,
      context: {
        familyId: FAMILY_ID,
        graphPart: "families",
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
      fingerprintParts: ["families", "validation"],
      message: "관리자 AI prompt graph 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    expect(reportOperationalError).toHaveBeenCalledWith(
      {
        actorUserId: ADMIN_USER_ID,
        context: {
          familyId: FAMILY_ID,
          graphPart: "families",
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
        feature: ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
        fingerprintParts: ["families", "validation"],
        message: "관리자 AI prompt graph 검증에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
        severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
        userId: null,
      },
      {},
    );
  });

  it("optional 오류 정보를 전달하지 않으면 공통 운영 오류 입력에 추가하지 않는다", async () => {
    await reportAdminAiOperationalError({
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
      message: "관리자 AI 설정 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    expect(reportOperationalError).toHaveBeenCalledOnce();

    const call = vi.mocked(reportOperationalError).mock.calls[0];

    expect(call).toBeDefined();

    const input = call?.[0];

    expect(input).toEqual({
      actorUserId: null,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
      feature: ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
      message: "관리자 AI 설정 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      userId: null,
    });

    expect(input).not.toHaveProperty("context");
    expect(input).not.toHaveProperty("error");
    expect(input).not.toHaveProperty("fingerprintParts");
  });

  it("공유 운영 오류 보고 options를 그대로 전달한다", async () => {
    const options: ReportOperationalErrorOptions = {
      notifyAdmins: false,
    };

    await reportAdminAiOperationalError(
      {
        actorUserId: ADMIN_USER_ID,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_UPDATE_FAILED,
        message: "관리자 AI 설정 수정에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_SETTING,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      },
      options,
    );

    expect(reportOperationalError).toHaveBeenCalledWith(
      {
        actorUserId: ADMIN_USER_ID,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_UPDATE_FAILED,
        feature: ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
        message: "관리자 AI 설정 수정에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_SETTING,
        severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
        userId: null,
      },
      options,
    );
  });
});
