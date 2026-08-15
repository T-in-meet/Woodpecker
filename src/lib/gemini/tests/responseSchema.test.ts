import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toGeminiResponseSchema } from "../responseSchema";

type JsonSchema = Record<string, unknown>;

const schema = z.object({
  questions: z
    .array(
      z.object({
        type: z.literal("ox"),
        question: z.string().min(1),
        answer: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
});

function convert(): JsonSchema {
  return toGeminiResponseSchema(schema) as JsonSchema;
}

function questionProperties(): JsonSchema {
  const questions = (convert().properties as JsonSchema)
    .questions as JsonSchema;
  const items = questions.items as JsonSchema;

  return items.properties as JsonSchema;
}

describe("toGeminiResponseSchema", () => {
  it("const를 enum으로 바꾼다", () => {
    // Gemini는 const를 읽지 못한다. 유형 고정이 풀리면 스키마를 넘기는 의미가 없다.
    expect(questionProperties().type).toEqual({ type: "string", enum: ["ox"] });
  });

  it("지원하지 않는 키워드를 버린다", () => {
    expect(convert()).not.toHaveProperty("$schema");
    expect(questionProperties().question).toEqual({ type: "string" });
  });

  it("지원하는 키워드는 남긴다", () => {
    const questions = (convert().properties as JsonSchema)
      .questions as JsonSchema;

    expect(questions).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: 20,
    });
    expect(convert().required).toEqual(["questions"]);
    expect(convert().additionalProperties).toBe(false);
  });

  it("properties의 키 이름은 걸러내지 않는다", () => {
    // 키워드 필터를 스키마 맵에 그대로 적용하면 필드가 통째로 사라진다.
    expect(Object.keys(questionProperties())).toEqual([
      "type",
      "question",
      "answer",
    ]);
  });
});
