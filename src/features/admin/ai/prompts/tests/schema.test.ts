import { describe, expect, it } from "vitest";

import {
  adminAiPromptFamilyListRpcResultSchema,
  adminAiPromptFamilyListRpcRowSchema,
  createFamilySchema,
  createVersionSchema,
  updateFamilySchema,
  updateVersionSchema,
} from "../schema";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

describe("createFamilySchema", () => {
  const validInput = {
    agentId: AGENT_ID,
    changeSummary: "",
    description: "",
    displayName: "기본 프롬프트",
    responseSchema: '{"type":"object"}',
    systemTemplate: "시스템 프롬프트",
    tags: "default, answer",
    userTemplate: "{{question}}",
    variables: '{"question":{"type":"string"}}',
    versionDisplayName: "기본 버전",
  };

  it("Family 생성 입력을 정리하고 변환한다", () => {
    expect(
      createFamilySchema.parse({
        ...validInput,
        changeSummary: "  최초 버전  ",
        description: "  기본 답변 프롬프트  ",
        displayName: "  기본 프롬프트  ",
        tags: " default, answer, , strict ",
        versionDisplayName: "  기본 버전  ",
      }),
    ).toEqual({
      agentId: AGENT_ID,
      changeSummary: "최초 버전",
      description: "기본 답변 프롬프트",
      displayName: "기본 프롬프트",
      responseSchema: {
        type: "object",
      },
      systemTemplate: "시스템 프롬프트",
      tags: ["default", "answer", "strict"],
      userTemplate: "{{question}}",
      variables: {
        question: {
          type: "string",
        },
      },
      versionDisplayName: "기본 버전",
    });
  });

  it("빈 nullable 값과 JSON 입력을 변환한다", () => {
    expect(
      createFamilySchema.parse({
        ...validInput,
        changeSummary: "   ",
        description: "",
        responseSchema: "",
        tags: "",
        variables: "   ",
      }),
    ).toMatchObject({
      changeSummary: null,
      description: null,
      responseSchema: null,
      tags: [],
      variables: null,
    });
  });

  it("Prompt template의 앞뒤 공백은 보존한다", () => {
    expect(
      createFamilySchema.parse({
        ...validInput,
        systemTemplate: "  시스템 프롬프트  ",
        userTemplate: "\n{{question}}\n",
      }),
    ).toMatchObject({
      systemTemplate: "  시스템 프롬프트  ",
      userTemplate: "\n{{question}}\n",
    });
  });

  it("유효하지 않은 Agent ID를 거부한다", () => {
    expect(
      createFamilySchema.safeParse({
        ...validInput,
        agentId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("잘못된 JSON 입력을 거부한다", () => {
    const result = createFamilySchema.safeParse({
      ...validInput,
      responseSchema: '{"type":}',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "JSON 형식이 올바르지 않습니다.",
          }),
        ]),
      );
    }
  });

  it.each([
    ["displayName", "   "],
    ["systemTemplate", ""],
    ["systemTemplate", "   "],
    ["userTemplate", ""],
    ["userTemplate", "   "],
    ["versionDisplayName", "   "],
  ] as const)("필수 필드 %s가 비어 있으면 거부한다", (field, value) => {
    expect(
      createFamilySchema.safeParse({
        ...validInput,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});

describe("updateFamilySchema", () => {
  it("Family 수정 입력을 정리하고 변환한다", () => {
    expect(
      updateFamilySchema.parse({
        description: "  수정된 설명  ",
        displayName: "  수정된 Family  ",
        familyId: FAMILY_ID,
        tags: " default, strict, , ",
      }),
    ).toEqual({
      description: "수정된 설명",
      displayName: "수정된 Family",
      familyId: FAMILY_ID,
      tags: ["default", "strict"],
    });
  });

  it("빈 description과 tags를 변환한다", () => {
    expect(
      updateFamilySchema.parse({
        description: "   ",
        displayName: "Default",
        familyId: FAMILY_ID,
        tags: "",
      }),
    ).toMatchObject({
      description: null,
      tags: [],
    });
  });

  it("유효하지 않은 Family ID를 거부한다", () => {
    expect(
      updateFamilySchema.safeParse({
        description: "",
        displayName: "Default",
        familyId: "invalid-id",
        tags: "",
      }).success,
    ).toBe(false);
  });

  it("표시 이름이 비어 있으면 거부한다", () => {
    expect(
      updateFamilySchema.safeParse({
        description: "",
        displayName: "   ",
        familyId: FAMILY_ID,
        tags: "",
      }).success,
    ).toBe(false);
  });
});

describe("createVersionSchema", () => {
  const validInput = {
    changeSummary: "",
    familyId: FAMILY_ID,
    responseSchema: '{"type":"object"}',
    systemTemplate: "시스템 프롬프트",
    tags: "default, answer",
    userTemplate: "{{question}}",
    variables: '{"question":{"type":"string"}}',
    versionDisplayName: "기본 버전",
  };

  it("Version 생성 입력을 정리하고 변환한다", () => {
    expect(
      createVersionSchema.parse({
        ...validInput,
        changeSummary: "  응답 형식 개선  ",
        tags: " default, answer, , ",
        versionDisplayName: "  버전 2  ",
      }),
    ).toEqual({
      changeSummary: "응답 형식 개선",
      familyId: FAMILY_ID,
      responseSchema: {
        type: "object",
      },
      systemTemplate: "시스템 프롬프트",
      tags: ["default", "answer"],
      userTemplate: "{{question}}",
      variables: {
        question: {
          type: "string",
        },
      },
      versionDisplayName: "버전 2",
    });
  });

  it("빈 nullable 값과 JSON 입력을 변환한다", () => {
    expect(
      createVersionSchema.parse({
        ...validInput,
        changeSummary: "   ",
        responseSchema: "",
        tags: "",
        variables: "   ",
      }),
    ).toMatchObject({
      changeSummary: null,
      responseSchema: null,
      tags: [],
      variables: null,
    });
  });

  it("Prompt template의 앞뒤 공백은 보존한다", () => {
    expect(
      createVersionSchema.parse({
        ...validInput,
        systemTemplate: "  시스템 프롬프트  ",
        userTemplate: "\n{{question}}\n",
      }),
    ).toMatchObject({
      systemTemplate: "  시스템 프롬프트  ",
      userTemplate: "\n{{question}}\n",
    });
  });

  it("유효하지 않은 Family ID를 거부한다", () => {
    expect(
      createVersionSchema.safeParse({
        ...validInput,
        familyId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("잘못된 JSON 입력을 거부한다", () => {
    expect(
      createVersionSchema.safeParse({
        ...validInput,
        variables: '{"question":}',
      }).success,
    ).toBe(false);
  });

  it.each([
    ["systemTemplate", ""],
    ["systemTemplate", "   "],
    ["userTemplate", ""],
    ["userTemplate", "   "],
    ["versionDisplayName", "   "],
  ] as const)("필수 필드 %s가 비어 있으면 거부한다", (field, value) => {
    expect(
      createVersionSchema.safeParse({
        ...validInput,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});

describe("updateVersionSchema", () => {
  it("Version 수정 입력과 Version ID를 검증한다", () => {
    expect(
      updateVersionSchema.parse({
        changeSummary: "  초안 수정  ",
        familyId: FAMILY_ID,
        responseSchema: "",
        systemTemplate: "수정된 시스템 프롬프트",
        tags: "draft, updated",
        userTemplate: "수정된 사용자 프롬프트",
        variables: "",
        versionDisplayName: "  수정된 버전  ",
        versionId: VERSION_ID,
      }),
    ).toEqual({
      changeSummary: "초안 수정",
      familyId: FAMILY_ID,
      responseSchema: null,
      systemTemplate: "수정된 시스템 프롬프트",
      tags: ["draft", "updated"],
      userTemplate: "수정된 사용자 프롬프트",
      variables: null,
      versionDisplayName: "수정된 버전",
      versionId: VERSION_ID,
    });
  });

  it("유효하지 않은 Version ID를 거부한다", () => {
    expect(
      updateVersionSchema.safeParse({
        changeSummary: "",
        familyId: FAMILY_ID,
        responseSchema: "",
        systemTemplate: "시스템 프롬프트",
        tags: "",
        userTemplate: "사용자 프롬프트",
        variables: "",
        versionDisplayName: "버전",
        versionId: "invalid-id",
      }).success,
    ).toBe(false);
  });

  it("공백만 있는 Prompt template을 거부한다", () => {
    expect(
      updateVersionSchema.safeParse({
        changeSummary: "",
        familyId: FAMILY_ID,
        responseSchema: "",
        systemTemplate: "   ",
        tags: "",
        userTemplate: "사용자 프롬프트",
        variables: "",
        versionDisplayName: "버전",
        versionId: VERSION_ID,
      }).success,
    ).toBe(false);
  });
});

describe("adminAiPromptFamilyListRpcRowSchema", () => {
  const validRow = {
    agent_display_name: "노트 RAG 답변",
    agent_id: AGENT_ID,
    archived_version_count: 1,
    created_at: "2026-08-03T00:00:00.000Z",
    display_name: "기본 답변",
    draft_version_count: 1,
    id: FAMILY_ID,
    published_version_count: 2,
    updated_at: "2026-08-03T01:00:00.000Z",
  };

  it("유효한 Prompt Family 목록 RPC row를 허용한다", () => {
    expect(adminAiPromptFamilyListRpcRowSchema.parse(validRow)).toEqual(
      validRow,
    );
  });

  it.each([
    ["id", "invalid-id"],
    ["agent_id", "invalid-id"],
  ] as const)("UUID 필드 %s가 올바르지 않으면 거부한다", (field, value) => {
    expect(
      adminAiPromptFamilyListRpcRowSchema.safeParse({
        ...validRow,
        [field]: value,
      }).success,
    ).toBe(false);
  });

  it("필드 타입이 올바르지 않으면 거부한다", () => {
    expect(
      adminAiPromptFamilyListRpcRowSchema.safeParse({
        ...validRow,
        draft_version_count: "1",
      }).success,
    ).toBe(false);
  });
});

describe("adminAiPromptFamilyListRpcResultSchema", () => {
  it("단일 Prompt Family 목록 RPC 결과를 허용한다", () => {
    expect(
      adminAiPromptFamilyListRpcResultSchema.parse([
        {
          items: [],
          total_count: 0,
        },
      ]),
    ).toEqual([
      {
        items: [],
        total_count: 0,
      },
    ]);
  });

  it("RPC 결과가 비어 있으면 거부한다", () => {
    expect(adminAiPromptFamilyListRpcResultSchema.safeParse([]).success).toBe(
      false,
    );
  });

  it("RPC 결과가 두 개 이상이면 거부한다", () => {
    expect(
      adminAiPromptFamilyListRpcResultSchema.safeParse([
        {
          items: [],
          total_count: 0,
        },
        {
          items: [],
          total_count: 0,
        },
      ]).success,
    ).toBe(false);
  });

  it("total_count가 숫자가 아니면 거부한다", () => {
    expect(
      adminAiPromptFamilyListRpcResultSchema.safeParse([
        {
          items: [],
          total_count: "1",
        },
      ]).success,
    ).toBe(false);
  });
});
