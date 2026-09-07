import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateRelatedNoteRecommendations } from "../generate-related-note-recommendations";
import { prepareRelatedNoteContext } from "../prepare-related-note-context";
import { runRelatedNoteRecommendation } from "../run-related-note-recommendation";
import { verifyRelatedNoteRecommendations } from "../verify-related-note-recommendations";

vi.mock("../generate-related-note-recommendations", () => ({
  generateRelatedNoteRecommendations: vi.fn(),
}));

vi.mock("../prepare-related-note-context", () => ({
  prepareRelatedNoteContext: vi.fn(),
}));

vi.mock("../verify-related-note-recommendations", () => ({
  verifyRelatedNoteRecommendations: vi.fn(),
}));

const mockPrepareRelatedNoteContext = vi.mocked(prepareRelatedNoteContext);
const mockGenerateRelatedNoteRecommendations = vi.mocked(
  generateRelatedNoteRecommendations,
);
const mockVerifyRelatedNoteRecommendations = vi.mocked(
  verifyRelatedNoteRecommendations,
);

const OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_NOTE_ID = "22222222-2222-4222-8222-222222222222";
const RELATED_NOTE_ID = "33333333-3333-4333-8333-333333333333";

const queryExpansionConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["queryExpansionConfiguration"];

const embeddingConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["embeddingConfiguration"];

const answerConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["answerConfiguration"];

const verificationConfiguration = {} as Parameters<
  typeof runRelatedNoteRecommendation
>[0]["verificationConfiguration"];

const defaultParams = {
  answerConfiguration,
  content: "Source note content",
  embeddingConfiguration,
  limit: 5,
  minSimilarity: 0,
  ownerUserId: OWNER_USER_ID,
  queryExpansionConfiguration,
  targetNoteId: TARGET_NOTE_ID,
  title: "Source note",
  verificationConfiguration,
};

describe("runRelatedNoteRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색된 Note가 있으면 Answer 추천 전체를 Verifier로 검증하고 승인된 결과를 반환한다", async () => {
    const notes = [
      {
        id: RELATED_NOTE_ID,
        title: "Related note",
      },
    ] as Awaited<ReturnType<typeof prepareRelatedNoteContext>>["notes"];

    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "<note>Related note</note>",
      expandedQuery: "expanded related note query",
      notes,
    });

    mockGenerateRelatedNoteRecommendations.mockResolvedValue({
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
          title: "Related note",
        },
      ],
    });

    mockVerifyRelatedNoteRecommendations.mockResolvedValue({
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
        },
      ],
    });

    const result = await runRelatedNoteRecommendation(defaultParams);

    expect(mockPrepareRelatedNoteContext).toHaveBeenCalledWith({
      content: "Source note content",
      embeddingConfiguration,
      limit: 5,
      minSimilarity: 0,
      ownerUserId: OWNER_USER_ID,
      queryExpansionConfiguration,
      targetNoteId: TARGET_NOTE_ID,
      title: "Source note",
    });

    expect(mockGenerateRelatedNoteRecommendations).toHaveBeenCalledWith({
      configuration: answerConfiguration,
      content: "Source note content",
      context: "<note>Related note</note>",
      notes,
      title: "Source note",
    });

    expect(mockVerifyRelatedNoteRecommendations).toHaveBeenCalledWith({
      configuration: verificationConfiguration,
      content: "Source note content",
      notes,
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
          title: "Related note",
        },
      ],
      title: "Source note",
    });

    expect(result).toEqual({
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
        },
      ],
    });
  });

  it("검색된 Note가 없으면 Answer Agent와 Verifier를 호출하지 않고 빈 추천을 반환한다", async () => {
    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "",
      expandedQuery: "expanded related note query",
      notes: [],
    });

    const result = await runRelatedNoteRecommendation(defaultParams);

    expect(mockGenerateRelatedNoteRecommendations).not.toHaveBeenCalled();
    expect(mockVerifyRelatedNoteRecommendations).not.toHaveBeenCalled();

    expect(result).toEqual({
      recommendations: [],
    });
  });

  it("Answer 추천이 비어 있으면 Verifier를 호출하지 않고 빈 추천을 반환한다", async () => {
    const notes = [
      {
        id: RELATED_NOTE_ID,
        title: "Related note",
      },
    ] as Awaited<ReturnType<typeof prepareRelatedNoteContext>>["notes"];

    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "<note>Related note</note>",
      expandedQuery: "expanded related note query",
      notes,
    });

    mockGenerateRelatedNoteRecommendations.mockResolvedValue({
      recommendations: [],
    });

    const result = await runRelatedNoteRecommendation(defaultParams);

    expect(mockVerifyRelatedNoteRecommendations).not.toHaveBeenCalled();

    expect(result).toEqual({
      recommendations: [],
    });
  });
});
