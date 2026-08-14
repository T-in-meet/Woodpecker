import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import { reportAdminAiActionError } from "../../utils/report-admin-ai-action-error";
import { revalidateAdminAiPaths } from "../../utils/revalidate";
import {
  createAdminAiModel,
  deleteAdminAiModel,
  updateAdminAiModel,
} from "../actions";
import { getAdminAiModelDetail } from "../queries";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../queries", () => ({
  getAdminAiModelDetail: vi.fn(),
}));

vi.mock("../../utils/report-admin-ai-action-error", () => ({
  reportAdminAiActionError: vi.fn(),
}));

vi.mock("../../utils/revalidate", () => ({
  revalidateAdminAiPaths: vi.fn(),
}));

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MODEL_CONFIG_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Embedding 모델 생성 FormData fixture를 생성합니다.
 *
 * @returns Embedding 모델 생성 FormData
 */
function createModelFormData() {
  const formData = new FormData();

  formData.set("capability", "embedding");
  formData.set("dimensions", "1536");
  formData.set("displayName", "Text Embedding 3 Small");
  formData.set("distanceMetric", "cosine");
  formData.set("isActive", "true");
  formData.set("model", "text-embedding-3-small");
  formData.set("notes", "기본 embedding 모델");
  formData.set("provider", "openai");

  return formData;
}

/**
 * Chat 모델 생성 FormData fixture를 생성합니다.
 *
 * @returns Chat 모델 생성 FormData
 */
function createChatModelFormData() {
  const formData = new FormData();

  formData.set("capability", "chat");
  formData.set("dimensions", "");
  formData.set("displayName", "GPT-4o");
  formData.set("distanceMetric", "");
  formData.set("isActive", "true");
  formData.set("model", "gpt-4o");
  formData.set("notes", "기본 chat 모델");
  formData.set("provider", "openai");

  return formData;
}

/**
 * 모델 수정 FormData fixture를 생성합니다.
 *
 * @returns 모델 수정 FormData
 */
function createUpdateFormData() {
  const formData = new FormData();

  formData.set("displayName", "수정된 모델");
  formData.set("isActive", "on");
  formData.set("modelConfigId", MODEL_CONFIG_ID);
  formData.set("notes", "수정된 설명");

  return formData;
}

