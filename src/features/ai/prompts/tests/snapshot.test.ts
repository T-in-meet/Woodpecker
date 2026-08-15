import { describe, expect, it } from "vitest";

import {
  AI_PROMPT_CREATED_BY_KIND,
  AI_PROMPT_LIFECYCLE_STATUS,
} from "../../constants/prompts";
import { createAiPromptSnapshot } from "../snapshots";
import type { AiPromptAgent, AiPromptFamily, AiPromptVersion } from "../types";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

const agent: AiPromptAgent = {
  created_at: "2026-08-04T00:00:00.000Z",
  description: "노트 RAG Agent",
  display_name: "노트 RAG 답변",
  id: AGENT_ID,
  purpose: "노트를 기반으로 답변합니다.",
  tags: ["notes", "rag"],
  updated_at: "2026-08-04T01:00:00.000Z",
};

const family: AiPromptFamily = {
  agent_id: AGENT_ID,
  created_at: "2026-08-04T00:00:00.000Z",
  description: "기본 Prompt Family",
  display_name: "Default",
  id: FAMILY_ID,
  tags: ["default"],
  updated_at: "2026-08-04T01:00:00.000Z",
};

const version: AiPromptVersion = {
  change_summary: "응답 형식 개선",
  created_at: "2026-08-04T00:00:00.000Z",
  created_by: USER_ID,
  created_by_kind: AI_PROMPT_CREATED_BY_KIND.USER,
  display_name: "기본 버전",
  family_id: FAMILY_ID,
  id: VERSION_ID,
  lifecycle_status: AI_PROMPT_LIFECYCLE_STATUS.PUBLISHED,
  response_schema: {
    type: "object",
  },
  system_template: "system",
  tags: ["rag", "default"],
  user_template: "user",
  variables: [
    {
      name: "question",
      type: "string",
    },
  ],
  version_number: 2,
};

describe("createAiPromptSnapshot", () => {
  it("AI 실행 기록에 사용할 prompt snapshot을 생성한다", () => {
    expect(
      createAiPromptSnapshot({
        agent,
        family,
        version,
      }),
    ).toEqual({
      agentId: AGENT_ID,
      displayName: "기본 버전",
      familyId: FAMILY_ID,
      lifecycleStatus: AI_PROMPT_LIFECYCLE_STATUS.PUBLISHED,
      promptVersionId: VERSION_ID,
      responseSchema: {
        type: "object",
      },
      systemTemplate: "system",
      tags: ["rag", "default"],
      userTemplate: "user",
      variables: [
        {
          name: "question",
          type: "string",
        },
      ],
      versionNumber: 2,
    });
  });
});
