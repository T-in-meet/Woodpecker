import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import type { AdminAiPromptVersionRow } from "../../types";
import { reportAdminAiActionError } from "../../utils/report-admin-ai-action-error";
import { revalidateAdminAiPaths } from "../../utils/revalidate";
import {
  archiveAdminAiPromptVersion,
  createAdminAiPromptFamily,
  createAdminAiPromptVersion,
  deleteAdminAiPromptFamily,
  deleteAdminAiPromptVersion,
  publishAdminAiPromptVersion,
  updateAdminAiPromptFamily,
  updateAdminAiPromptVersion,
} from "../actions";
import { getAdminAiPromptVersionDetail } from "../queries";
import type { AdminAiPromptFamilyDetail } from "../types";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../../utils/report-admin-ai-action-error", () => ({
  reportAdminAiActionError: vi.fn(),
}));

vi.mock("../../utils/revalidate", () => ({
  revalidateAdminAiPaths: vi.fn(),
}));

vi.mock("../queries", () => ({
  getAdminAiPromptVersionDetail: vi.fn(),
}));

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

/**
 * Prompt Family 생성 FormData를 생성합니다.
 *
 * @returns Prompt Family 생성 FormData
 */
function createFamilyFormData() {
  const formData = new FormData();

  formData.set("agentId", AGENT_ID);
  formData.set("changeSummary", "최초 버전");
  formData.set("description", "기본 답변 Prompt");
  formData.set("displayName", "Default");
  formData.set("responseSchema", '{"type":"object"}');
  formData.set("systemTemplate", "시스템 프롬프트");
  formData.set("tags", "default, answer");
  formData.set("userTemplate", "{{question}}");
  formData.set("variables", '[{"name":"question","type":"string"}]');
  formData.set("versionDisplayName", "기본 버전");

  return formData;
}

/**
 * Prompt Family 수정 FormData를 생성합니다.
 *
 * @returns Prompt Family 수정 FormData
 */
function createUpdateFamilyFormData() {
  const formData = new FormData();

  formData.set("description", "수정된 설명");
  formData.set("displayName", "수정된 Family");
  formData.set("familyId", FAMILY_ID);
  formData.set("tags", "default, updated");

  return formData;
}

/**
 * Prompt Version 생성 FormData를 생성합니다.
 *
 * @returns Prompt Version 생성 FormData
 */
function createVersionFormData() {
  const formData = new FormData();

  formData.set("changeSummary", "새 버전");
  formData.set("familyId", FAMILY_ID);
  formData.set("responseSchema", '{"type":"object"}');
  formData.set("systemTemplate", "시스템 프롬프트");
  formData.set("tags", "default, draft");
  formData.set("userTemplate", "{{question}}");
  formData.set("variables", '[{"name":"question","type":"string"}]');
  formData.set("versionDisplayName", "버전 2");

  return formData;
}

/**
 * Prompt Version 수정 FormData를 생성합니다.
 *
 * @returns Prompt Version 수정 FormData
 */
function createUpdateVersionFormData() {
  const formData = createVersionFormData();

  formData.set("changeSummary", "수정된 초안");
  formData.set("systemTemplate", "수정된 시스템 프롬프트");
  formData.set("userTemplate", "수정된 사용자 프롬프트");
  formData.set("versionDisplayName", "수정된 버전");
  formData.set("versionId", VERSION_ID);

  return formData;
}

/**
 * Prompt Version fixture를 생성합니다.
 *
 * @param overrides 덮어쓸 Version 필드
 * @returns Prompt Version fixture
 */
function createVersionRow(
  overrides: Partial<AdminAiPromptVersionRow> = {},
): AdminAiPromptVersionRow {
  return {
    changeSummary: "초안",
    createdAt: "2026-08-03T00:00:00.000Z",
    createdBy: ADMIN_USER_ID,
    createdByKind: "admin",
    displayName: "기본 버전",
    familyId: FAMILY_ID,
    id: VERSION_ID,
    lifecycleStatus: "draft",
    responseSchema: {
      type: "object",
    },
    systemTemplate: "시스템 프롬프트",
    tags: ["default"],
    userTemplate: "{{question}}",
    variables: [
      {
        name: "question",
        type: "string",
      },
    ],
    versionNumber: 1,
    ...overrides,
  };
}

/**
 * Prompt Family 상세 fixture를 생성합니다.
 *
 * @param overrides 덮어쓸 Family 필드
 * @returns Prompt Family 상세 fixture
 */
