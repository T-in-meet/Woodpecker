import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import { reportAdminAiActionError } from "../../utils/report-admin-ai-action-error";
import {
  createAdminAiSettingAction,
  deleteAdminAiSettingAction,
  saveAdminAiSettingConfigurationsAction,
  updateAdminAiSettingAction,
} from "../actions";
import { getAdminAiSettingByKeyInternal } from "../queries.internal";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../../utils/report-admin-ai-action-error", () => ({
  reportAdminAiActionError: vi.fn(),
}));

vi.mock("../queries.internal", () => ({
  getAdminAiSettingByKeyInternal: vi.fn(),
}));

const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
const SETTING_ID = "22222222-2222-4222-8222-222222222222";

describe("AI 설정 actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  describe("createAdminAiSettingAction", () => {
    it("입력값이 유효하지 않으면 실패하고 조회나 DB 작업을 수행하지 않는다", async () => {
      const result = await createAdminAiSettingAction({
        displayName: "",
        key: "INVALID KEY",
        description: "",
      });

      expect(result).toEqual({
        success: false,
        message: "입력값을 확인해주세요.",
      });

      expect(getAdminAiSettingByKeyInternal).not.toHaveBeenCalled();
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(reportAdminAiActionError).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("이미 사용 중인 설정 key이면 실패하고 생성 작업을 수행하지 않는다", async () => {
      vi.mocked(getAdminAiSettingByKeyInternal).mockResolvedValue({
        id: SETTING_ID,
        key: "note-chat",
        displayName: "노트 챗봇",
        description: "",
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T00:00:00.000Z",
      });

      const result = await createAdminAiSettingAction({
        displayName: "노트 챗봇",
        key: "note-chat",
        description: "",
      });

      expect(getAdminAiSettingByKeyInternal).toHaveBeenCalledWith("note-chat");

      expect(result).toEqual({
        success: false,
        message: "이미 사용 중인 설정 키입니다.",
      });

      expect(createAdminClient).not.toHaveBeenCalled();
      expect(reportAdminAiActionError).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("AI 설정을 생성하고 목록 경로를 갱신한다", async () => {
      vi.mocked(getAdminAiSettingByKeyInternal).mockResolvedValue(null);

      const single = vi.fn().mockResolvedValue({
        data: {
          id: SETTING_ID,
        },
        error: null,
      });

      const select = vi.fn().mockReturnValue({
        single,
      });

      const insert = vi.fn().mockReturnValue({
        select,
      });

      const from = vi.fn().mockReturnValue({
        insert,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await createAdminAiSettingAction({
        displayName: " 노트 챗봇 ",
        key: " note-chat ",
        description: " 설명 ",
      });

      expect(getAdminAiSettingByKeyInternal).toHaveBeenCalledWith("note-chat");
      expect(from).toHaveBeenCalledWith("ai_settings");

      expect(insert).toHaveBeenCalledWith({
        description: "설명",
        display_name: "노트 챗봇",
        key: "note-chat",
      });

      expect(select).toHaveBeenCalledWith("id");
      expect(single).toHaveBeenCalledOnce();

      expect(revalidatePath).toHaveBeenCalledWith(ROUTES.ADMIN.AI.SETTINGS);
      expect(reportAdminAiActionError).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
        settingId: SETTING_ID,
      });
    });

    it("설정 key 중복 조회에 실패하면 운영 오류를 보고하고 생성하지 않는다", async () => {
      const error = new Error("setting lookup failed");

      vi.mocked(getAdminAiSettingByKeyInternal).mockRejectedValue(error);

      const result = await createAdminAiSettingAction({
        displayName: "노트 챗봇",
        key: "note-chat",
        description: "",
      });

      expect(reportAdminAiActionError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          settingKey: "note-chat",
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
        message: "관리자 AI 설정 중복 조회에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING,
      });

      expect(result).toEqual({
        success: false,
        message: "AI 설정 생성에 실패했습니다.",
      });

      expect(createAdminClient).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("동시에 동일한 key가 생성되어 unique 제약에 걸리면 중복 메시지를 반환한다", async () => {
      vi.mocked(getAdminAiSettingByKeyInternal).mockResolvedValue(null);

      const single = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key",
        },
      });

      const select = vi.fn().mockReturnValue({
        single,
      });

      const insert = vi.fn().mockReturnValue({
        select,
      });

      const from = vi.fn().mockReturnValue({
        insert,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await createAdminAiSettingAction({
        displayName: "노트 챗봇",
        key: "note-chat",
        description: "",
      });

      expect(result).toEqual({
        success: false,
        message: "이미 사용 중인 설정 키입니다.",
      });

      // Unique 충돌은 예상 가능한 도메인 충돌이므로 운영 오류로 보고하지 않는다.
      expect(reportAdminAiActionError).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("AI 설정 생성 DB 오류가 발생하면 운영 오류를 보고하고 실패한다", async () => {
      vi.mocked(getAdminAiSettingByKeyInternal).mockResolvedValue(null);

      const error = {
        code: "50000",
        message: "database error",
      };

      const single = vi.fn().mockResolvedValue({
        data: null,
        error,
      });

      const select = vi.fn().mockReturnValue({
        single,
      });

      const insert = vi.fn().mockReturnValue({
        select,
      });

      const from = vi.fn().mockReturnValue({
        insert,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await createAdminAiSettingAction({
        displayName: "노트 챗봇",
        key: "note-chat",
        description: "",
      });

      expect(reportAdminAiActionError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          settingKey: "note-chat",
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CREATE_FAILED,
        message: "관리자 AI 설정 생성에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_SETTING,
      });

      expect(result).toEqual({
        success: false,
        message: "AI 설정 생성에 실패했습니다.",
      });

      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("updateAdminAiSettingAction", () => {
    it("입력값이 유효하지 않으면 실패하고 DB 작업을 수행하지 않는다", async () => {
      const result = await updateAdminAiSettingAction({
        settingId: "invalid",
        displayName: "",
        description: "",
      });

      expect(result).toEqual({
        success: false,
        message: "입력값을 확인해주세요.",
      });

      expect(createAdminClient).not.toHaveBeenCalled();
      expect(reportAdminAiActionError).not.toHaveBeenCalled();
    });

    it("AI 설정 기본 정보를 수정한다", async () => {
      const eq = vi.fn().mockResolvedValue({
        error: null,
      });

      const update = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        update,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await updateAdminAiSettingAction({
        settingId: SETTING_ID,
        displayName: " 수정된 이름 ",
        description: " 수정된 설명 ",
      });

      expect(from).toHaveBeenCalledWith("ai_settings");

      expect(update).toHaveBeenCalledWith({
        description: "수정된 설명",
        display_name: "수정된 이름",
      });

      expect(eq).toHaveBeenCalledWith("id", SETTING_ID);

      expect(reportAdminAiActionError).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
      });
    });

    it("AI 설정 수정 DB 오류가 발생하면 운영 오류를 보고하고 실패한다", async () => {
      const error = {
        message: "database error",
      };

      const eq = vi.fn().mockResolvedValue({
        error,
      });

      const update = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        update,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await updateAdminAiSettingAction({
        settingId: SETTING_ID,
        displayName: "노트 챗봇",
        description: "",
      });

      expect(reportAdminAiActionError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          settingId: SETTING_ID,
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_UPDATE_FAILED,
        message: "관리자 AI 설정 수정에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_SETTING,
      });

      expect(result).toEqual({
        success: false,
        message: "AI 설정 수정에 실패했습니다.",
      });
    });
  });

  describe("deleteAdminAiSettingAction", () => {
    it("입력값이 유효하지 않으면 실패하고 DB 작업을 수행하지 않는다", async () => {
      const result = await deleteAdminAiSettingAction({
        settingId: "invalid",
      });

      expect(result).toEqual({
        success: false,
        message: "입력값을 확인해주세요.",
      });

      expect(createAdminClient).not.toHaveBeenCalled();
      expect(reportAdminAiActionError).not.toHaveBeenCalled();
    });

    it("AI 설정을 삭제한다", async () => {
      const eq = vi.fn().mockResolvedValue({
        error: null,
      });

      const deleteQuery = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        delete: deleteQuery,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await deleteAdminAiSettingAction({
        settingId: SETTING_ID,
      });

      expect(from).toHaveBeenCalledWith("ai_settings");
      expect(deleteQuery).toHaveBeenCalledOnce();
      expect(eq).toHaveBeenCalledWith("id", SETTING_ID);

      expect(reportAdminAiActionError).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
      });
    });

    it("AI 설정 삭제 DB 오류가 발생하면 운영 오류를 보고하고 실패한다", async () => {
      const error = {
        message: "database error",
      };

      const eq = vi.fn().mockResolvedValue({
        error,
      });

      const deleteQuery = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        delete: deleteQuery,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await deleteAdminAiSettingAction({
        settingId: SETTING_ID,
      });

      expect(reportAdminAiActionError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          settingId: SETTING_ID,
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_DELETE_FAILED,
        message: "관리자 AI 설정 삭제에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_SETTING,
      });

      expect(result).toEqual({
        success: false,
        message: "AI 설정 삭제에 실패했습니다.",
      });
    });
  });

  describe("saveAdminAiSettingConfigurationsAction", () => {
    const validInput = {
      settingId: SETTING_ID,
      configurations: [
        {
          kind: "chat" as const,
          roleKey: "primary-chat",
          promptVersionId: "33333333-3333-4333-8333-333333333333",
          modelConfigId: "44444444-4444-4444-8444-444444444444",
          temperature: 0.2,
        },
        {
          kind: "embedding" as const,
          roleKey: "primary-embedding",
          modelConfigId: "55555555-5555-4555-8555-555555555555",
        },
      ],
    };

    it("입력값이 유효하지 않으면 실패하고 RPC를 호출하지 않는다", async () => {
      const result = await saveAdminAiSettingConfigurationsAction({
        settingId: "invalid",
        configurations: [],
      });

      expect(result).toEqual({
        success: false,
        message: "입력값을 확인해주세요.",
      });

      expect(createAdminClient).not.toHaveBeenCalled();
      expect(reportAdminAiActionError).not.toHaveBeenCalled();
    });

    it("AI 설정 Configuration 전체 상태를 RPC로 저장한다", async () => {
      const rpc = vi.fn().mockResolvedValue({
        error: null,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        rpc,
      } as never);

      const result = await saveAdminAiSettingConfigurationsAction(validInput);

      expect(rpc).toHaveBeenCalledWith("save_ai_setting_configurations", {
        p_setting_id: validInput.settingId,
        p_configurations: validInput.configurations,
      });

      expect(reportAdminAiActionError).not.toHaveBeenCalled();

      expect(result).toEqual({
        success: true,
      });
    });

    it("Configuration 저장 RPC 오류가 발생하면 운영 오류를 보고하고 실패한다", async () => {
      const error = {
        message: "database error",
      };

      const rpc = vi.fn().mockResolvedValue({
        error,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        rpc,
      } as never);

      const result = await saveAdminAiSettingConfigurationsAction(validInput);

      expect(reportAdminAiActionError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          configurationCount: validInput.configurations.length,
          settingId: SETTING_ID,
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CONFIG_SAVE_FAILED,
        message: "관리자 AI 구성 저장에 실패했습니다.",
        operation:
          ADMIN_AI_OPERATIONAL_ERROR_OPERATION.SAVE_SETTING_CONFIGURATIONS,
      });

      expect(result).toEqual({
        success: false,
        message: "AI 구성 저장에 실패했습니다.",
      });
    });
  });
});
