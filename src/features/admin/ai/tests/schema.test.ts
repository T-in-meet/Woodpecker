import { describe, expect, it } from "vitest";

import {
  aiPromptFamilyRowSchema,
  aiPromptVersionRowSchema,
  aiPromptVersionStatusSchema,
  jsonTextSchema,
  nullableTextSchema,
  tagsSchema,
  uuidSchema,
} from "../schema";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("uuidSchema", () => {
  it("유효한 UUID를 허용한다", () => {
    expect(uuidSchema.parse(UUID)).toBe(UUID);
  });

  it("유효하지 않은 UUID를 거부한다", () => {
    expect(uuidSchema.safeParse("invalid-uuid").success).toBe(false);
  });
});

describe("nullableTextSchema", () => {
  it("문자열 양끝 공백을 제거한다", () => {
    expect(nullableTextSchema.parse("  설명  ")).toBe("설명");
  });

  it("빈 문자열과 공백 문자열을 null로 변환한다", () => {
    expect(nullableTextSchema.parse("")).toBeNull();
    expect(nullableTextSchema.parse("   ")).toBeNull();
  });
});

describe("tagsSchema", () => {
  it("쉼표로 구분된 문자열을 정리된 태그 배열로 변환한다", () => {
    expect(tagsSchema.parse("rag, notes, ai")).toEqual(["rag", "notes", "ai"]);
  });

  it("빈 태그와 공백만 있는 태그를 제거한다", () => {
    expect(tagsSchema.parse("rag, , notes,   ,")).toEqual(["rag", "notes"]);
  });

  it("빈 문자열은 빈 배열로 변환한다", () => {
    expect(tagsSchema.parse("")).toEqual([]);
  });
});

describe("jsonTextSchema", () => {
  it("JSON 문자열을 JSON 값으로 변환한다", () => {
    expect(
      jsonTextSchema.parse('{"type":"object","required":["answer"]}'),
    ).toEqual({
      required: ["answer"],
      type: "object",
    });
  });

  it("배열과 원시 JSON 값도 허용한다", () => {
    expect(jsonTextSchema.parse('["rag","notes"]')).toEqual(["rag", "notes"]);
    expect(jsonTextSchema.parse("true")).toBe(true);
    expect(jsonTextSchema.parse("123")).toBe(123);
  });

  it("빈 문자열과 공백 문자열을 null로 변환한다", () => {
    expect(jsonTextSchema.parse("")).toBeNull();
    expect(jsonTextSchema.parse("   ")).toBeNull();
  });

  it("잘못된 JSON 문자열을 거부한다", () => {
    const result = jsonTextSchema.safeParse('{"type":}');

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
});

describe("aiPromptVersionStatusSchema", () => {
  it.each(["draft", "published", "archived"] as const)(
    "%s 상태를 허용한다",
    (status) => {
      expect(aiPromptVersionStatusSchema.parse(status)).toBe(status);
    },
  );

  it("정의되지 않은 상태를 거부한다", () => {
    expect(aiPromptVersionStatusSchema.safeParse("deleted").success).toBe(
      false,
    );
  });
});

describe("aiPromptFamilyRowSchema", () => {
  const validFamilyRow = {
    agent_id: UUID,
    created_at: "2026-08-03T00:00:00.000Z",
    description: "기본 Prompt Family",
    display_name: "기본 프롬프트",
    id: UUID,
    tags: ["default"],
    updated_at: "2026-08-03T01:00:00.000Z",
  };

  it("유효한 family DB row를 허용한다", () => {
    expect(aiPromptFamilyRowSchema.parse(validFamilyRow)).toEqual(
      validFamilyRow,
    );
  });

  it("description의 null 값을 허용한다", () => {
    expect(
      aiPromptFamilyRowSchema.parse({
        ...validFamilyRow,
        description: null,
      }).description,
    ).toBeNull();
  });

  it("필수 필드가 없으면 거부한다", () => {
    const { id: _id, ...rowWithoutId } = validFamilyRow;

    expect(aiPromptFamilyRowSchema.safeParse(rowWithoutId).success).toBe(false);
  });
});

describe("aiPromptVersionRowSchema", () => {
  const validVersionRow = {
    change_summary: "응답 형식을 개선했습니다.",
    created_at: "2026-08-03T00:00:00.000Z",
    created_by: UUID,
    created_by_kind: "admin",
    display_name: "기본 프롬프트 v1",
    family_id: UUID,
    id: UUID,
    lifecycle_status: "published",
    response_schema: {
      type: "object",
    },
    system_template: "시스템 프롬프트",
    tags: ["default"],
    user_template: "{{question}}",
    variables: [
      {
        name: "question",
        required: true,
        type: "string",
      },
    ],
    version_number: 1,
  };

  it("유효한 prompt version DB row를 허용한다", () => {
    expect(aiPromptVersionRowSchema.parse(validVersionRow)).toEqual(
      validVersionRow,
    );
  });

  it("nullable 필드의 null 값을 허용한다", () => {
    expect(
      aiPromptVersionRowSchema.parse({
        ...validVersionRow,
        change_summary: null,
        created_by: null,
      }),
    ).toMatchObject({
      change_summary: null,
      created_by: null,
    });
  });

  it("허용되지 않은 lifecycle 상태를 거부한다", () => {
    expect(
      aiPromptVersionRowSchema.safeParse({
        ...validVersionRow,
        lifecycle_status: "deleted",
      }).success,
    ).toBe(false);
  });

  it("version_number가 숫자가 아니면 거부한다", () => {
    expect(
      aiPromptVersionRowSchema.safeParse({
        ...validVersionRow,
        version_number: "1",
      }).success,
    ).toBe(false);
  });
});