function createFamilyDetail(
  overrides: Partial<AdminAiPromptFamilyDetail> = {},
): AdminAiPromptFamilyDetail {
  return {
    agentDisplayName: "노트 RAG 답변",
    agentId: AGENT_ID,
    archivedVersionCount: 0,
    createdAt: "2026-08-03T00:00:00.000Z",
    description: "기본 답변 Prompt",
    displayName: "Default",
    draftVersionCount: 1,
    id: FAMILY_ID,
    publishedVersionCount: 0,
    tags: ["default"],
    updatedAt: "2026-08-03T00:00:00.000Z",
    versions: [createVersionRow()],
    ...overrides,
  };
}

/**
 * Supabase RPC mock client를 설정합니다.
 *
 * @param data RPC 반환 데이터
 * @param error RPC 오류
 * @returns RPC mock
 */
function mockRpc(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({
    data,
    error,
  });

  vi.mocked(createAdminClient).mockReturnValue({
    rpc,
  } as unknown as ReturnType<typeof createAdminClient>);

  return rpc;
}

/**
 * Supabase update mock client를 설정합니다.
 *
 * @param data UPDATE 후 반환할 row
 * @param error DB 오류
 * @returns query mock
 */
function mockVersionUpdate(
  data: { id: string } | null,
  error: { message: string } | null = null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data,
    error,
  });

  const select = vi.fn(() => ({
    maybeSingle,
  }));

  const lifecycleEq = vi.fn(() => ({
    select,
  }));

  const idEq = vi.fn(() => ({
    eq: lifecycleEq,
  }));

  const update = vi.fn(() => ({
    eq: idEq,
  }));

  const from = vi.fn(() => ({
    update,
  }));

  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    from,
    idEq,
    lifecycleEq,
    maybeSingle,
    select,
    update,
  };
}

/**
 * Supabase delete mock client를 설정합니다.
 *
 * @param data DELETE 후 반환할 row
 * @param error DB 오류
 * @returns query mock
 */
function mockVersionDelete(
  data: { id: string } | null,
  error: { message: string } | null = null,
) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data,
    error,
  });

  const select = vi.fn(() => ({
    maybeSingle,
  }));

  const lifecycleNeq = vi.fn(() => ({
    select,
  }));

  const idEq = vi.fn(() => ({
    neq: lifecycleNeq,
  }));

  const deleteQuery = vi.fn(() => ({
    eq: idEq,
  }));

  const from = vi.fn(() => ({
    delete: deleteQuery,
  }));

  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    deleteQuery,
    from,
    idEq,
    lifecycleNeq,
    maybeSingle,
    select,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
});

