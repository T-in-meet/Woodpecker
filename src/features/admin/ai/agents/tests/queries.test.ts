import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../../utils/require-admin";
import { reportAdminAiLoadError } from "../../utils/report-load-error";
import {
  getAdminAiAgentDetail,
  getAdminAiAgentOptions,
  getAdminAiAgents,
} from "../queries";
import type { AdminAiAgentListQuery } from "../types";

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
const ACTIVE_AGENT_ID = "11111111-1111-4111-8111-111111111111";
const INACTIVE_AGENT_ID = "22222222-2222-4222-8222-222222222222";
const FAMILY_ID = "44444444-4444-4444-8444-444444444444";

const agents = [
  {
    createdAt: "2026-08-01T00:00:00.000Z",
    description: "노트 RAG 답변 Agent",
    displayName: "노트 RAG 답변",
    familyCount: 1,
    id: ACTIVE_AGENT_ID,
    purpose: "노트를 기반으로 질문에 답변합니다.",
    tags: ["notes", "rag"],
    updatedAt: "2026-08-03T03:00:00.000Z",
    versionCount: 2,
  },
  {
    createdAt: "2026-08-01T00:00:00.000Z",
    description: null,
    displayName: "노트 요약",
    familyCount: 0,
    id: INACTIVE_AGENT_ID,
    purpose: "노트를 요약합니다.",
    tags: ["notes"],
    updatedAt: "2026-08-03T01:00:00.000Z",
    versionCount: 0,
  },
];

const families = [
  {
    agentDisplayName: "노트 RAG 답변",
    agentId: ACTIVE_AGENT_ID,
    archivedVersionCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    description: "기본 답변 Family",
    displayName: "기본 답변",
    draftVersionCount: 1,
    id: FAMILY_ID,
    publishedVersionCount: 1,
    tags: ["default"],
    updatedAt: "2026-08-03T00:00:00.000Z",
  },
];

/**
 * Agent 목록 조회 조건 fixture를 생성합니다.
 *
 * @param overrides 덮어쓸 조회 조건
 * @returns Agent 목록 조회 조건
 */
function createQuery(
  overrides: Partial<AdminAiAgentListQuery> = {},
): AdminAiAgentListQuery {
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

/** Agent 상세 조회용 agent DB row fixture입니다. */
const activeAgentRow = {
  created_at: "2026-08-01T00:00:00.000Z",
  description: "노트 RAG 답변 Agent",
  display_name: "노트 RAG 답변",
  id: ACTIVE_AGENT_ID,
  purpose: "노트를 기반으로 질문에 답변합니다.",
  tags: ["notes", "rag"],
  updated_at: "2026-08-03T03:00:00.000Z",
};

/** Agent 상세 조회용 family DB row fixture입니다. */
const familyRow = {
  agent_id: ACTIVE_AGENT_ID,
  created_at: "2026-08-01T00:00:00.000Z",
  description: "기본 답변 Family",
  display_name: "기본 답변",
  id: FAMILY_ID,
  tags: ["default"],
  updated_at: "2026-08-03T00:00:00.000Z",
};

/** Agent 상세 조회용 published version DB row fixture입니다. */
const publishedVersionRow = {
  change_summary: "published",
  created_at: "2026-08-03T02:00:00.000Z",
  created_by: ADMIN_USER_ID,
  created_by_kind: "admin",
  display_name: "v2",
  family_id: FAMILY_ID,
  id: "55555555-5555-4555-8555-555555555555",
  lifecycle_status: "published",
  response_schema: {
    type: "object",
  },
  system_template: "system",
  tags: ["published"],
  user_template: "user",
  variables: [],
  version_number: 2,
};

/** Agent 상세 조회용 draft version DB row fixture입니다. */
const draftVersionRow = {
  ...publishedVersionRow,
  change_summary: "draft",
  created_at: "2026-08-03T01:00:00.000Z",
  display_name: "v1",
  id: "66666666-6666-4666-8666-666666666666",
  lifecycle_status: "draft",
  version_number: 1,
};

/**
 * Supabase admin client의 rpc 호출을 mock합니다.
 *
 * @param result rpc 반환값
 * @returns rpc mock
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

/**
 * Supabase select query chain mock을 생성합니다.
 *
 * @param result 최종 query 반환 결과
 * @returns query method mocks
 */
function createSelectQueryMock(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const query = {
    eq: vi.fn(),
    in: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    order: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return query;
}

/**
 * Agent 상세 조회에 사용할 scoped Supabase client를 mock합니다.
 *
 * @param overrides 테이블별 조회 결과 override
 * @returns query method mocks
 */
function mockAgentDetailQueryClient(
  overrides: {
    agent?: { data: unknown; error: { message: string } | null };
    families?: { data: unknown; error: { message: string } | null };
    versions?: { data: unknown; error: { message: string } | null };
  } = {},
) {
  const agentQuery = createSelectQueryMock(
    overrides.agent ?? {
      data: activeAgentRow,
      error: null,
    },
  );
  const familiesQuery = createSelectQueryMock(
    overrides.families ?? {
      data: [familyRow],
      error: null,
    },
  );
  const versionsQuery = createSelectQueryMock(
    overrides.versions ?? {
      data: [publishedVersionRow, draftVersionRow],
      error: null,
    },
  );
  const from = vi.fn((table: string) => {
    if (table === "ai_prompt_agents") {
      return agentQuery;
    }

    if (table === "ai_prompt_families") {
      return familiesQuery;
    }

    return versionsQuery;
  });

  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    agentQuery,
    familiesQuery,
    from,
    versionsQuery,
  };
}

/**
 * Agent 선택 목록 조회용 Supabase client를 mock합니다.
 *
 * @param result 선택 목록 조회 결과
 * @returns Supabase query method mocks
 */
function mockAgentOptionsQueryClient(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({
    order,
  }));
  const from = vi.fn(() => ({
    select,
  }));

  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    from,
    order,
    select,
  };
}

