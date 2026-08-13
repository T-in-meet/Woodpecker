import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { loadAdminAiPromptGraph } from "../utils/load-admin-prompt-graph";
import { reportAdminAiLoadError } from "../utils/report-load-error";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../utils/report-load-error", () => ({
  reportAdminAiLoadError: vi.fn(),
}));

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const PUBLISHED_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const DRAFT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const ARCHIVED_VERSION_ID = "55555555-5555-4555-8555-555555555555";

const agentRow = {
  created_at: "2026-08-03T00:00:00.000Z",
  description: "노트 RAG 답변 agent",
  display_name: "노트 RAG 답변",
  id: AGENT_ID,
  purpose: "노트를 기반으로 질문에 답변합니다.",
  tags: ["notes", "rag"],
  updated_at: "2026-08-03T01:00:00.000Z",
};

const familyRow = {
  agent_id: AGENT_ID,
  created_at: "2026-08-03T00:00:00.000Z",
  description: "기본 답변 prompt family",
  display_name: "기본 답변",
  id: FAMILY_ID,
  tags: ["default"],
  updated_at: "2026-08-03T01:00:00.000Z",
};

const publishedVersionRow = {
  change_summary: "응답 형식 개선",
  created_at: "2026-08-03T03:00:00.000Z",
  created_by: ADMIN_USER_ID,
  created_by_kind: "admin",
  display_name: "기본 답변 v3",
  family_id: FAMILY_ID,
  id: PUBLISHED_VERSION_ID,
  lifecycle_status: "published",
  response_schema: {
    type: "object",
  },
  system_template: "시스템 프롬프트",
  tags: ["published"],
  user_template: "{{question}}",
  variables: {
    question: {
      required: true,
      type: "string",
    },
  },
  version_number: 3,
};

const draftVersionRow = {
  ...publishedVersionRow,
  change_summary: "초안 작성",
  created_at: "2026-08-03T02:00:00.000Z",
  display_name: "기본 답변 v2",
  id: DRAFT_VERSION_ID,
  lifecycle_status: "draft",
  version_number: 2,
};

const archivedVersionRow = {
  ...publishedVersionRow,
  change_summary: "초기 버전",
  created_at: "2026-08-03T01:00:00.000Z",
  display_name: "기본 답변 v1",
  id: ARCHIVED_VERSION_ID,
  lifecycle_status: "archived",
  version_number: 1,
};

type QueryResult = {
  data: unknown[] | null;
  error: {
    message: string;
  } | null;
};

/**
 * Prompt Graph 조회에 사용할 Supabase admin client를 mock합니다.
 *
 * @param results 테이블별 조회 결과
 * @returns Supabase from mock
 */
function mockAdminClient(results: {
  agents?: QueryResult;
  families?: QueryResult;
  versions?: QueryResult;
}) {
  const tableResults: Record<string, QueryResult> = {
    ai_prompt_agents: results.agents ?? {
      data: [agentRow],
      error: null,
    },
    ai_prompt_families: results.families ?? {
      data: [familyRow],
      error: null,
    },
    ai_prompt_versions: results.versions ?? {
      data: [draftVersionRow, archivedVersionRow, publishedVersionRow],
      error: null,
    },
  };

  const from = vi.fn((table: string) => ({
    select: vi.fn().mockResolvedValue(tableResults[table]),
  }));

  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    from,
  };
}

