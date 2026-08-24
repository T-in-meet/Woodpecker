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
import { verifyRelatedNoteRecommendations } from "../verify-related-note-recommendations";

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

const FIRST_NOTE_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_NOTE_ID = "22222222-2222-4222-8222-222222222222";
const UNKNOWN_NOTE_ID = "33333333-3333-4333-8333-333333333333";

const configuration = {
  model: {
    model: "gpt-4o-mini",
    provider: "openai",
  },
  prompt: {
    version: {
      response_schema: {
        type: "object",
      },
      system_template: "system {{title}} {{content}}",
      user_template: "user {{recommendations}}",
    },
  },
  temperature: 0.2,
} as unknown as AiRuntimeChatConfiguration;

const usage = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
};

const recommendations = [
  {
    noteId: FIRST_NOTE_ID,
    reason: "첫 번째 Answer 추천 이유",
    title: "첫 번째 노트",
  },
  {
    noteId: SECOND_NOTE_ID,
    reason: "두 번째 Answer 추천 이유",
    title: "두 번째 노트",
  },
];

/**
 * 같은 Note ID의 여러 matched chunk를 포함한 Verifier evidence fixture입니다.
 */
const notes: MatchedNote[] = [
  {
    chunkText: "첫 번째 노트의 첫 번째 매칭 chunk",
    distance: 0.1,
    embeddingId: "embedding-1",
    id: FIRST_NOTE_ID,
    similarity: 0.9,
    title: "첫 번째 노트",
  },
  {
    chunkText: "두 번째 노트의 매칭 chunk",
    distance: 0.2,
    embeddingId: "embedding-2",
    id: SECOND_NOTE_ID,
    similarity: 0.8,
    title: "두 번째 노트",
  },
  {
    chunkText: "첫 번째 노트의 두 번째 매칭 chunk",
    distance: 0.3,
    embeddingId: "embedding-3",
    id: FIRST_NOTE_ID,
    similarity: 0.7,
    title: "첫 번째 노트",
  },
];