describe("getAdminAiAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("RPC 결과를 Agent 목록과 페이지네이션으로 매핑한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [
            {
              created_at: "2026-08-01T00:00:00.000Z",
              display_name: "노트 RAG 답변",
              family_count: 3,
              id: ACTIVE_AGENT_ID,
              purpose: "노트를 기반으로 질문에 답변합니다.",
              updated_at: "2026-08-03T00:00:00.000Z",
            },
          ],
          total_count: 11,
        },
      ],
      error: null,
    });

    const result = await getAdminAiAgents(createQuery({ page: 2 }));

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_agent_list",
      expect.objectContaining({
        p_page: 2,
        p_page_size: 10,
        p_search_field: "displayName",
        p_sort_direction: "desc",
        p_sort_field: "updatedAt",
      }),
    );
    expect(result.items).toEqual([
      {
        createdAt: "2026-08-01T00:00:00.000Z",
        displayName: "노트 RAG 답변",
        familyCount: 3,
        id: ACTIVE_AGENT_ID,
        purpose: "노트를 기반으로 질문에 답변합니다.",
        updatedAt: "2026-08-03T00:00:00.000Z",
      },
    ]);
    expect(result.pagination.total).toBe(11);
  });

  it("Family 수 필터와 정렬 조건을 RPC에 전달한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [],
          total_count: 0,
        },
      ],
      error: null,
    });

    await getAdminAiAgents(
      createQuery({
        filters: {
          familyCount: {
            field: "familyCount",
            type: "number-range",
            value: {
              max: 5,
              min: 1,
            },
          },
        },
        search: {
          field: "displayName",
          query: "노트",
        },
        sort: {
          direction: "asc",
          field: "familyCount",
        },
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_agent_list",
      expect.objectContaining({
        p_family_count_max: 5,
        p_family_count_min: 1,
        p_search_field: "displayName",
        p_search_query: "노트",
        p_sort_direction: "asc",
        p_sort_field: "familyCount",
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

    const result = await getAdminAiAgents(createQuery({ page: 99 }));

    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(12);
  });

  it("Agent 목록 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "agent list failed",
    };

    mockRpcClient({
      data: null,
      error,
    });

    await expect(getAdminAiAgents(createQuery())).rejects.toThrow(
      "Failed to load admin AI agents: agent list failed",
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
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });

  it("page가 1보다 작으면 첫 페이지로 보정한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [],
          total_count: 0,
        },
      ],
      error: null,
    });

    const result = await getAdminAiAgents(createQuery({ page: 0 }));

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_agent_list",
      expect.objectContaining({
        p_page: 1,
      }),
    );
    expect(result.pagination.page).toBe(1);
  });

  it("RPC 최상위 결과 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
    mockRpcClient({
      data: [],
      error: null,
    });

    await expect(getAdminAiAgents(createQuery())).rejects.toThrow();

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
      message: "관리자 AI agent 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
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

    const result = await getAdminAiAgents(createQuery({ page: 99 }));

    expect(result.items).toEqual([]);
    expect(result.pagination.total).toBe(12);
  });

  it("page가 1보다 작으면 첫 페이지로 보정한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [],
          total_count: 0,
        },
      ],
      error: null,
    });

    const result = await getAdminAiAgents(createQuery({ page: 0 }));

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_agent_list",
      expect.objectContaining({
        p_page: 1,
      }),
    );
    expect(result.pagination.page).toBe(1);
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

    await expect(getAdminAiAgents(createQuery())).rejects.toThrow();

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
      message: "관리자 AI agent 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });

  it("Agent 목록 item 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
    mockRpcClient({
      data: [
        {
          items: [
            {
              created_at: "2026-08-01T00:00:00.000Z",
              display_name: "노트 RAG 답변",
              family_count: "invalid",
              id: ACTIVE_AGENT_ID,
              purpose: "노트를 기반으로 질문에 답변합니다.",
              updated_at: "2026-08-03T00:00:00.000Z",
            },
          ],
          total_count: 1,
        },
      ],
      error: null,
    });

    await expect(getAdminAiAgents(createQuery())).rejects.toThrow();

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
      message: "관리자 AI agent 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });
});

