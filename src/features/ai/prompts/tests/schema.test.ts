import { describe, expect, it } from "vitest";

import {
  AI_PROMPT_CREATED_BY_KIND,
  AI_PROMPT_LIFECYCLE_STATUS,
} from "../../constants/prompts";
import {
  aiPromptAgentRowSchema,
  aiPromptCreatedByKindSchema,
  aiPromptFamilyRowSchema,
  aiPromptLifecycleStatusSchema,
  aiPromptVersionRowSchema,
} from "../schema";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

describe("prompt enum schemas", () => {
  it.each([AI_PROMPT_CREATED_BY_KIND.SYSTEM, AI_PROMPT_CREATED_BY_KIND.USER])(
    "created by kind %s를 허용한다",
    (value) => {
      expect(aiPromptCreatedByKindSchema.parse(value)).toBe(value);
    },
  );

  it("지원하지 않는 created by kind를 거부한다", () => {
    expect(aiPromptCreatedByKindSchema.safeParse("admin").success).toBe(false);
  });

  it.each([
    AI_PROMPT_LIFECYCLE_STATUS.ARCHIVED,
    AI_PROMPT_LIFECYCLE_STATUS.DRAFT,
    AI_PROMPT_LIFECYCLE_STATUS.PUBLISHED,
  ])("lifecycle status %s를 허용한다", (value) => {
    expect(aiPromptLifecycleStatusSchema.parse(value)).toBe(value);
  });

  it("지원하지 않는 lifecycle status를 거부한다", () => {
    expect(aiPromptLifecycleStatusSchema.safeParse("deleted").success).toBe(
      false,
    );
  });
});

describe("aiPromptAgentRowSchema", () => {
  const validRow = {
    created_at: "2026-08-04T00:00:00.000Z",
    description: "노트 RAG Agent",
    display_name: "노트 RAG 답변",
    id: AGENT_ID,
    purpose: "노트를 기반으로 답변합니다.",
    tags: ["notes", "rag"],
    updated_at: "2026-08-04T01:00:00.000Z",
  };

  it("유효한 prompt agent row를 허용한다", () => {
    expect(aiPromptAgentRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("nullable 필드를 허용한다", () => {
    expect(
      aiPromptAgentRowSchema.parse({
        ...validRow,
        description: null,
        purpose: null,
      }),
    ).toMatchObject({
      description: null,
      purpose: null,
    });
  });

  it.each([["id", "invalid-id"]] as const)(
    "유효하지 않은 UUID 필드 %s를 거부한다",
    (field, value) => {
      expect(
        aiPromptAgentRowSchema.safeParse({
          ...validRow,
          [field]: value,
        }).success,
      ).toBe(false);
    },
  );

  it("빈 display_name을 거부한다", () => {
    expect(
      aiPromptAgentRowSchema.safeParse({
        ...validRow,
        display_name: "",
      }).success,
    ).toBe(false);
  });
});

describe("aiPromptFamilyRowSchema", () => {
  const validRow = {
    agent_id: AGENT_ID,
    created_at: "2026-08-04T00:00:00.000Z",
    description: "기본 Family",
    display_name: "Default",
    id: FAMILY_ID,
    tags: ["default"],
    updated_at: "2026-08-04T01:00:00.000Z",
  };

  it("유효한 prompt family row를 허용한다", () => {
    expect(aiPromptFamilyRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("description의 null 값을 허용한다", () => {
    expect(
      aiPromptFamilyRowSchema.parse({
        ...validRow,
        description: null,
      }).description,
    ).toBeNull();
  });

  it.each([
    ["id", "invalid-id"],
    ["agent_id", "invalid-id"],
  ] as const)("유효하지 않은 UUID 필드 %s를 거부한다", (field, value) => {
    expect(
      aiPromptFamilyRowSchema.safeParse({
        ...validRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});

describe("aiPromptVersionRowSchema", () => {
  const validRow = {
    change_summary: "응답 형식 개선",
    created_at: "2026-08-04T00:00:00.000Z",
    created_by: USER_ID,
    created_by_kind: AI_PROMPT_CREATED_BY_KIND.USER,
    display_name: "기본 버전 v2",
    family_id: FAMILY_ID,
    id: VERSION_ID,
    lifecycle_status: AI_PROMPT_LIFECYCLE_STATUS.DRAFT,
    response_schema: {
      type: "object",
    },
    system_template: "시스템 프롬프트",
    tags: ["default"],
    user_template: "{{question}}",
    variables: {
      question: {
        type: "string",
      },
    },
    version_number: 2,
  };

  it("유효한 prompt version row를 허용한다", () => {
    expect(aiPromptVersionRowSchema.parse(validRow)).toEqual(validRow);
  });

  it("nullable 필드를 허용한다", () => {
    expect(
      aiPromptVersionRowSchema.parse({
        ...validRow,
        change_summary: null,
        created_by: null,
      }),
    ).toMatchObject({
      change_summary: null,
      created_by: null,
    });
  });

  it.each([
    ["id", "invalid-id"],
    ["family_id", "invalid-id"],
    ["created_by", "invalid-id"],
  ] as const)("유효하지 않은 UUID 필드 %s를 거부한다", (field, value) => {
    expect(
      aiPromptVersionRowSchema.safeParse({
        ...validRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it.each([0, -1, 1.5])(
    "유효하지 않은 version_number %s를 거부한다",
    (versionNumber) => {
      expect(
        aiPromptVersionRowSchema.safeParse({
          ...validRow,
          version_number: versionNumber,
        }).success,
      ).toBe(false);
    },
  );

  it("유효하지 않은 lifecycle status를 거부한다", () => {
    expect(
      aiPromptVersionRowSchema.safeParse({
        ...validRow,
        lifecycle_status: "deleted",
      }).success,
    ).toBe(false);
  });

  it.each(["display_name", "system_template", "user_template"] as const)(
    "필수 문자열 필드 %s가 비어 있으면 거부한다",
    (field) => {
      expect(
        aiPromptVersionRowSchema.safeParse({
          ...validRow,
          [field]: "",
        }).success,
      ).toBe(false);
    },
  );
});
