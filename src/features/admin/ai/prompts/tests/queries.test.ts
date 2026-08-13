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
  getAdminAiPromptFamilies,
  getAdminAiPromptFamilyDetail,
  getAdminAiPromptFamilyOptions,
  getAdminAiPromptVersionDetail,
  getAdminAiPromptVersionOptions,
} from "../queries";
import type { AdminAiPromptListQuery } from "../types";

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

const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_AGENT_ID = "22222222-2222-4222-8222-222222222222";
const FAMILY_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_FAMILY_ID = "44444444-4444-4444-8444-444444444444";
const PUBLISHED_VERSION_ID = "55555555-5555-4555-8555-555555555555";
const OLDER_PUBLISHED_VERSION_ID = "66666666-6666-4666-8666-666666666666";
const DRAFT_VERSION_ID = "77777777-7777-4777-8777-777777777777";

/**
 * Prompt Family 목록 조회 조건 fixture를 생성합니다.
 *
 * @param overrides 덮어쓸 조회 조건
 * @returns Prompt Family 목록 조회 조건
 */
function createQuery(
  overrides: Partial<AdminAiPromptListQuery> = {},
): AdminAiPromptListQuery {
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

const publishedVersion = {
  changeSummary: "응답 형식 개선",
  createdAt: "2026-08-03T03:00:00.000Z",
  createdBy: ADMIN_USER_ID,
  createdByKind: "admin" as const,
  displayName: "기본 답변 v3",
  familyId: FAMILY_ID,
  id: PUBLISHED_VERSION_ID,
  lifecycleStatus: "published" as const,
  responseSchema: {
    type: "object",
  },
  systemTemplate: "시스템 프롬프트 v3",
  tags: ["published"],
  userTemplate: "{{question}}",
  variables: {
    question: {
      type: "string",
    },
  },
  versionNumber: 3,
};

const olderPublishedVersion = {
  ...publishedVersion,
  changeSummary: "이전 발행 버전",
  createdAt: "2026-08-03T02:00:00.000Z",
  displayName: "기본 답변 v2",
  id: OLDER_PUBLISHED_VERSION_ID,
  versionNumber: 2,
};

const draftVersion = {
  ...publishedVersion,
  changeSummary: "새 초안",
  createdAt: "2026-08-03T04:00:00.000Z",
  displayName: "기본 답변 v4 draft",
  id: DRAFT_VERSION_ID,
  lifecycleStatus: "draft" as const,
  versionNumber: 4,
};

const families = [
  {
    agentDisplayName: "노트 RAG 답변",
    agentId: AGENT_ID,
    archivedVersionCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    description: "기본 답변 Prompt",
    displayName: "기본 답변",
    draftVersionCount: 1,
    id: FAMILY_ID,
    publishedVersionCount: 2,
    tags: ["default"],
    updatedAt: "2026-08-03T04:00:00.000Z",
  },
  {
    agentDisplayName: "노트 RAG 답변",
    agentId: AGENT_ID,
    archivedVersionCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    description: "간결한 답변 Prompt",
    displayName: "간결한 답변",
    draftVersionCount: 0,
    id: OTHER_FAMILY_ID,
    publishedVersionCount: 0,
    tags: ["concise"],
    updatedAt: "2026-08-03T01:00:00.000Z",
  },
  {
    agentDisplayName: "다른 Agent",
    agentId: OTHER_AGENT_ID,
    archivedVersionCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    description: null,
    displayName: "다른 Family",
    draftVersionCount: 0,
    id: "88888888-8888-4888-8888-888888888888",
    publishedVersionCount: 0,
    tags: [],
    updatedAt: "2026-08-03T00:00:00.000Z",
  },
];

/**
 * Prompt graph 조회 결과를 설정합니다.
 */
function mockPromptGraph() {
  vi.mocked(loadAdminAiPromptGraph).mockResolvedValue({
    agents: [],
    families,
    versionsByFamilyId: new Map([
      [FAMILY_ID, [draftVersion, publishedVersion, olderPublishedVersion]],
    ]),
  });
}

/**
 * Supabase RPC client를 설정합니다.
 *
 * @param result RPC 반환 결과
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER_ID);
});

describe("getAdminAiPromptFamilies", () => {
  it("RPC 결과를 Prompt Family 목록과 페이지네이션으로 변환한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [
            {
              agent_display_name: "노트 RAG 답변",
              agent_id: AGENT_ID,
              archived_version_count: 1,
              created_at: "2026-08-01T00:00:00.000Z",
              display_name: "기본 답변",
              draft_version_count: 1,
              id: FAMILY_ID,
              published_version_count: 2,
              updated_at: "2026-08-03T04:00:00.000Z",
            },
          ],
          total_count: 11,
        },
      ],
      error: null,
    });

    const result = await getAdminAiPromptFamilies(
      createQuery({
        page: 2,
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_prompt_family_list",
      expect.objectContaining({
        p_page: 2,
        p_page_size: 10,
        p_search_field: "displayName",
        p_search_query: "",
        p_sort_direction: "desc",
        p_sort_field: "updatedAt",
      }),
    );

    expect(result).toEqual({
      items: [
        {
          agentDisplayName: "노트 RAG 답변",
          agentId: AGENT_ID,
          archivedVersionCount: 1,
          createdAt: "2026-08-01T00:00:00.000Z",
          displayName: "기본 답변",
          draftVersionCount: 1,
          id: FAMILY_ID,
          publishedVersionCount: 2,
          updatedAt: "2026-08-03T04:00:00.000Z",
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

  it("1보다 작은 page를 1로 보정한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [],
          total_count: 0,
        },
      ],
      error: null,
    });

    const result = await getAdminAiPromptFamilies(
      createQuery({
        page: 0,
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_prompt_family_list",
      expect.objectContaining({
        p_page: 1,
      }),
    );
    expect(result.pagination.page).toBe(1);
  });

  it("목록 필터와 검색, 정렬 조건을 RPC에 전달한다", async () => {
    const rpc = mockRpcClient({
      data: [
        {
          items: [],
          total_count: 0,
        },
      ],
      error: null,
    });

    await getAdminAiPromptFamilies(
      createQuery({
        filters: {
          agentId: {
            field: "agentId",
            type: "multi-select",
            value: [AGENT_ID],
          },
          archivedVersionCount: {
            field: "archivedVersionCount",
            type: "number-range",
            value: {
              max: 5,
              min: 1,
            },
          },
          draftVersionCount: {
            field: "draftVersionCount",
            type: "number-range",
            value: {
              max: 3,
              min: 1,
            },
          },
          publishedVersionCount: {
            field: "publishedVersionCount",
            type: "number-range",
            value: {
              max: 4,
              min: 2,
            },
          },
        },
        search: {
          field: "displayName",
          query: "기본",
        },
        sort: {
          direction: "asc",
          field: "publishedVersionCount",
        },
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_admin_ai_prompt_family_list",
      expect.objectContaining({
        p_agent_id_filters: [AGENT_ID],
        p_archived_count_max: 5,
        p_archived_count_min: 1,
        p_draft_count_max: 3,
        p_draft_count_min: 1,
        p_published_count_max: 4,
        p_published_count_min: 2,
        p_search_field: "displayName",
        p_search_query: "기본",
        p_sort_direction: "asc",
        p_sort_field: "publishedVersionCount",
      }),
    );
  });

  it("RPC가 빈 페이지를 반환해도 전체 개수를 유지한다", async () => {
    mockRpcClient({
      data: [
        {
          items: [],
          total_count: 12,
        },
      ],
      error: null,
    });

    const result = await getAdminAiPromptFamilies(
      createQuery({
        page: 99,
      }),
    );

    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({
      page: 99,
      pageSize: 10,
      total: 12,
      totalPages: 2,
    });
  });

  it("RPC 조회에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = {
      message: "prompt list failed",
    };

    mockRpcClient({
      data: null,
      error,
    });

    await expect(
      getAdminAiPromptFamilies(
        createQuery({
          page: 2,
          search: {
            field: "displayName",
            query: "기본",
          },
        }),
      ),
    ).rejects.toThrow(
      "Failed to load admin AI prompt families: prompt list failed",
    );

    expect(reportAdminAiLoadError).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      context: {
        page: 2,
        pageSize: 10,
        searchField: "displayName",
        searchQueryApplied: true,
        sortDirection: "desc",
        sortField: "updatedAt",
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
      message: "관리자 AI prompt family 목록 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  });

  it("RPC 최상위 결과 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
    mockRpcClient({
      data: [],
      error: null,
    });

    await expect(getAdminAiPromptFamilies(createQuery())).rejects.toThrow();

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
      message: "관리자 AI prompt family 목록 응답 검증에 실패했습니다.",
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

    await expect(getAdminAiPromptFamilies(createQuery())).rejects.toThrow();

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
      message: "관리자 AI prompt family 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });

  it("Prompt Family item 스키마가 올바르지 않으면 운영 오류를 보고하고 실패한다", async () => {
    mockRpcClient({
      data: [
        {
          items: [
            {
              agent_display_name: "노트 RAG 답변",
              agent_id: AGENT_ID,
              archived_version_count: "invalid",
              created_at: "2026-08-01T00:00:00.000Z",
              display_name: "기본 답변",
              draft_version_count: 1,
              id: FAMILY_ID,
              published_version_count: 2,
              updated_at: "2026-08-03T04:00:00.000Z",
            },
          ],
          total_count: 1,
        },
      ],
      error: null,
    });

    await expect(getAdminAiPromptFamilies(createQuery())).rejects.toThrow();

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
      message: "관리자 AI prompt family 목록 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE,
      stage: ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });
  });
});

describe("getAdminAiPromptFamilyDetail", () => {
  beforeEach(() => {
    mockPromptGraph();
  });

  it("Family와 해당 Version 목록을 반환한다", async () => {
    const result = await getAdminAiPromptFamilyDetail(FAMILY_ID);

    expect(result).toEqual({
      ...families[0],
      versions: [draftVersion, publishedVersion, olderPublishedVersion],
    });
    expect(loadAdminAiPromptGraph).toHaveBeenCalledWith(ADMIN_USER_ID);
  });

  it("Version 목록이 없으면 빈 배열을 반환한다", async () => {
    const result = await getAdminAiPromptFamilyDetail(OTHER_FAMILY_ID);

    expect(result).toEqual({
      ...families[1],
      versions: [],
    });
  });

  it("Family를 찾을 수 없으면 null을 반환한다", async () => {
    const result = await getAdminAiPromptFamilyDetail(
      "99999999-9999-4999-8999-999999999999",
    );

    expect(result).toBeNull();
  });
});

describe("getAdminAiPromptVersionDetail", () => {
  beforeEach(() => {
    mockPromptGraph();
  });

  it("Family와 Version 상세를 반환한다", async () => {
    const result = await getAdminAiPromptVersionDetail(
      FAMILY_ID,
      PUBLISHED_VERSION_ID,
    );

    expect(result).toEqual({
      family: {
        ...families[0],
        versions: [draftVersion, publishedVersion, olderPublishedVersion],
      },
      version: publishedVersion,
    });
  });

  it("Family를 찾을 수 없으면 null을 반환한다", async () => {
    const result = await getAdminAiPromptVersionDetail(
      "99999999-9999-4999-8999-999999999999",
      PUBLISHED_VERSION_ID,
    );

    expect(result).toBeNull();
  });

  it("Family에 Version이 없으면 null을 반환한다", async () => {
    const result = await getAdminAiPromptVersionDetail(
      FAMILY_ID,
      "99999999-9999-4999-8999-999999999999",
    );

    expect(result).toBeNull();
  });
});

describe("getAdminAiPromptFamilyOptions", () => {
  beforeEach(() => {
    mockPromptGraph();
  });

  it("지정한 Agent의 Prompt Family만 표시 이름순으로 반환한다", async () => {
    const result = await getAdminAiPromptFamilyOptions(AGENT_ID);

    expect(result).toEqual([
      {
        agentId: AGENT_ID,
        displayName: "간결한 답변",
        id: OTHER_FAMILY_ID,
      },
      {
        agentId: AGENT_ID,
        displayName: "기본 답변",
        id: FAMILY_ID,
      },
    ]);
  });

  it("해당 Agent의 Prompt Family가 없으면 빈 배열을 반환한다", async () => {
    const result = await getAdminAiPromptFamilyOptions(
      "99999999-9999-4999-8999-999999999999",
    );

    expect(result).toEqual([]);
  });
});

describe("getAdminAiPromptVersionOptions", () => {
  beforeEach(() => {
    mockPromptGraph();
  });

  it("Published Version만 버전 번호 내림차순으로 반환한다", async () => {
    const result = await getAdminAiPromptVersionOptions(FAMILY_ID);

    expect(result).toEqual([
      {
        displayName: "기본 답변 v3",
        familyId: FAMILY_ID,
        id: PUBLISHED_VERSION_ID,
        versionNumber: 3,
      },
      {
        displayName: "기본 답변 v2",
        familyId: FAMILY_ID,
        id: OLDER_PUBLISHED_VERSION_ID,
        versionNumber: 2,
      },
    ]);
  });

  it("해당 Family의 Version이 없으면 빈 배열을 반환한다", async () => {
    const result = await getAdminAiPromptVersionOptions(OTHER_FAMILY_ID);

    expect(result).toEqual([]);
  });
});
