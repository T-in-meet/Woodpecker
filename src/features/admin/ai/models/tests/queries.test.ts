import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  nextDayIsoString,
  startOfDayIsoString,
} from "@/features/admin/utils/query";
import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import { reportAdminAiLoadError } from "../../utils/report-load-error";
import {
  getAdminAiModelDetail,
  getAdminAiModelOptions,
  getAdminAiModels,
} from "../queries";
import type { AdminAiModelListQuery } from "../types";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../../utils/report-load-error", () => ({
  reportAdminAiLoadError: vi.fn(),
}));

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHAT_MODEL_ID = "11111111-1111-4111-8111-111111111111";

/**
 * 모델 목록 조회 조건 fixture를 생성합니다.
 *
 * @param overrides 덮어쓸 조회 조건
 * @returns 모델 목록 조회 조건
 */
function createQuery(
  overrides: Partial<AdminAiModelListQuery> = {},
): AdminAiModelListQuery {
  return {
    filters: {},
    page: 1,
    pageSize: 10,
    search: {
      field: "displayName",
      query: "",
    },
    sort: {
      direction: "desc",
      field: "updatedAt",
    },
    ...overrides,
  };
}

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

describe("getAdminAiModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("RPC 결과를 모델 목록과 페이지네이션으로 매핑한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [
            {
              capability: "chat",
              created_at: "2026-08-01T00:00:00.000Z",
              display_name: "GPT-4o Mini",
              embedding_reference_count: 2,
              id: CHAT_MODEL_ID,
              is_active: true,
              model: "gpt-4o-mini",
              provider: "openai",
              updated_at: "2026-08-03T00:00:00.000Z",
            },
          ],
          total_count: 11,
        },
      ],
      error: null,
    });

    const result = await getAdminAiModels(createQuery({ page: 2 }));

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_model_list",
      expect.objectContaining({
        p_page: 2,
        p_page_size: 10,
        p_search_field: "displayName",
        p_sort_direction: "desc",
        p_sort_field: "updatedAt",
      }),
    );

    expect(result).toEqual({
      items: [
        {
          capability: "chat",
          createdAt: "2026-08-01T00:00:00.000Z",
          displayName: "GPT-4o Mini",
          embeddingReferenceCount: 2,
          id: CHAT_MODEL_ID,
          isActive: true,
          model: "gpt-4o-mini",
          provider: "openai",
          updatedAt: "2026-08-03T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        total: 11,
        totalPages: 2,
      },
    });
  });

  it("필터 값을 RPC 파라미터로 변환한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [],
          total_count: 0,
        },
      ],
      error: null,
    });

    const createdFrom = new Date("2026-08-01T12:00:00.000Z");
    const createdTo = new Date("2026-08-02T12:00:00.000Z");

    await getAdminAiModels(
      createQuery({
        filters: {
          capability: {
            field: "capability",
            type: "multi-select",
            value: ["chat", "embedding"],
          },
          createdAt: {
            field: "createdAt",
            type: "date-range",
            value: {
              from: createdFrom,
              to: createdTo,
            },
          },
          embeddingReferenceCount: {
            field: "embeddingReferenceCount",
            type: "number-range",
            value: {
              max: 5,
              min: 1,
            },
          },
          isActive: {
            field: "isActive",
            type: "select",
            value: "true",
          },
          provider: {
            field: "provider",
            type: "multi-select",
            value: ["openai"],
          },
        },
        search: {
          field: "model",
          query: "gpt",
        },
        sort: {
          direction: "asc",
          field: "embeddingReferenceCount",
        },
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_model_list",
      expect.objectContaining({
        p_capability_filters: ["chat", "embedding"],
        p_created_from: startOfDayIsoString(createdFrom),
        p_created_to: nextDayIsoString(createdTo),
        p_is_active_filter: true,
        p_provider_filters: ["openai"],
        p_reference_count_max: 5,
        p_reference_count_min: 1,
        p_search_field: "model",
        p_search_query: "gpt",
        p_sort_direction: "asc",
        p_sort_field: "embeddingReferenceCount",
      }),
    );
  });

  it("RPC가 빈 페이지를 반환해도 total count를 보존한다", async () => {
    mockRpcClient({
      data: [
        {
          items: [],
          total_count: 12,
        },
      ],
      error: null,
    });

    const result = await getAdminAiModels(createQuery({ page: 99 }));

    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(12);
  });

  it("RPC 실패 시 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "rpc failed",
    };

    mockRpcClient({
      data: null,
      error,
    });

    await expect(getAdminAiModels(createQuery())).rejects.toThrow(
      "Failed to load admin AI models: rpc failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        page: 1,
        pageSize: 10,
        searchField: "displayName",
        searchQueryApplied: false,
        sortDirection: "desc",
        sortField: "updatedAt",
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
      message: "관리자 AI 모델 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });

  it("RPC 최상위 결과 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
    mockRpcClient({
      data: [],
      error: null,
    });

    await expect(getAdminAiModels(createQuery())).rejects.toThrow();

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        page: 1,
        pageSize: 10,
        searchField: "displayName",
        searchQueryApplied: false,
        sortDirection: "desc",
        sortField: "updatedAt",
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 모델 목록 응답 검증에 실패했습니다.",
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

    await expect(getAdminAiModels(createQuery())).rejects.toThrow();

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        page: 1,
        pageSize: 10,
        searchField: "displayName",
        searchQueryApplied: false,
        sortDirection: "desc",
        sortField: "updatedAt",
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 모델 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });

  it("모델 목록 item 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
    mockRpcClient({
      data: [
        {
          items: [
            {
              capability: "chat",
              created_at: "2026-08-01T00:00:00.000Z",
              display_name: "GPT-4o Mini",
              embedding_reference_count: "invalid",
              id: CHAT_MODEL_ID,
              is_active: true,
              model: "gpt-4o-mini",
              provider: "openai",
              updated_at: "2026-08-03T00:00:00.000Z",
            },
          ],
          total_count: 1,
        },
      ],
      error: null,
    });

    await expect(getAdminAiModels(createQuery())).rejects.toThrow();

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        page: 1,
        pageSize: 10,
        searchField: "displayName",
        searchQueryApplied: false,
        sortDirection: "desc",
        sortField: "updatedAt",
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID,
      message: "관리자 AI 모델 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });
});