describe("getAdminAiAgentDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
    mockAgentDetailQueryClient();
  });

  it("Agent와 해당 Agent의 Family 목록을 scoped query로 반환한다", async () => {
    const { agentQuery, familiesQuery, from, versionsQuery } =
      mockAgentDetailQueryClient();

    const result = await getAdminAiAgentDetail(ACTIVE_AGENT_ID);

    expect(result).toEqual({
      ...agents[0],
      families,
    });
    expect(from).toHaveBeenCalledWith("ai_prompt_agents");
    expect(from).toHaveBeenCalledWith("ai_prompt_families");
    expect(from).toHaveBeenCalledWith("ai_prompt_versions");
    expect(agentQuery.eq).toHaveBeenCalledWith("id", ACTIVE_AGENT_ID);
    expect(familiesQuery.eq).toHaveBeenCalledWith("agent_id", ACTIVE_AGENT_ID);
    expect(familiesQuery.order).toHaveBeenCalledWith("display_name", {
      ascending: true,
    });
    expect(versionsQuery.in).toHaveBeenCalledWith("family_id", [FAMILY_ID]);
  });

  it("Agent가 없으면 null을 반환한다", async () => {
    mockAgentDetailQueryClient({
      agent: {
        data: null,
        error: null,
      },
    });

    const result = await getAdminAiAgentDetail(
      "99999999-9999-4999-8999-999999999999",
    );

    expect(result).toBeNull();
  });
});

describe("getAdminAiAgentOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
  });

  it("Agent 선택 항목에 필요한 컬럼만 display name 오름차순으로 조회한다", async () => {
    const { from, order, select } = mockAgentOptionsQueryClient({
      data: [
        {
          display_name: "노트 요약",
          id: INACTIVE_AGENT_ID,
        },
        {
          display_name: "노트 RAG 답변",
          id: ACTIVE_AGENT_ID,
        },
      ],
      error: null,
    });

    const result = await getAdminAiAgentOptions();

    expect(from).toHaveBeenCalledWith("ai_prompt_agents");
    expect(select).toHaveBeenCalledWith("id,display_name");
    expect(order).toHaveBeenCalledWith("display_name", { ascending: true });
    expect(result).toEqual([
      {
        displayName: "노트 요약",
        id: INACTIVE_AGENT_ID,
      },
      {
        displayName: "노트 RAG 답변",
        id: ACTIVE_AGENT_ID,
      },
    ]);
  });

  it("Agent 선택 목록 조회에 실패하면 운영 오류를 보고하고 예외를 던진다", async () => {
    const error = {
      message: "agent options failed",
    };

    mockAgentOptionsQueryClient({
      data: null,
      error,
    });

    await expect(getAdminAiAgentOptions()).rejects.toThrow(
      "Failed to load admin AI agent options: agent options failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_LOAD_FAILED,
      message: "관리자 AI agent 선택 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT_OPTIONS,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });
});