describe("createAdminAiPromptFamily", () => {
  it("Family와 초기 Version을 생성한다", async () => {
    const rpc = mockRpc(FAMILY_ID);

    const result = await createAdminAiPromptFamily(createFamilyFormData());

    expect(rpc).toHaveBeenCalledWith(
      "create_ai_prompt_family_with_initial_version",
      {
        p_admin_user_id: ADMIN_USER_ID,
        p_agent_id: AGENT_ID,
        p_change_summary: "최초 버전",
        p_description: "기본 답변 Prompt",
        p_display_name: "Default",
        p_response_schema: {
          type: "object",
        },
        p_system_template: "시스템 프롬프트",
        p_tags: ["default", "answer"],
        p_user_template: "{{question}}",
        p_variables: [
          {
            name: "question",
            type: "string",
          },
        ],
        p_version_display_name: "기본 버전",
      },
    );
    expect(result).toEqual({
      id: FAMILY_ID,
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("빈 JSON 입력은 기본값으로 보정해 Family와 초기 Version을 생성한다", async () => {
    const formData = createFamilyFormData();
    const rpc = mockRpc(FAMILY_ID);

    formData.set("responseSchema", "");
    formData.set("variables", "   ");

    const result = await createAdminAiPromptFamily(formData);

    expect(rpc).toHaveBeenCalledWith(
      "create_ai_prompt_family_with_initial_version",
      expect.objectContaining({
        p_response_schema: {},
        p_variables: [],
      }),
    );
    expect(result).toEqual({
      id: FAMILY_ID,
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("RPC 오류가 발생하면 실패하고 운영 오류를 보고한다", async () => {
    const error = { message: "family create failed" };

    mockRpc(null, error);

    const result = await createAdminAiPromptFamily(createFamilyFormData());

    expect(result).toEqual({
      message: "Prompt Family를 생성하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_FAMILY_CREATE_FAILED",
      message: "관리자 AI prompt family 생성에 실패했습니다.",
      operation: "create_prompt_family",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("updateAdminAiPromptFamily", () => {
  it("Family 운영 필드를 수정한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: FAMILY_ID,
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

    const result = await updateAdminAiPromptFamily(
      createUpdateFamilyFormData(),
    );

    expect(from).toHaveBeenCalledWith("ai_prompt_families");
    expect(update).toHaveBeenCalledWith({
      description: "수정된 설명",
      display_name: "수정된 Family",
      tags: ["default", "updated"],
    });
    expect(eq).toHaveBeenCalledWith("id", FAMILY_ID);
    expect(select).toHaveBeenCalledWith("id");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("수정 대상 Family가 없으면 실패하고 경로를 재검증하지 않는다", async () => {
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

    const result = await updateAdminAiPromptFamily(
      createUpdateFamilyFormData(),
    );

    expect(result).toEqual({
      message: "수정할 Prompt Family를 찾을 수 없습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("DB 오류가 발생하면 실패하고 운영 오류를 보고한다", async () => {
    const error = { message: "family update failed" };

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

    const result = await updateAdminAiPromptFamily(
      createUpdateFamilyFormData(),
    );

    expect(result).toEqual({
      message: "Prompt Family를 수정하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_FAMILY_UPDATE_FAILED",
      message: "관리자 AI prompt family 수정에 실패했습니다.",
      operation: "update_prompt_family",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("deleteAdminAiPromptFamily", () => {
  it("삭제 가능한 Family를 삭제한다", async () => {
    const rpc = mockRpc("OK");

    const result = await deleteAdminAiPromptFamily(FAMILY_ID);

    expect(rpc).toHaveBeenCalledWith("delete_admin_ai_prompt_family", {
      p_family_id: FAMILY_ID,
    });
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("NOT_FOUND를 반환하면 실패한다", async () => {
    mockRpc("NOT_FOUND");

    const result = await deleteAdminAiPromptFamily(FAMILY_ID);

    expect(result).toEqual({
      message: "Prompt family를 찾을 수 없습니다.",
      ok: false,
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("Settings에서 참조 중이면 삭제 불가 메시지를 반환한다", async () => {
    mockRpc("NOT_DELETABLE");

    const result = await deleteAdminAiPromptFamily(FAMILY_ID);

    expect(result).toEqual({
      message:
        "AI Settings에서 사용 중인 Prompt Version이 있어 Prompt Family를 삭제할 수 없습니다.",
      ok: false,
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("알 수 없는 삭제 RPC 결과를 반환하면 실패한다", async () => {
    mockRpc("UNKNOWN_RESULT");

    const result = await deleteAdminAiPromptFamily(FAMILY_ID);

    expect(result).toEqual({
      message: "Prompt Family 삭제 요청을 처리하지 못했습니다.",
      ok: false,
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("RPC 오류가 발생하면 실패하고 운영 오류를 보고한다", async () => {
    const error = { message: "family delete failed" };

    mockRpc(null, error);

    const result = await deleteAdminAiPromptFamily(FAMILY_ID);

    expect(result).toEqual({
      message: "Prompt Family를 삭제하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_FAMILY_DELETE_FAILED",
      message: "관리자 AI prompt family 삭제에 실패했습니다.",
      operation: "delete_prompt_family",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("createAdminAiPromptVersion", () => {
  it("Prompt Version을 생성한다", async () => {
    const rpc = mockRpc(VERSION_ID);

    const result = await createAdminAiPromptVersion(createVersionFormData());

    expect(rpc).toHaveBeenCalledWith("create_ai_prompt_version", {
      p_admin_user_id: ADMIN_USER_ID,
      p_change_summary: "새 버전",
      p_display_name: "버전 2",
      p_family_id: FAMILY_ID,
      p_response_schema: {
        type: "object",
      },
      p_system_template: "시스템 프롬프트",
      p_tags: ["default", "draft"],
      p_user_template: "{{question}}",
      p_variables: [
        {
          name: "question",
          type: "string",
        },
      ],
    });
    expect(result).toEqual({
      id: VERSION_ID,
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("빈 JSON 입력은 기본값으로 보정해 Prompt Version을 생성한다", async () => {
    const formData = createVersionFormData();
    const rpc = mockRpc(VERSION_ID);

    formData.set("responseSchema", "");
    formData.set("variables", "   ");

    const result = await createAdminAiPromptVersion(formData);

    expect(rpc).toHaveBeenCalledWith(
      "create_ai_prompt_version",
      expect.objectContaining({
        p_response_schema: {},
        p_variables: [],
      }),
    );
    expect(result).toEqual({
      id: VERSION_ID,
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("RPC 오류가 발생하면 실패하고 운영 오류를 보고한다", async () => {
    const error = { message: "version create failed" };

    mockRpc(null, error);

    const result = await createAdminAiPromptVersion(createVersionFormData());

    expect(result).toEqual({
      message: "Prompt Version을 생성하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_VERSION_CREATE_FAILED",
      message: "관리자 AI prompt version 생성에 실패했습니다.",
      operation: "create_prompt_version",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("updateAdminAiPromptVersion", () => {
  beforeEach(() => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue({
      family: createFamilyDetail(),
      version: createVersionRow(),
    });
  });

  it("Draft Version의 모든 수정 가능 필드를 수정한다", async () => {
    const { lifecycleEq, maybeSingle, update } = mockVersionUpdate({
      id: VERSION_ID,
    });

    const result = await updateAdminAiPromptVersion(
      createUpdateVersionFormData(),
    );

    expect(update).toHaveBeenCalledWith({
      change_summary: "수정된 초안",
      display_name: "수정된 버전",
      response_schema: {
        type: "object",
      },
      system_template: "수정된 시스템 프롬프트",
      tags: ["default", "draft"],
      user_template: "수정된 사용자 프롬프트",
      variables: [
        {
          name: "question",
          type: "string",
        },
      ],
    });
    expect(lifecycleEq).toHaveBeenCalledWith("lifecycle_status", "draft");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("빈 JSON 입력은 create와 동일한 기본값으로 보정해 수정한다", async () => {
    const formData = createUpdateVersionFormData();
    const { lifecycleEq, maybeSingle, update } = mockVersionUpdate({
      id: VERSION_ID,
    });

    formData.set("responseSchema", "");
    formData.set("variables", "   ");

    const result = await updateAdminAiPromptVersion(formData);

    expect(update).toHaveBeenCalledWith({
      change_summary: "수정된 초안",
      display_name: "수정된 버전",
      response_schema: {},
      system_template: "수정된 시스템 프롬프트",
      tags: ["default", "draft"],
      user_template: "수정된 사용자 프롬프트",
      variables: [],
    });
    expect(lifecycleEq).toHaveBeenCalledWith("lifecycle_status", "draft");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("Published Version은 Prompt Template을 제외한 필드를 수정한다", async () => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue({
      family: createFamilyDetail(),
      version: createVersionRow({
        lifecycleStatus: "published",
      }),
    });

    const { lifecycleEq, maybeSingle, update } = mockVersionUpdate({
      id: VERSION_ID,
    });

    const result = await updateAdminAiPromptVersion(
      createUpdateVersionFormData(),
    );

    expect(update).toHaveBeenCalledWith({
      change_summary: "수정된 초안",
      display_name: "수정된 버전",
      response_schema: {
        type: "object",
      },
      tags: ["default", "draft"],
      variables: [
        {
          name: "question",
          type: "string",
        },
      ],
    });
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        system_template: expect.anything(),
      }),
    );
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        user_template: expect.anything(),
      }),
    );
    expect(lifecycleEq).toHaveBeenCalledWith("lifecycle_status", "published");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("Archived Version은 수정하지 않는다", async () => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue({
      family: createFamilyDetail(),
      version: createVersionRow({
        lifecycleStatus: "archived",
      }),
    });

    const result = await updateAdminAiPromptVersion(
      createUpdateVersionFormData(),
    );

    expect(result).toEqual({
      message: "Archived Version은 수정할 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("Prompt Version을 찾을 수 없으면 수정하지 않는다", async () => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue(null);

    const result = await updateAdminAiPromptVersion(
      createUpdateVersionFormData(),
    );

    expect(result).toEqual({
      message: "Prompt Version을 찾을 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("UPDATE 결과가 없으면 lifecycle 변경으로 판단하고 실패한다", async () => {
    mockVersionUpdate(null);

    const result = await updateAdminAiPromptVersion(
      createUpdateVersionFormData(),
    );

    expect(result).toEqual({
      message: "Prompt Version 상태가 변경되었습니다. 다시 시도해주세요.",
      ok: false,
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("DB 오류가 발생하면 실패하고 운영 오류를 보고한다", async () => {
    const error = { message: "version update failed" };

    mockVersionUpdate(null, error);

    const result = await updateAdminAiPromptVersion(
      createUpdateVersionFormData(),
    );

    expect(result).toEqual({
      message: "Prompt Version을 수정하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_VERSION_UPDATE_FAILED",
      message: "관리자 AI prompt version 수정에 실패했습니다.",
      operation: "update_prompt_version",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("publishAdminAiPromptVersion", () => {
  it("RPC 결과를 성공 메시지로 반환한다", async () => {
    const rpc = mockRpc("OK");

    const result = await publishAdminAiPromptVersion(VERSION_ID);

    expect(rpc).toHaveBeenCalledWith("publish_ai_prompt_version", {
      p_version_id: VERSION_ID,
    });
    expect(result).toEqual({
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("RPC 오류가 발생하면 운영 오류를 보고한다", async () => {
    const error = { message: "publish failed" };

    mockRpc(null, error);

    const result = await publishAdminAiPromptVersion(VERSION_ID);

    expect(result).toEqual({
      message: "Prompt Version을 Publish하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_VERSION_PUBLISH_FAILED",
      message: "관리자 AI prompt version publish에 실패했습니다.",
      operation: "publish_prompt_version",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("archiveAdminAiPromptVersion", () => {
  it("RPC 결과를 성공 메시지로 반환한다", async () => {
    const rpc = mockRpc("OK");

    const result = await archiveAdminAiPromptVersion(VERSION_ID);

    expect(rpc).toHaveBeenCalledWith("archive_ai_prompt_version", {
      p_version_id: VERSION_ID,
    });
    expect(result).toEqual({
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("Settings에서 참조 중이면 Archive 불가 메시지를 반환한다", async () => {
    mockRpc("NOT_DELETABLE");

    const result = await archiveAdminAiPromptVersion(VERSION_ID);

    expect(result).toEqual({
      message:
        "AI Settings에서 사용 중인 Prompt Version은 Archive할 수 없습니다.",
      ok: false,
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("RPC 오류가 발생하면 운영 오류를 보고한다", async () => {
    const error = { message: "archive failed" };

    mockRpc(null, error);

    const result = await archiveAdminAiPromptVersion(VERSION_ID);

    expect(result).toEqual({
      message: "Prompt Version을 Archive하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_VERSION_ARCHIVE_FAILED",
      message: "관리자 AI prompt version archive에 실패했습니다.",
      operation: "archive_prompt_version",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("deleteAdminAiPromptVersion", () => {
  beforeEach(() => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue({
      family: createFamilyDetail(),
      version: createVersionRow(),
    });
  });

  it("Draft Version을 삭제한다", async () => {
    const { lifecycleNeq, maybeSingle } = mockVersionDelete({
      id: VERSION_ID,
    });

    const result = await deleteAdminAiPromptVersion(FAMILY_ID, VERSION_ID);

    expect(lifecycleNeq).toHaveBeenCalledWith("lifecycle_status", "published");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("Archived Version을 삭제한다", async () => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue({
      family: createFamilyDetail(),
      version: createVersionRow({
        lifecycleStatus: "archived",
      }),
    });

    const { lifecycleNeq, maybeSingle } = mockVersionDelete({
      id: VERSION_ID,
    });

    const result = await deleteAdminAiPromptVersion(FAMILY_ID, VERSION_ID);

    expect(lifecycleNeq).toHaveBeenCalledWith("lifecycle_status", "published");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("Published Version은 삭제하지 않는다", async () => {
    vi.mocked(getAdminAiPromptVersionDetail).mockResolvedValue({
      family: createFamilyDetail(),
      version: createVersionRow({
        lifecycleStatus: "published",
      }),
    });

    const result = await deleteAdminAiPromptVersion(FAMILY_ID, VERSION_ID);

    expect(result).toEqual({
      message: "published version은 삭제할 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("DELETE 결과가 없으면 실패하고 경로를 재검증하지 않는다", async () => {
    mockVersionDelete(null);

    const result = await deleteAdminAiPromptVersion(FAMILY_ID, VERSION_ID);

    expect(result).toEqual({
      message: "published version은 삭제할 수 없습니다.",
      ok: false,
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("DB 오류가 발생하면 실패하고 운영 오류를 보고한다", async () => {
    const error = { message: "version delete failed" };

    mockVersionDelete(null, error);

    const result = await deleteAdminAiPromptVersion(FAMILY_ID, VERSION_ID);

    expect(result).toEqual({
      message: "Prompt Version을 삭제하지 못했습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_PROMPT_VERSION_DELETE_FAILED",
      message: "관리자 AI prompt version 삭제에 실패했습니다.",
      operation: "delete_prompt_version",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});