describe("getAdminAiModelDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("ID와 일치하는 모델 상세와 Embedding 참조 수를 count 조회로 반환한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        capability: "chat",
        created_at: "2026-08-01T00:00:00.000Z",
        dimensions: null,
        display_name: "GPT-4o Mini",
        distance_metric: null,
        id: CHAT_MODEL_ID,
        is_active: true,
        model: "gpt-4o-mini",
        notes: null,
        provider: "openai",
        updated_at: "2026-08-03T00:00:00.000Z",
      },
      error: null,
    });

    const modelEq = vi.fn(() => ({
      maybeSingle,
    }));

    const embeddingEq = vi.fn().mockResolvedValue({
      count: 3,
      data: null,
      error: null,
    });

    const modelSelect = vi.fn(() => ({
      eq: modelEq,
    }));

    const embeddingSelect = vi.fn(() => ({
      eq: embeddingEq,
    }));

    const from = vi.fn((table: string) => ({
      select: table === "ai_model_configs" ? modelSelect : embeddingSelect,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await getAdminAiModelDetail(CHAT_MODEL_ID);

    /*
     * 상세 화면에서는 Embedding row 본문이 필요하지 않으므로
     * 전체 row를 가져오지 않고 count만 조회해야 한다.
     */
    expect(embeddingSelect).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });

    expect(embeddingEq).toHaveBeenCalledWith("model_config_id", CHAT_MODEL_ID);

    expect(result).toEqual(
      expect.objectContaining({
        embeddingReferenceCount: 3,
        id: CHAT_MODEL_ID,
      }),
    );
  });

  it("ID와 일치하는 모델이 없으면 null을 반환한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const eq = vi.fn(() => ({
      maybeSingle,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq,
        })),
      })),
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await getAdminAiModelDetail(
      "99999999-9999-4999-8999-999999999999",
    );

    expect(result).toBeNull();
  });

  it("모델 상세 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "model load failed",
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error,
    });

    const eq = vi.fn(() => ({
      maybeSingle,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq,
        })),
      })),
    } as unknown as ReturnType<typeof createAdminClient>);

    await expect(getAdminAiModelDetail(CHAT_MODEL_ID)).rejects.toThrow(
      "Failed to load admin AI model: model load failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        modelConfigId: CHAT_MODEL_ID,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
      message: "관리자 AI 모델 상세 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });

  it("Embedding 참조 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const embeddingError = {
      message: "embedding references failed",
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        capability: "chat",
        created_at: "2026-08-01T00:00:00.000Z",
        dimensions: null,
        display_name: "GPT-4o Mini",
        distance_metric: null,
        id: CHAT_MODEL_ID,
        is_active: true,
        model: "gpt-4o-mini",
        notes: null,
        provider: "openai",
        updated_at: "2026-08-03T00:00:00.000Z",
      },
      error: null,
    });

    const modelEq = vi.fn(() => ({
      maybeSingle,
    }));

    const embeddingEq = vi.fn().mockResolvedValue({
      data: null,
      error: embeddingError,
    });

    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: table === "ai_model_configs" ? modelEq : embeddingEq,
      })),
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    await expect(getAdminAiModelDetail(CHAT_MODEL_ID)).rejects.toThrow(
      "Failed to load admin AI model references: embedding references failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        modelConfigId: CHAT_MODEL_ID,
      },
      error: embeddingError,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
      message: "관리자 AI 모델 참조 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });
});

