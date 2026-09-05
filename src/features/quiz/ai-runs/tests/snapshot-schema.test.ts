import { describe, expect, it } from "vitest";

import { quizSnapshotsSchema } from "../snapshot-schema";

/** schema 검증에 사용하는 최소 Quiz source Snapshot입니다. */
const sourceInput = {
  input: {
    action: "generate",
    note: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "제목",
      content: "내용",
    },
    quizType: "ox",
  },
} as const;

describe("quizSnapshotsSchema", () => {
  it("최소 초기 Snapshot을 허용하고 알 수 없는 필드를 제거한다", () => {
    expect(
      quizSnapshotsSchema.parse({
        schemaVersion: 1,
        sourceInput: { ...sourceInput, ignored: true },
        ignored: true,
      }),
    ).toEqual({ schemaVersion: 1, sourceInput });
  });

  it("generate와 regenerate 외의 action을 거부한다", () => {
    expect(
      quizSnapshotsSchema.safeParse({
        schemaVersion: 1,
        sourceInput: {
          input: { ...sourceInput.input, action: "cached" },
        },
      }).success,
    ).toBe(false);
  });

  it("Provider 오류의 안전한 Cloudflare 진단 필드를 허용한다", () => {
    expect(
      quizSnapshotsSchema.safeParse({
        schemaVersion: 1,
        sourceInput,
        quizGeneration: {
          input: { prompt: "prompt", responseSchema: {} },
          configuration: {
            provider: "Cloudflare Workers AI",
            model: "model",
            temperature: 0.7,
            maxTokens: 8192,
          },
          error: {
            type: "CloudflareAiError",
            message: "safe error",
            kind: "provider",
            code: 1000,
            status: 500,
          },
        },
      }).success,
    ).toBe(true);
  });
});
