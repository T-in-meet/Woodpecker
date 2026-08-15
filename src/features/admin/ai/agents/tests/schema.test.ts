import { describe, expect, it } from "vitest";

import { createAgentSchema, updateAgentSchema } from "../schema";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";

describe("createAgentSchema", () => {
  const validInput = {
    description: "",
    displayName: "노트 RAG 답변",
    purpose: "노트를 기반으로 질문에 답변합니다.",
    tags: "notes, rag",
  };

  it("생성 입력을 정리하고 변환한다", () => {
    expect(
      createAgentSchema.parse({
        ...validInput,
        description: "  노트 RAG Agent  ",
        displayName: "  노트 RAG 답변  ",
        purpose: "  노트를 기반으로 답변합니다.  ",
        tags: " notes, rag, , answer ",
      }),
    ).toEqual({
      description: "노트 RAG Agent",
      displayName: "노트 RAG 답변",
      purpose: "노트를 기반으로 답변합니다.",
      tags: ["notes", "rag", "answer"],
    });
  });

  it("빈 nullable 값과 tags를 변환한다", () => {
    expect(
      createAgentSchema.parse({
        ...validInput,
        description: "",
        tags: "",
      }),
    ).toMatchObject({
      description: null,
      tags: [],
    });
  });

  it.each([
    ["displayName", "   "],
    ["purpose", "   "],
  ] as const)("필수 필드 %s가 비어 있으면 거부한다", (field, value) => {
    expect(
      createAgentSchema.safeParse({
        ...validInput,
        [field]: value,
      }).success,
    ).toBe(false);
  });
});

describe("updateAgentSchema", () => {
  it("수정 입력을 정리하고 변환한다", () => {
    expect(
      updateAgentSchema.parse({
        agentId: AGENT_ID,
        description: "  수정된 설명  ",
        displayName: "  수정된 Agent  ",
        purpose: "  수정된 목적  ",
        tags: " notes, rag, , ",
      }),
    ).toEqual({
      agentId: AGENT_ID,
      description: "수정된 설명",
      displayName: "수정된 Agent",
      purpose: "수정된 목적",
      tags: ["notes", "rag"],
    });
  });

  it("빈 description과 tags를 변환한다", () => {
    expect(
      updateAgentSchema.parse({
        agentId: AGENT_ID,
        description: "   ",
        displayName: "Agent",
        purpose: "목적",
        tags: "",
      }),
    ).toMatchObject({
      description: null,
      tags: [],
    });
  });

  it("유효하지 않은 agent ID를 거부한다", () => {
    expect(
      updateAgentSchema.safeParse({
        agentId: "invalid-id",
        description: "",
        displayName: "Agent",
        purpose: "목적",
        tags: "",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["displayName", "   "],
    ["purpose", "   "],
  ] as const)("필수 필드 %s가 비어 있으면 거부한다", (field, value) => {
    expect(
      updateAgentSchema.safeParse({
        agentId: AGENT_ID,
        description: "",
        displayName: "Agent",
        purpose: "목적",
        tags: "",
        [field]: value,
      }).success,
    ).toBe(false);
  });
});