describe("createAdminAiModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("지원하지 않는 Provider면 DB를 호출하지 않는다", async () => {
    const formData = createModelFormData();

    formData.set("provider", "invalid");

    const result = await createAdminAiModel(formData);

    expect(result.ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("Embedding 모델의 dimensions가 1536이 아니면 DB를 호출하지 않는다", async () => {
    const formData = createModelFormData();

    formData.set("dimensions", "768");

    const result = await createAdminAiModel(formData);

    expect(result).toEqual({
      message: "Embedding 모델의 dimensions는 1536이어야 합니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("Chat 모델에 Embedding 전용 설정이 있으면 DB를 호출하지 않는다", async () => {
    const formData = createChatModelFormData();

    formData.set("dimensions", "1536");
    formData.set("distanceMetric", "cosine");

    const result = await createAdminAiModel(formData);

    expect(result).toEqual({
      message: "Chat 모델에는 dimensions를 설정할 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("모델을 생성하고 관리자 AI 경로를 재검증한다", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: MODEL_CONFIG_ID,
      },
      error: null,
    });
    const select = vi.fn(() => ({
      single,
    }));
    const insert = vi.fn(() => ({
      select,
    }));
    const from = vi.fn(() => ({
      insert,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await createAdminAiModel(createModelFormData());

    expect(from).toHaveBeenCalledWith("ai_model_configs");
    expect(insert).toHaveBeenCalledWith({
      capability: "embedding",
      dimensions: 1536,
      display_name: "Text Embedding 3 Small",
      distance_metric: "cosine",
      is_active: true,
      model: "text-embedding-3-small",
      notes: "기본 embedding 모델",
      provider: "openai",
    });
    expect(select).toHaveBeenCalledWith("id");
    expect(single).toHaveBeenCalledOnce();
    expect(result).toEqual({
      id: MODEL_CONFIG_ID,
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("모델 생성에 실패하면 운영 오류를 보고한다", async () => {
    const error = {
      message: "insert failed",
    };
    const single = vi.fn().mockResolvedValue({
      data: null,
      error,
    });
    const select = vi.fn(() => ({
      single,
    }));
    const insert = vi.fn(() => ({
      select,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        insert,
      })),
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await createAdminAiModel(createModelFormData());

    expect(result).toEqual({
      message: "insert failed",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_MODEL_CONFIG_CREATE_FAILED",
      message: "관리자 AI 모델 생성에 실패했습니다.",
      operation: "create_model_config",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("updateAdminAiModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("모델 ID가 올바르지 않으면 DB를 호출하지 않는다", async () => {
    const formData = createUpdateFormData();

    formData.set("modelConfigId", "invalid-id");

    const result = await updateAdminAiModel(formData);

    expect(result.ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("모델 운영 필드를 수정하고 경로를 재검증한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: MODEL_CONFIG_ID,
      },
      error: null,
    });

    const select = vi.fn(() => ({
      maybeSingle,
    }));

    const eq = vi.fn(() => ({
      select,
    }));

    const update = vi.fn(() => ({
      eq,
    }));

    const from = vi.fn(() => ({
      update,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await updateAdminAiModel(createUpdateFormData());

    expect(from).toHaveBeenCalledWith("ai_model_configs");
    expect(update).toHaveBeenCalledWith({
      display_name: "수정된 모델",
      is_active: true,
      notes: "수정된 설명",
    });
    expect(eq).toHaveBeenCalledWith("id", MODEL_CONFIG_ID);
    expect(select).toHaveBeenCalledWith("id");
    expect(maybeSingle).toHaveBeenCalledOnce();

    expect(result).toEqual({
      ok: true,
    });

    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("모델 수정에 실패하면 운영 오류를 보고한다", async () => {
    const error = {
      message: "update failed",
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error,
    });

    const select = vi.fn(() => ({
      maybeSingle,
    }));

    const eq = vi.fn(() => ({
      select,
    }));

    const update = vi.fn(() => ({
      eq,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        update,
      })),
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await updateAdminAiModel(createUpdateFormData());

    expect(result).toEqual({
      message: "update failed",
      ok: false,
    });

    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_MODEL_CONFIG_UPDATE_FAILED",
      message: "관리자 AI 모델 수정에 실패했습니다.",
      operation: "update_model_config",
    });

    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("수정할 모델이 존재하지 않으면 실패하고 경로를 재검증하지 않는다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    const select = vi.fn(() => ({
      maybeSingle,
    }));

    const eq = vi.fn(() => ({
      select,
    }));

    const update = vi.fn(() => ({
      eq,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        update,
      })),
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await updateAdminAiModel(createUpdateFormData());

    expect(result).toEqual({
      message: "수정할 AI 모델을 찾을 수 없습니다.",
      ok: false,
    });

    expect(reportAdminAiActionError).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("deleteAdminAiModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("모델 ID가 올바르지 않으면 실패를 반환한다", async () => {
    const result = await deleteAdminAiModel("invalid-id");

    expect(result).toEqual({
      message: "모델 ID가 올바르지 않습니다.",
      ok: false,
    });
    expect(getAdminAiModelDetail).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("모델을 찾을 수 없으면 실패를 반환한다", async () => {
    vi.mocked(getAdminAiModelDetail).mockResolvedValue(null);

    const result = await deleteAdminAiModel(MODEL_CONFIG_ID);

    expect(result).toEqual({
      message: "모델을 찾을 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    {
      embeddingReferenceCount: 0,
      isActive: true,
    },
    {
      embeddingReferenceCount: 1,
      isActive: false,
    },
  ])(
    "삭제할 수 없는 모델이면 실패를 반환한다",
    async ({ embeddingReferenceCount, isActive }) => {
      vi.mocked(getAdminAiModelDetail).mockResolvedValue({
        capability: "chat",
        createdAt: "2026-08-03T00:00:00.000Z",
        dimensions: null,
        displayName: "GPT-4o",
        distanceMetric: null,
        embeddingReferenceCount,
        id: MODEL_CONFIG_ID,
        isActive,
        model: "gpt-4o",
        notes: null,
        provider: "openai",
        updatedAt: "2026-08-03T00:00:00.000Z",
      });

      const result = await deleteAdminAiModel(MODEL_CONFIG_ID);

      expect(result).toEqual({
        message: "활성 모델, embedding 참조가 있는 모델은 삭제할 수 없습니다.",
        ok: false,
      });
      expect(createAdminClient).not.toHaveBeenCalled();
    },
  );

  it("삭제 가능한 모델을 삭제하고 경로를 재검증한다", async () => {
    vi.mocked(getAdminAiModelDetail).mockResolvedValue({
      capability: "chat",
      createdAt: "2026-08-03T00:00:00.000Z",
      dimensions: null,
      displayName: "GPT-4o",
      distanceMetric: null,
      embeddingReferenceCount: 0,
      id: MODEL_CONFIG_ID,
      isActive: false,
      model: "gpt-4o",
      notes: null,
      provider: "openai",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    const eq = vi.fn().mockResolvedValue({
      error: null,
    });
    const deleteQuery = vi.fn(() => ({
      eq,
    }));
    const from = vi.fn(() => ({
      delete: deleteQuery,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiModel(MODEL_CONFIG_ID);

    expect(from).toHaveBeenCalledWith("ai_model_configs");
    expect(deleteQuery).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", MODEL_CONFIG_ID);
    expect(result).toEqual({
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("모델 삭제에 실패하면 운영 오류를 보고한다", async () => {
    const error = {
      message: "delete failed",
    };

    vi.mocked(getAdminAiModelDetail).mockResolvedValue({
      capability: "chat",
      createdAt: "2026-08-03T00:00:00.000Z",
      dimensions: null,
      displayName: "GPT-4o",
      distanceMetric: null,
      embeddingReferenceCount: 0,
      id: MODEL_CONFIG_ID,
      isActive: false,
      model: "gpt-4o",
      notes: null,
      provider: "openai",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });

    const eq = vi.fn().mockResolvedValue({
      error,
    });
    const deleteQuery = vi.fn(() => ({
      eq,
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        delete: deleteQuery,
      })),
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiModel(MODEL_CONFIG_ID);

    expect(result).toEqual({
      message: "delete failed",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_MODEL_CONFIG_DELETE_FAILED",
      message: "관리자 AI 모델 삭제에 실패했습니다.",
      operation: "delete_model_config",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});
