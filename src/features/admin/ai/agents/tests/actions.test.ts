import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import { reportAdminAiActionError } from "../../utils/report-admin-ai-action-error";
import { revalidateAdminAiPaths } from "../../utils/revalidate";
import {
  createAdminAiAgent,
  deleteAdminAiAgent,
  updateAdminAiAgent,
} from "../actions";

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

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Agent 생성 FormData fixture를 생성합니다.
 *
 * @returns Agent 생성 FormData
 */
function createAgentFormData() {
  const formData = new FormData();

  formData.set("description", "노트 기반 답변 Agent");
  formData.set("displayName", "노트 RAG 답변");
  formData.set("purpose", "노트를 기반으로 질문에 답변합니다.");
  formData.set("tags", "notes, rag");

  return formData;
}

/**
 * Agent 수정 FormData fixture를 생성합니다.
 *
 * @returns Agent 수정 FormData
 */
function createUpdateAgentFormData() {
  const formData = new FormData();

  formData.set("agentId", AGENT_ID);
  formData.set("description", "수정된 설명");
  formData.set("displayName", "수정된 Agent");
  formData.set("purpose", "수정된 목적");
  formData.set("tags", "notes, answer");

  return formData;
}

describe("createAdminAiAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("Agent를 생성하고 경로를 재검증한다", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: AGENT_ID,
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

    const result = await createAdminAiAgent(createAgentFormData());

    expect(from).toHaveBeenCalledWith("ai_prompt_agents");
    expect(insert).toHaveBeenCalledWith({
      description: "노트 기반 답변 Agent",
      display_name: "노트 RAG 답변",
      purpose: "노트를 기반으로 질문에 답변합니다.",
      tags: ["notes", "rag"],
    });
    expect(select).toHaveBeenCalledWith("id");
    expect(single).toHaveBeenCalledOnce();
    expect(result).toEqual({
      id: AGENT_ID,
      ok: true,
    });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("빈 nullable 값을 null로 저장한다", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: AGENT_ID,
      },
      error: null,
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

    const formData = createAgentFormData();

    formData.set("description", "");

    await createAdminAiAgent(formData);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: null,
      }),
    );
  });

  it("Agent 생성에 실패하면 운영 오류를 보고한다", async () => {
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

    const result = await createAdminAiAgent(createAgentFormData());

    expect(result).toEqual({
      message: "insert failed",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_AGENT_CREATE_FAILED",
      message: "관리자 AI agent 생성에 실패했습니다.",
      operation: "create_prompt_agent",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("updateAdminAiAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("입력이 올바르지 않으면 DB를 호출하지 않는다", async () => {
    const formData = createUpdateAgentFormData();

    formData.set("agentId", "invalid-id");

    const result = await updateAdminAiAgent(formData);

    expect(result.ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("Agent 운영 필드를 수정하고 경로를 재검증한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: AGENT_ID,
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

    const result = await updateAdminAiAgent(createUpdateAgentFormData());

    expect(from).toHaveBeenCalledWith("ai_prompt_agents");
    expect(update).toHaveBeenCalledWith({
      description: "수정된 설명",
      display_name: "수정된 Agent",
      purpose: "수정된 목적",
      tags: ["notes", "answer"],
    });
    expect(eq).toHaveBeenCalledWith("id", AGENT_ID);
    expect(select).toHaveBeenCalledWith("id");
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("Agent 수정에 실패하면 운영 오류를 보고한다", async () => {
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

    const result = await updateAdminAiAgent(createUpdateAgentFormData());

    expect(result).toEqual({
      message: "update failed",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_AGENT_UPDATE_FAILED",
      message: "관리자 AI agent 수정에 실패했습니다.",
      operation: "update_prompt_agent",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("수정할 Agent가 존재하지 않으면 실패하고 경로를 재검증하지 않는다", async () => {
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

    const result = await updateAdminAiAgent(createUpdateAgentFormData());

    expect(result).toEqual({
      message: "수정할 AI Agent를 찾을 수 없습니다.",
      ok: false,
    });
    expect(reportAdminAiActionError).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});

describe("deleteAdminAiAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("Agent ID가 올바르지 않으면 상세를 조회하지 않는다", async () => {
    const result = await deleteAdminAiAgent("invalid-id");

    expect(result).toEqual({
      message: "Agent ID가 올바르지 않습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("삭제 RPC가 NOT_FOUND를 반환하면 실패를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "NOT_FOUND",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiAgent(AGENT_ID);

    expect(result).toEqual({
      message: "Agent를 찾을 수 없습니다.",
      ok: false,
    });
    expect(rpc).toHaveBeenCalledWith("delete_admin_ai_agent", {
      p_agent_id: AGENT_ID,
    });
  });

  it("삭제 RPC가 NOT_DELETABLE을 반환하면 Settings 참조 메시지를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "NOT_DELETABLE",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiAgent(AGENT_ID);

    expect(result).toEqual({
      message:
        "AI Settings에서 사용 중인 Prompt Version이 있어 Agent를 삭제할 수 없습니다.",
      ok: false,
    });
    expect(rpc).toHaveBeenCalledWith("delete_admin_ai_agent", {
      p_agent_id: AGENT_ID,
    });
    expect(reportAdminAiActionError).not.toHaveBeenCalled();
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("삭제 RPC가 알 수 없는 결과를 반환하면 운영 오류를 보고하고 실패를 반환한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "UNKNOWN_RESULT",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiAgent(AGENT_ID);

    expect(result).toEqual({
      message: "Agent 삭제 요청을 처리하지 못했습니다.",
      ok: false,
    });
    expect(rpc).toHaveBeenCalledWith("delete_admin_ai_agent", {
      p_agent_id: AGENT_ID,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error: expect.any(Error),
      errorCode: "ADMIN_AI_AGENT_DELETE_FAILED",
      message: "관리자 AI agent 삭제 RPC 응답 검증에 실패했습니다.",
      operation: "delete_prompt_agent",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });

  it("삭제 RPC를 호출하고 경로를 재검증한다", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "OK",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiAgent(AGENT_ID);

    expect(rpc).toHaveBeenCalledWith("delete_admin_ai_agent", {
      p_agent_id: AGENT_ID,
    });
    expect(result).toEqual({ ok: true });
    expect(revalidateAdminAiPaths).toHaveBeenCalledOnce();
  });

  it("삭제 RPC가 실패하면 운영 오류를 보고한다", async () => {
    const error = {
      message: "agent delete failed",
    };

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await deleteAdminAiAgent(AGENT_ID);

    expect(result).toEqual({
      message: "agent delete failed",
      ok: false,
    });
    expect(reportAdminAiActionError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: "ADMIN_AI_AGENT_DELETE_FAILED",
      message: "관리자 AI agent 삭제에 실패했습니다.",
      operation: "delete_prompt_agent",
    });
    expect(revalidateAdminAiPaths).not.toHaveBeenCalled();
  });
});