describe("getAdminAiModelOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("지정한 capability의 활성 모델을 display name 오름차순으로 반환한다", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          capability: "chat",
          display_name: "GPT-4o Mini",
          id: CHAT_MODEL_ID,
          is_active: true,
          model: "gpt-4o-mini",
          provider: "openai",
        },
      ],
      error: null,
    });

    const activeEq = vi.fn().mockReturnValue({
      order,
    });

    const capabilityEq = vi.fn().mockReturnValue({
      eq: activeEq,
    });

    const select = vi.fn().mockReturnValue({
      eq: capabilityEq,
    });

    const from = vi.fn().mockReturnValue({
      select,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await getAdminAiModelOptions("chat");

    expect(from).toHaveBeenCalledWith("ai_model_configs");
    expect(capabilityEq).toHaveBeenCalledWith("capability", "chat");
    expect(activeEq).toHaveBeenCalledWith("is_active", true);
    expect(order).toHaveBeenCalledWith("display_name", {
      ascending: true,
    });

    expect(result).toEqual([
      {
        capability: "chat",
        displayName: "GPT-4o Mini",
        id: CHAT_MODEL_ID,
        isActive: true,
        model: "gpt-4o-mini",
        provider: "openai",
      },
    ]);
  });

  it("모델 선택 목록 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "model options failed",
    };

    const order = vi.fn().mockResolvedValue({
      data: null,
      error,
    });

    const activeEq = vi.fn().mockReturnValue({
      order,
    });

    const capabilityEq = vi.fn().mockReturnValue({
      eq: activeEq,
    });

    const select = vi.fn().mockReturnValue({
      eq: capabilityEq,
    });

    const from = vi.fn().mockReturnValue({
      select,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    await expect(getAdminAiModelOptions("chat")).rejects.toThrow(
      "Failed to load admin AI model options: model options failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        capability: "chat",
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED,
      message: "관리자 AI 모델 선택 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG_OPTIONS,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });
});
