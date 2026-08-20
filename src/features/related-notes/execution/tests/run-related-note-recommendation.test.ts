import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateRelatedNoteRecommendations } from "../generate-related-note-recommendations";
import { prepareRelatedNoteContext } from "../prepare-related-note-context";
import { runRelatedNoteRecommendation } from "../run-related-note-recommendation";

vi.mock("../generate-related-note-recommendations", () => ({
  generateRelatedNoteRecommendations: vi.fn(),
}));

vi.mock("../prepare-related-note-context", () => ({
  prepareRelatedNoteContext: vi.fn(),
}));

const mockPrepareRelatedNoteContext = vi.mocked(prepareRelatedNoteContext);
const mockGenerateRelatedNoteRecommendations = vi.mocked(
  generateRelatedNoteRecommendations,
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
};

describe("runRelatedNoteRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("검색된 Note가 있으면 Answer Agent 추천을 생성하고 결과를 반환한다", async () => {
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

    mockGenerateRelatedNoteRecommendations.mockResolvedValue([
      {
        noteId: RELATED_NOTE_ID,
        title: "Related note",
      },
    ]);

    const result = await runRelatedNoteRecommendation(defaultParams);

    expect(mockGenerateRelatedNoteRecommendations).toHaveBeenCalledWith({
      configuration: answerConfiguration,
      context: "<note>Related note</note>",
      expandedQuery: "expanded related note query",
      notes,
    });

    expect(result).toEqual({
      expandedQuery: "expanded related note query",
      notes,
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          title: "Related note",
        },
      ],
    });
  });

  it("검색된 Note가 없으면 Answer Agent를 호출하지 않고 빈 추천을 반환한다", async () => {
    mockPrepareRelatedNoteContext.mockResolvedValue({
      context: "",
      expandedQuery: "expanded related note query",
      notes: [],
    });

    const result = await runRelatedNoteRecommendation(defaultParams);

    expect(mockGenerateRelatedNoteRecommendations).not.toHaveBeenCalled();

    expect(result).toEqual({
      expandedQuery: "expanded related note query",
      notes: [],
      recommendations: [],
    });
  });
});
