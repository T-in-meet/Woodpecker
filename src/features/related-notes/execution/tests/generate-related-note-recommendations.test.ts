import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";

import { reportRelatedNotesOperationalError } from "../../utils/report-operational-error";
import { generateRelatedNoteRecommendations } from "../generate-related-note-recommendations";

vi.mock("@/features/ai/prompts/render", () => ({
  renderPromptTemplate: vi.fn(),
}));

vi.mock("@/features/ai/providers", () => ({
  createAiChatCompletionWithProvider: vi.fn(),
}));

vi.mock("@/features/ai/providers/utils/api-key", () => ({
  getProviderApiKey: vi.fn(),
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportRelatedNotesOperationalError: vi.fn(),
}));

const configuration = {
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
  },
  prompt: {
    version: {
      response_schema: {
        type: "object",
      },
      system_template: "system {{question}}",
      user_template: "user {{context}}",
    },
  },
  temperature: 0.2,
} as unknown as AiRuntimeChatConfiguration;

/**
 * Related Notes 검색 결과 fixture입니다.
 *
 * 첫 번째와 세 번째 검색 결과는 같은 Note의 서로 다른 chunk이며,
 * 두 번째 검색 결과는 다른 Note를 가리킵니다.
 *
 * 이를 통해:
 * - LLM이 반환한 Note ID가 실제 검색 결과에 존재하는지 검증
 * - 동일 Note ID가 여러 번 반환된 경우 Note 단위 중복 제거
 * - 검색 결과의 title snapshot을 최종 추천 결과에 포함
 * 을 함께 검증합니다.
 */
const notes: MatchedNote[] = [
  {
    chunkText: "첫 번째 노트의 첫 번째 관련 내용",
    distance: 0.1,
    embeddingId: "embedding-1",
    id: "11111111-1111-4111-8111-111111111111",
    similarity: 0.9,
    title: "첫 번째 노트",
  },
  {
    chunkText: "두 번째 노트의 관련 내용",
    distance: 0.2,
    embeddingId: "embedding-2",
    id: "22222222-2222-4222-8222-222222222222",
    similarity: 0.8,
    title: "두 번째 노트",
  },
  {
    chunkText: "첫 번째 노트의 두 번째 관련 내용",
    distance: 0.3,
    embeddingId: "embedding-3",
    id: "11111111-1111-4111-8111-111111111111",
    similarity: 0.7,
    title: "첫 번째 노트",
  },
];

describe("generateRelatedNoteRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportRelatedNotesOperationalError).mockResolvedValue(undefined);

    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");

    vi.mocked(renderPromptTemplate)
      .mockReturnValueOnce("rendered system")
      .mockReturnValueOnce("rendered user");

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        recommendations: [
          {
            noteId: "11111111-1111-4111-8111-111111111111",
            reason: "첫 번째 노트와 관련된 내용을 포함합니다.",
          },
        ],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });
  });

  it("LLM이 반환한 Note ID와 추천 이유를 실제 Note 추천 항목으로 변환한다", async () => {
    const result = await generateRelatedNoteRecommendations({
      configuration,
      context: "context",
      expandedQuery: "expanded query",
      notes,
    });

    expect(result).toEqual([
      {
        noteId: "11111111-1111-4111-8111-111111111111",
        reason: "첫 번째 노트와 관련된 내용을 포함합니다.",
        title: "첫 번째 노트",
      },
    ]);

    expect(reportRelatedNotesOperationalError).not.toHaveBeenCalled();
  });

  it("같은 Note ID가 여러 번 반환되어도 첫 번째 추천 이유만 유지한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        recommendations: [
          {
            noteId: "11111111-1111-4111-8111-111111111111",
            reason: "첫 번째 추천 이유",
          },
          {
            noteId: "11111111-1111-4111-8111-111111111111",
            reason: "두 번째 추천 이유",
          },
          {
            noteId: "22222222-2222-4222-8222-222222222222",
            reason: "두 번째 노트 추천 이유",
          },
        ],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    const result = await generateRelatedNoteRecommendations({
      configuration,
      context: "context",
      expandedQuery: "expanded query",
      notes,
    });

    expect(result).toEqual([
      {
        noteId: "11111111-1111-4111-8111-111111111111",
        reason: "첫 번째 추천 이유",
        title: "첫 번째 노트",
      },
      {
        noteId: "22222222-2222-4222-8222-222222222222",
        reason: "두 번째 노트 추천 이유",
        title: "두 번째 노트",
      },
    ]);
  });

  it("추천 응답이 유효한 JSON이 아니면 운영 오류를 보고하고 오류를 발생시킨다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: "invalid-json",
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    await expect(
      generateRelatedNoteRecommendations({
        configuration,
        context: "context",
        expandedQuery: "expanded query",
        notes,
      }),
    ).rejects.toThrow(
      "Related note recommendation response is not valid JSON.",
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.any(SyntaxError),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RESPONSE_PARSE_FAILED,
      message: "Related Note 추천 응답 JSON 파싱에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.PARSE_RECOMMENDATION_RESPONSE,
      context: {
        expandedQuery: "expanded query",
      },
    });
  });

  it("Note ID 형식이 올바르지 않으면 응답 계약 오류를 발생시킨다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        recommendations: [
          {
            noteId: "invalid-note-id",
            reason: "추천 이유",
          },
        ],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    await expect(
      generateRelatedNoteRecommendations({
        configuration,
        context: "context",
        expandedQuery: "expanded query",
        notes,
      }),
    ).rejects.toThrow(
      "Related note recommendation response does not match the expected schema.",
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message:
          "Related note recommendation response does not match the expected schema.",
      }),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RESPONSE_VALIDATION_FAILED,
      message: "Related Note 추천 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_RECOMMENDATION_RESPONSE,
      context: {
        expandedQuery: "expanded query",
      },
    });
  });

  it("추천 이유가 비어 있으면 응답 계약 오류를 발생시킨다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        recommendations: [
          {
            noteId: "11111111-1111-4111-8111-111111111111",
            reason: "   ",
          },
        ],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    await expect(
      generateRelatedNoteRecommendations({
        configuration,
        context: "context",
        expandedQuery: "expanded query",
        notes,
      }),
    ).rejects.toThrow(
      "Related note recommendation response does not match the expected schema.",
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message:
          "Related note recommendation response does not match the expected schema.",
      }),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RESPONSE_VALIDATION_FAILED,
      message: "Related Note 추천 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_RECOMMENDATION_RESPONSE,
      context: {
        expandedQuery: "expanded query",
      },
    });
  });

  it("검색 결과에 존재하지 않는 Note ID가 반환되면 오류를 발생시킨다", async () => {
    const unknownNoteId = "33333333-3333-4333-8333-333333333333";

    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        recommendations: [
          {
            noteId: unknownNoteId,
            reason: "추천 이유",
          },
        ],
      }),
      metadata: {},
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    });

    await expect(
      generateRelatedNoteRecommendations({
        configuration,
        context: "context",
        expandedQuery: "expanded query",
        notes,
      }),
    ).rejects.toThrow(
      `Related note recommendation note ID not found: ${unknownNoteId}`,
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message: `Related note recommendation note ID not found: ${unknownNoteId}`,
      }),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATIONS_RESOLVE_FAILED,
      message: "Related Note 추천 결과에 해당하는 Note를 찾지 못했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_RECOMMENDATIONS,
      context: {
        expandedQuery: "expanded query",
        noteId: unknownNoteId,
      },
    });
  });
});