describe("loadAdminAiPromptGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("agent, family, version 그래프와 집계 정보를 생성한다", async () => {
    mockAdminClient({});

    const result = await loadAdminAiPromptGraph(ADMIN_USER_ID);

    expect(result.agents).toEqual([
      {
        createdAt: agentRow.created_at,
        description: agentRow.description,
        displayName: agentRow.display_name,
        familyCount: 1,
        id: AGENT_ID,
        purpose: agentRow.purpose,
        tags: agentRow.tags,
        updatedAt: agentRow.updated_at,
        versionCount: 3,
      },
    ]);

    expect(result.families).toEqual([
      {
        agentDisplayName: "노트 RAG 답변",
        agentId: AGENT_ID,
        archivedVersionCount: 1,
        createdAt: familyRow.created_at,
        description: familyRow.description,
        displayName: familyRow.display_name,
        draftVersionCount: 1,
        id: FAMILY_ID,
        publishedVersionCount: 1,
        tags: familyRow.tags,
        updatedAt: familyRow.updated_at,
      },
    ]);

    expect(
      result.versionsByFamilyId
        .get(FAMILY_ID)
        ?.map((version) => version.versionNumber),
    ).toEqual([3, 2, 1]);

    expect(reportAdminAiLoadError).not.toHaveBeenCalled();
  });

  it("연결된 agent가 없는 family는 운영 오류를 보고하고 누락된 agent 정보를 표시한다", async () => {
    const missingAgentId = "77777777-7777-4777-8777-777777777777";

    mockAdminClient({
      families: {
        data: [
          {
            ...familyRow,
            agent_id: missingAgentId,
          },
        ],
        error: null,
      },
      versions: {
        data: [],
        error: null,
      },
    });

    const result = await loadAdminAiPromptGraph(ADMIN_USER_ID);

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        agentId: missingAgentId,
        familyId: FAMILY_ID,
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
      message:
        "관리자 AI prompt graph Prompt Family의 Agent 연결 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    expect(result.families[0]).toMatchObject({
      agentDisplayName: "(missing-agent)",
      agentId: missingAgentId,
    });

    expect(result.agents[0]).toMatchObject({
      familyCount: 0,
      versionCount: 0,
    });
  });

  it("agent 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "agent query failed",
    };

    const { from } = mockAdminClient({
      agents: {
        data: null,
        error,
      },
    });

    await expect(loadAdminAiPromptGraph(ADMIN_USER_ID)).rejects.toThrow(
      "Failed to load admin AI agents: agent query failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("family 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "family query failed",
    };

    const { from } = mockAdminClient({
      families: {
        data: null,
        error,
      },
    });

    await expect(loadAdminAiPromptGraph(ADMIN_USER_ID)).rejects.toThrow(
      "Failed to load admin AI prompt families: family query failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
      message: "관리자 AI prompt family 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("version 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "version query failed",
    };

    const { from } = mockAdminClient({
      versions: {
        data: null,
        error,
      },
    });

    await expect(loadAdminAiPromptGraph(ADMIN_USER_ID)).rejects.toThrow(
      "Failed to load admin AI prompt versions: version query failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
      message: "관리자 AI prompt version 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("agent DB row가 스키마와 일치하지 않으면 Prompt Graph 검증 오류를 보고하고 예외를 던진다", async () => {
    mockAdminClient({
      agents: {
        data: [
          {
            ...agentRow,
            tags: "notes",
          },
        ],
        error: null,
      },
    });

    await expect(loadAdminAiPromptGraph(ADMIN_USER_ID)).rejects.toThrow();

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        graphPart: "agents",
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
      message: "관리자 AI prompt graph Agent 데이터 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });

  it("family DB row가 스키마와 일치하지 않으면 Prompt Graph 검증 오류를 보고하고 예외를 던진다", async () => {
    mockAdminClient({
      families: {
        data: [
          {
            ...familyRow,
            tags: "default",
          },
        ],
        error: null,
      },
    });

    await expect(loadAdminAiPromptGraph(ADMIN_USER_ID)).rejects.toThrow();

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        graphPart: "families",
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
      message:
        "관리자 AI prompt graph Prompt Family 데이터 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });

  it("version DB row가 스키마와 일치하지 않으면 Prompt Graph 검증 오류를 보고하고 예외를 던진다", async () => {
    mockAdminClient({
      versions: {
        data: [
          {
            ...publishedVersionRow,
            version_number: "3",
          },
        ],
        error: null,
      },
    });

    await expect(loadAdminAiPromptGraph(ADMIN_USER_ID)).rejects.toThrow();

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        graphPart: "versions",
      },
      error: expect.any(Error),
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_GRAPH_INVALID,
      message:
        "관리자 AI prompt graph Prompt Version 데이터 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_PROMPT_GRAPH,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });
});
