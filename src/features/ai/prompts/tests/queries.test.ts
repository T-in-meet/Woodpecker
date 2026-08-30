import { describe, expect, it, vi } from "vitest";

import { getPublishedAiPromptVersionForAgent } from "../queries";

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
  markAiOperationalErrorAsReported: (error: unknown) => error,
}));

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

const AGENT_ROW = {
  id: AGENT_ID,
  display_name: "노트 챗봇",
  description: "노트 챗봇 Agent",
  purpose: "사용자의 노트를 기반으로 답변합니다.",
  tags: [],
  created_at: "2026-08-06T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
};

const VERSION_ROW = {
  id: VERSION_ID,
  family_id: FAMILY_ID,
  version_number: 1,
  display_name: "노트 챗봇 v1",
  change_summary: "초기 버전",
  lifecycle_status: "published",
  system_template: "시스템 프롬프트",
  user_template: "{{question}}",
  response_schema: {},
  variables: [],
  tags: [],
  created_by_kind: "system",
  created_by: null,
  created_at: "2026-08-06T00:00:00.000Z",
};

const FAMILY_ROW = {
  id: FAMILY_ID,
  agent_id: AGENT_ID,
  display_name: "기본 프롬프트",
  description: "기본 프롬프트 Family",
  tags: [],
  created_at: "2026-08-06T00:00:00.000Z",
  updated_at: "2026-08-06T00:00:00.000Z",
};

/**
 * 순서대로 지정한 결과를 반환하는 Supabase 조회 Client Mock을 생성합니다.
 *
 * @param results 각 `from()` 호출에서 반환할 최종 조회 결과
 * @returns 조회 함수에 주입할 Supabase Client Mock
 */
function createPromptClientMock(
  results: Array<{
    data: unknown;
    error: { message: string } | null;
  }>,
) {
  const maybeSingleMocks = results.map((result) =>
    vi.fn().mockResolvedValue(result),
  );

  const from = vi.fn().mockImplementation(() => {
    const maybeSingle = maybeSingleMocks.shift();

    if (!maybeSingle) {
      throw new Error("예상하지 않은 Supabase 조회가 발생했습니다.");
    }

    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle,
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);

    return query;
  });

  return {
    client: { from } as never,
    from,
  };
}

describe("getPublishedAiPromptVersionForAgent", () => {
  it("Agent와 해당 Agent에 속한 Published Prompt Version을 ID로 조회한다", async () => {
    const { client, from } = createPromptClientMock([
      {
        data: AGENT_ROW,
        error: null,
      },
      {
        data: VERSION_ROW,
        error: null,
      },
      {
        data: FAMILY_ROW,
        error: null,
      },
    ]);

    const result = await getPublishedAiPromptVersionForAgent({
      agentId: AGENT_ID,
      promptVersionId: VERSION_ID,
      supabase: client,
    });

    expect(from).toHaveBeenNthCalledWith(1, "ai_prompt_agents");
    expect(from).toHaveBeenNthCalledWith(2, "ai_prompt_versions");
    expect(from).toHaveBeenNthCalledWith(3, "ai_prompt_families");

    expect(result).toEqual({
      agent: AGENT_ROW,
      family: FAMILY_ROW,
      version: VERSION_ROW,
    });
  });

  it("Agent가 존재하지 않으면 오류를 발생시킨다", async () => {
    const { client } = createPromptClientMock([
      {
        data: null,
        error: null,
      },
    ]);

    await expect(
      getPublishedAiPromptVersionForAgent({
        agentId: AGENT_ID,
        promptVersionId: VERSION_ID,
        supabase: client,
      }),
    ).rejects.toThrow(`AI prompt agent not found: ${AGENT_ID}`);
  });

  it("Agent 조회가 실패하면 데이터베이스 오류를 전달한다", async () => {
    const { client } = createPromptClientMock([
      {
        data: null,
        error: {
          message: "Agent query failed",
        },
      },
    ]);

    await expect(
      getPublishedAiPromptVersionForAgent({
        agentId: AGENT_ID,
        promptVersionId: VERSION_ID,
        supabase: client,
      }),
    ).rejects.toThrow("Failed to load AI prompt agent: Agent query failed");
  });

  it("Published Prompt Version이 존재하지 않으면 오류를 발생시킨다", async () => {
    const { client } = createPromptClientMock([
      {
        data: AGENT_ROW,
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]);

    await expect(
      getPublishedAiPromptVersionForAgent({
        agentId: AGENT_ID,
        promptVersionId: VERSION_ID,
        supabase: client,
      }),
    ).rejects.toThrow(`Published AI prompt version not found: ${VERSION_ID}`);
  });

  it("Prompt Version이 지정한 Agent 소속이 아니면 오류를 발생시킨다", async () => {
    const { client } = createPromptClientMock([
      {
        data: AGENT_ROW,
        error: null,
      },
      {
        data: VERSION_ROW,
        error: null,
      },
      {
        data: null,
        error: null,
      },
    ]);

    await expect(
      getPublishedAiPromptVersionForAgent({
        agentId: AGENT_ID,
        promptVersionId: VERSION_ID,
        supabase: client,
      }),
    ).rejects.toThrow(
      `AI prompt version does not belong to agent: ${VERSION_ID}`,
    );
  });

  it("Published Prompt Version 조회가 실패하면 데이터베이스 오류를 전달한다", async () => {
    const { client } = createPromptClientMock([
      {
        data: AGENT_ROW,
        error: null,
      },
      {
        data: null,
        error: {
          message: "Version query failed",
        },
      },
    ]);

    await expect(
      getPublishedAiPromptVersionForAgent({
        agentId: AGENT_ID,
        promptVersionId: VERSION_ID,
        supabase: client,
      }),
    ).rejects.toThrow(
      "Failed to load published AI prompt version: Version query failed",
    );
  });

  it("Prompt Family 조회가 실패하면 데이터베이스 오류를 전달한다", async () => {
    const { client } = createPromptClientMock([
      {
        data: AGENT_ROW,
        error: null,
      },
      {
        data: VERSION_ROW,
        error: null,
      },
      {
        data: null,
        error: {
          message: "Family query failed",
        },
      },
    ]);

    await expect(
      getPublishedAiPromptVersionForAgent({
        agentId: AGENT_ID,
        promptVersionId: VERSION_ID,
        supabase: client,
      }),
    ).rejects.toThrow("Failed to load AI prompt family: Family query failed");
  });
});