describe("verifyRelatedNoteRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportRelatedNotesOperationalError).mockResolvedValue(undefined);
    vi.mocked(getProviderApiKey).mockReturnValue("test-api-key");
    vi.mocked(renderPromptTemplate)
      .mockReturnValueOnce("rendered system")
      .mockReturnValueOnce("rendered user");
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        verifications: [
          {
            approved: true,
            noteId: FIRST_NOTE_ID,
            reason: "직접적인 학습 관계입니다.",
          },
          {
            approved: false,
            noteId: SECOND_NOTE_ID,
            reason: "일반적인 공통점만 있습니다.",
          },
        ],
      }),
      metadata: {},
      usage,
    });
  });

  it("모든 Answer 추천을 하나의 Verifier 호출로 전달하고 승인된 추천만 저장 대상으로 반환한다", async () => {
    const result = await verifyRelatedNoteRecommendations({
      configuration,
      content: "현재 노트 내용",
      notes,
      recommendations,
      title: "현재 노트",
    });

    expect(createAiChatCompletionWithProvider).toHaveBeenCalledOnce();
    expect(result).toEqual({
      recommendations: [
        {
          noteId: FIRST_NOTE_ID,
          reason: "첫 번째 Answer 추천 이유",
        },
      ],
      usage,
      verifications: [
        {
          approved: true,
          noteId: FIRST_NOTE_ID,
          reason: "직접적인 학습 관계입니다.",
        },
        {
          approved: false,
          noteId: SECOND_NOTE_ID,
          reason: "일반적인 공통점만 있습니다.",
        },
      ],
    });
  });

  it("같은 noteId의 모든 matched chunk를 Verifier prompt 변수에 포함한다", async () => {
    await verifyRelatedNoteRecommendations({
      configuration,
      content: "현재 노트 내용",
      notes,
      recommendations,
      title: "현재 노트",
    });

    const templateVariables =
      vi.mocked(renderPromptTemplate).mock.calls[0]?.[1];

    expect(templateVariables?.recommendations).toContain(
      "첫 번째 노트의 첫 번째 매칭 chunk",
    );
    expect(templateVariables?.recommendations).toContain(
      "첫 번째 노트의 두 번째 매칭 chunk",
    );
    expect(templateVariables?.recommendations).toContain(
      "두 번째 노트의 매칭 chunk",
    );
  });

  it("Verifier usage callback을 Provider 응답 직후 호출한다", async () => {
    const onUsage = vi.fn().mockResolvedValue(undefined);

    await verifyRelatedNoteRecommendations({
      configuration,
      content: "현재 노트 내용",
      notes,
      onUsage,
      recommendations,
      title: "현재 노트",
    });

    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it("Verifier 응답에 누락된 noteId가 있으면 검증 실패로 처리한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        verifications: [
          {
            approved: true,
            noteId: FIRST_NOTE_ID,
            reason: "직접적인 학습 관계입니다.",
          },
        ],
      }),
      metadata: {},
      usage,
    });

    await expect(
      verifyRelatedNoteRecommendations({
        configuration,
        content: "현재 노트 내용",
        notes,
        recommendations,
        title: "현재 노트",
      }),
    ).rejects.toThrow(
      "Related note verification note IDs do not match recommendations.",
    );
  });

  it("Verifier 응답에 추가 noteId가 있으면 검증 실패로 처리한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        verifications: [
          {
            approved: true,
            noteId: FIRST_NOTE_ID,
            reason: "직접적인 학습 관계입니다.",
          },
          {
            approved: true,
            noteId: SECOND_NOTE_ID,
            reason: "직접적인 학습 관계입니다.",
          },
          {
            approved: true,
            noteId: UNKNOWN_NOTE_ID,
            reason: "잘못 추가된 검증입니다.",
          },
        ],
      }),
      metadata: {},
      usage,
    });

    await expect(
      verifyRelatedNoteRecommendations({
        configuration,
        content: "현재 노트 내용",
        notes,
        recommendations,
        title: "현재 노트",
      }),
    ).rejects.toThrow(
      "Related note verification note IDs do not match recommendations.",
    );
  });

  it("Verifier 응답에 중복 noteId가 있으면 검증 실패로 처리한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        verifications: [
          {
            approved: true,
            noteId: FIRST_NOTE_ID,
            reason: "첫 번째 검증입니다.",
          },
          {
            approved: false,
            noteId: FIRST_NOTE_ID,
            reason: "중복 검증입니다.",
          },
        ],
      }),
      metadata: {},
      usage,
    });

    await expect(
      verifyRelatedNoteRecommendations({
        configuration,
        content: "현재 노트 내용",
        notes,
        recommendations: [recommendations[0]!],
        title: "현재 노트",
      }),
    ).rejects.toThrow(
      "Related note verification note IDs do not match recommendations.",
    );
  });

  it("Answer 추천에 해당하는 matched chunk가 없으면 Provider 호출 전 실패한다", async () => {
    await expect(
      verifyRelatedNoteRecommendations({
        configuration,
        content: "현재 노트 내용",
        notes: notes.filter((note) => note.id !== SECOND_NOTE_ID),
        recommendations,
        title: "현재 노트",
      }),
    ).rejects.toThrow(
      `Related note verification evidence not found: ${SECOND_NOTE_ID}`,
    );

    expect(createAiChatCompletionWithProvider).not.toHaveBeenCalled();
  });

  it("Verifier 응답이 JSON이 아니면 운영 오류를 보고하고 실패한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: "invalid-json",
      metadata: {},
      usage,
    });

    await expect(
      verifyRelatedNoteRecommendations({
        configuration,
        content: "현재 노트 내용",
        notes,
        recommendations,
        title: "현재 노트",
      }),
    ).rejects.toThrow("Related note verification response is not valid JSON.");

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.any(SyntaxError),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.VERIFICATION_RESPONSE_PARSE_FAILED,
      message: "Related Note 추천 검증 응답 JSON 파싱에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.PARSE_VERIFICATION_RESPONSE,
    });
  });

  it("Verifier 응답 schema가 맞지 않으면 운영 오류를 보고하고 실패한다", async () => {
    vi.mocked(createAiChatCompletionWithProvider).mockResolvedValue({
      content: JSON.stringify({
        verifications: [
          {
            approved: true,
            noteId: FIRST_NOTE_ID,
            reason: "",
          },
        ],
      }),
      metadata: {},
      usage,
    });

    await expect(
      verifyRelatedNoteRecommendations({
        configuration,
        content: "현재 노트 내용",
        notes,
        recommendations: [recommendations[0]!],
        title: "현재 노트",
      }),
    ).rejects.toThrow(
      "Related note verification response does not match the expected schema.",
    );

    expect(reportRelatedNotesOperationalError).toHaveBeenCalledWith({
      error: expect.objectContaining({
        message:
          "Related note verification response does not match the expected schema.",
      }),
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.VERIFICATION_RESPONSE_VALIDATION_FAILED,
      message: "Related Note 추천 검증 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_VERIFICATION_RESPONSE,
    });
  });
});
