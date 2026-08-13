import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import { loadAdminAiPromptGraph } from "../../utils/load-admin-prompt-graph";
import { reportAdminAiLoadError } from "../../utils/report-load-error";
import {
  getAdminAiSettingConfigurations,
  getAdminAiSettingDetail,
  getAdminAiSettings,
} from "../queries";
import {
  getAdminAiSettingConfigurationsInternal,
  getAdminAiSettingDetailInternal,
} from "../queries.internal";
import type { AdminAiSettingListQuery } from "../types/ai-settings-list";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../../utils/load-admin-prompt-graph", () => ({
  loadAdminAiPromptGraph: vi.fn(),
}));

vi.mock("../../utils/report-load-error", () => ({
  reportAdminAiLoadError: vi.fn(),
}));

vi.mock("../queries.internal", () => ({
  getAdminAiSettingByKeyInternal: vi.fn(),
  getAdminAiSettingConfigurationsInternal: vi.fn(),
  getAdminAiSettingDetailInternal: vi.fn(),
}));

const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";
const SETTING_ID = "22222222-2222-4222-8222-222222222222";

const query: AdminAiSettingListQuery = {
  page: 0,
  pageSize: 10,
  search: {
    field: "displayName",
    query: "노트",
  },
  filters: {},
  sort: {
    field: "updatedAt",
    direction: "desc",
  },
};

/**
 * Supabase admin client의 RPC 호출을 mock합니다.
 *
 * @param result RPC 반환값
 * @returns RPC mock
 */
function mockRpcClient(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue(result);

  vi.mocked(createAdminClient).mockReturnValue({
    rpc,
  } as unknown as ReturnType<typeof createAdminClient>);

  return rpc;
}

