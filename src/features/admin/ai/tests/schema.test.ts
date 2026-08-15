import { describe, expect, it } from "vitest";

import {
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