describe("AI 설정 queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  describe("getAdminAiSettingDetail", () => {
    it("관리자 인증 후 settingId 기반 내부 조회 결과를 반환한다", async () => {
      vi.mocked(getAdminAiSettingDetailInternal).mockResolvedValue(null);

      const result = await getAdminAiSettingDetail(SETTING_ID);

      expect(requireAdmin).toHaveBeenCalled();
      expect(getAdminAiSettingDetailInternal).toHaveBeenCalledWith(SETTING_ID);
      expect(result).toBeNull();

      expect(reportAdminAiLoadError).not.toHaveBeenCalled();
    });

    it("설정 상세 내부 조회에 실패하면 운영 오류를 보고하고 예외를 다시 던진다", async () => {
      const error = new Error("setting detail failed");

      vi.mocked(getAdminAiSettingDetailInternal).mockRejectedValue(error);

      await expect(getAdminAiSettingDetail(SETTING_ID)).rejects.toThrow(
        "setting detail failed",
      );

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          settingId: SETTING_ID,
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
        message: "관리자 AI 설정 상세 조회에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
    });
  });

  describe("getAdminAiSettingConfigurations", () => {
    it("Embedding 구성을 폼 타입으로 변환한다", async () => {
      vi.mocked(getAdminAiSettingConfigurationsInternal).mockResolvedValue([
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "embedding",
          model_config_id: "33333333-3333-4333-8333-333333333333",
          prompt_version_id: null,
          role_key: "primary-embedding",
          temperature: null,
          sort_order: 0,
        },
      ]);

      vi.mocked(loadAdminAiPromptGraph).mockResolvedValue({
        agents: [],
        families: [],
        versionsByFamilyId: new Map(),
      } as never);

      const result = await getAdminAiSettingConfigurations(
        "44444444-4444-4444-8444-444444444444",
      );

      expect(result).toEqual([
        {
          kind: "embedding",
          roleKey: "primary-embedding",
          modelConfigId: "33333333-3333-4333-8333-333333333333",
        },
      ]);

      expect(reportAdminAiLoadError).not.toHaveBeenCalled();
    });

    it("Chat 구성의 Prompt Version으로 Family와 Agent를 복원한다", async () => {
      const versionId = "33333333-3333-4333-8333-333333333333";
      const familyId = "44444444-4444-4444-8444-444444444444";
      const agentId = "55555555-5555-4555-8555-555555555555";

      vi.mocked(getAdminAiSettingConfigurationsInternal).mockResolvedValue([
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "chat",
          model_config_id: "66666666-6666-4666-8666-666666666666",
          prompt_version_id: versionId,
          role_key: "primary-chat",
          temperature: 0.2,
          sort_order: 0,
        },
      ]);

      vi.mocked(loadAdminAiPromptGraph).mockResolvedValue({
        agents: [],
        families: [
          {
            id: familyId,
            agentId,
          },
        ],
        versionsByFamilyId: new Map([
          [
            familyId,
            [
              {
                id: versionId,
              },
            ],
          ],
        ]),
      } as never);

      const result = await getAdminAiSettingConfigurations(
        "77777777-7777-4777-8777-777777777777",
      );

      expect(result).toEqual([
        {
          kind: "chat",
          roleKey: "primary-chat",
          agentId,
          promptFamilyId: familyId,
          promptVersionId: versionId,
          modelConfigId: "66666666-6666-4666-8666-666666666666",
          temperature: 0.2,
        },
      ]);

      expect(reportAdminAiLoadError).not.toHaveBeenCalled();
    });

    it("구성 내부 조회에 실패하면 운영 오류를 보고하고 예외를 다시 던진다", async () => {
      const error = new Error("setting configurations failed");

      vi.mocked(getAdminAiSettingConfigurationsInternal).mockRejectedValue(
        error,
      );

      await expect(getAdminAiSettingConfigurations(SETTING_ID)).rejects.toThrow(
        "setting configurations failed",
      );

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          settingId: SETTING_ID,
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
        message: "관리자 AI 구성 조회에 실패했습니다.",
        operation:
          ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING_CONFIGURATIONS,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });

      expect(loadAdminAiPromptGraph).not.toHaveBeenCalled();
    });

    it("Chat 구성에 Prompt Version 또는 temperature가 없으면 운영 오류를 보고하고 실패한다", async () => {
      const configurationId = "22222222-2222-4222-8222-222222222222";
      const settingId = "44444444-4444-4444-8444-444444444444";

      vi.mocked(getAdminAiSettingConfigurationsInternal).mockResolvedValue([
        {
          id: configurationId,
          kind: "chat",
          role_key: "primary-chat",
          model_config_id: "33333333-3333-4333-8333-333333333333",
          prompt_version_id: null,
          temperature: null,
          sort_order: 0,
        },
      ]);

      vi.mocked(loadAdminAiPromptGraph).mockResolvedValue({
        agents: [],
        families: [],
        versionsByFamilyId: new Map(),
      } as never);

      await expect(getAdminAiSettingConfigurations(settingId)).rejects.toThrow(
        `Invalid chat AI setting configuration: ${configurationId}`,
      );

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          configurationId,
          settingId,
        },
        error: expect.any(Error),
        errorCode:
          ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CONFIGURATION_INVALID,
        message: "관리자 AI chat 구성 데이터가 올바르지 않습니다.",
        operation:
          ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_SETTING_CONFIGURATION,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });
    });

    it("Prompt Version에 대응하는 Family를 찾을 수 없으면 운영 오류를 보고하고 실패한다", async () => {
      const configurationId = "22222222-2222-4222-8222-222222222222";
      const promptVersionId = "44444444-4444-4444-8444-444444444444";
      const settingId = "55555555-5555-4555-8555-555555555555";

      vi.mocked(getAdminAiSettingConfigurationsInternal).mockResolvedValue([
        {
          id: configurationId,
          kind: "chat",
          role_key: "primary-chat",
          model_config_id: "33333333-3333-4333-8333-333333333333",
          prompt_version_id: promptVersionId,
          temperature: 0.2,
          sort_order: 0,
        },
      ]);

      vi.mocked(loadAdminAiPromptGraph).mockResolvedValue({
        agents: [],
        families: [],
        versionsByFamilyId: new Map(),
      } as never);

      await expect(getAdminAiSettingConfigurations(settingId)).rejects.toThrow(
        `Failed to resolve prompt family for AI setting configuration: ${configurationId}`,
      );

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          configurationId,
          promptVersionId,
          settingId,
        },
        error: expect.any(Error),
        errorCode:
          ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CONFIGURATION_INVALID,
        message: "관리자 AI 구성의 Prompt Family 확인에 실패했습니다.",
        operation:
          ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_SETTING_CONFIGURATION,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });
    });
  });

  describe("getAdminAiSettings", () => {
    it("목록 RPC 결과를 화면 모델과 페이지네이션으로 반환한다", async () => {
      const rpc = mockRpcClient({
        data: [
          {
            items: [
              {
                id: SETTING_ID,
                displayName: "노트 챗봇",
                key: "note-chat",
                agents: [],
                chatModels: [],
                embeddingModels: [],
                chatConfigurationCount: 1,
                embeddingConfigurationCount: 1,
                createdAt: "2026-08-07T00:00:00.000Z",
                updatedAt: "2026-08-07T01:00:00.000Z",
              },
            ],
            total_count: 21,
          },
        ],
        error: null,
      });

      const result = await getAdminAiSettings(query);

      expect(rpc).toHaveBeenCalledWith(
        "get_admin_ai_setting_list",
        expect.objectContaining({
          p_page: 1,
          p_page_size: 10,
          p_search_field: "displayName",
          p_search_query: "노트",
          p_sort_field: "updatedAt",
          p_sort_direction: "desc",
        }),
      );

      expect(result).toEqual({
        items: [
          {
            id: SETTING_ID,
            displayName: "노트 챗봇",
            key: "note-chat",
            agents: [],
            chatModels: [],
            embeddingModels: [],
            chatConfigurationCount: 1,
            embeddingConfigurationCount: 1,
            createdAt: "2026-08-07T00:00:00.000Z",
            updatedAt: "2026-08-07T01:00:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 21,
          totalPages: 3,
        },
      });

      expect(reportAdminAiLoadError).not.toHaveBeenCalled();
    });

    it("RPC가 정상적인 빈 목록을 반환하면 빈 items와 전체 개수를 반환한다", async () => {
      mockRpcClient({
        data: [
          {
            items: [],
            total_count: 0,
          },
        ],
        error: null,
      });

      const result = await getAdminAiSettings(query);

      expect(result).toEqual({
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      });

      expect(reportAdminAiLoadError).not.toHaveBeenCalled();
    });

    it("목록 RPC 조회 실패 시 운영 오류를 보고하고 예외를 던진다", async () => {
      const error = {
        message: "database error",
      };

      mockRpcClient({
        data: null,
        error,
      });

      await expect(getAdminAiSettings(query)).rejects.toThrow(
        "Failed to load admin AI settings: database error",
      );

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          page: 1,
          pageSize: 10,
          searchField: "displayName",
          searchQueryApplied: true,
          sortDirection: "desc",
          sortField: "updatedAt",
        },
        error,
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
        message: "관리자 AI 설정 목록 조회에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTINGS,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
    });

    it("RPC 최상위 결과 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
      mockRpcClient({
        data: [],
        error: null,
      });

      await expect(getAdminAiSettings(query)).rejects.toThrow();

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          page: 1,
          pageSize: 10,
          searchField: "displayName",
          searchQueryApplied: true,
          sortDirection: "desc",
          sortField: "updatedAt",
        },
        error: expect.any(Error),
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
        message: "관리자 AI 설정 목록 응답 검증에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });
    });

    it("RPC 결과 필드 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
      mockRpcClient({
        data: [
          {
            items: [],
            total_count: "invalid",
          },
        ],
        error: null,
      });

      await expect(getAdminAiSettings(query)).rejects.toThrow();

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          page: 1,
          pageSize: 10,
          searchField: "displayName",
          searchQueryApplied: true,
          sortDirection: "desc",
          sortField: "updatedAt",
        },
        error: expect.any(Error),
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
        message: "관리자 AI 설정 목록 응답 검증에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });
    });

    it("설정 목록 item 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
      mockRpcClient({
        data: [
          {
            items: [
              {
                id: SETTING_ID,
                displayName: "노트 챗봇",
                key: "note-chat",
                agents: [],
                chatModels: [],
                embeddingModels: [],
                chatConfigurationCount: "invalid",
                embeddingConfigurationCount: 1,
                createdAt: "2026-08-07T00:00:00.000Z",
                updatedAt: "2026-08-07T01:00:00.000Z",
              },
            ],
            total_count: 1,
          },
        ],
        error: null,
      });

      await expect(getAdminAiSettings(query)).rejects.toThrow();

      expect(reportAdminAiLoadError).toHaveBeenCalledWith({
        adminUserId: ADMIN_USER_ID,
        context: {
          page: 1,
          pageSize: 10,
          searchField: "displayName",
          searchQueryApplied: true,
          sortDirection: "desc",
          sortField: "updatedAt",
        },
        error: expect.any(Error),
        errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
        message: "관리자 AI 설정 목록 응답 검증에 실패했습니다.",
        operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
        stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
      });
    });
  });
});
