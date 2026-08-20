import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMatchedNotes } from "@/features/ai/rags/note/get-matched-notes";
import { searchNoteEmbeddings } from "@/features/ai/rags/note/search-embeddings";

import { buildRelatedNoteContext } from "../build-related-note-context";
import { expandRelatedNoteQuery } from "../expand-related-note-query";
import { getRelatedNoteRecommendationExcludedIds } from "../get-related-note-recommendation-excluded-ids";
import { prepareRelatedNoteContext } from "../prepare-related-note-context";

vi.mock("@/features/ai/rags/note/get-matched-notes", () => ({
  getMatchedNotes: vi.fn(),
}));

vi.mock("@/features/ai/rags/note/search-embeddings", () => ({
  searchNoteEmbeddings: vi.fn(),
}));

vi.mock("../build-related-note-context", () => ({
  buildRelatedNoteContext: vi.fn(),
}));

vi.mock("../expand-related-note-query", () => ({
  expandRelatedNoteQuery: vi.fn(),
}));

vi.mock("../get-related-note-recommendation-excluded-ids", () => ({
  getRelatedNoteRecommendationExcludedIds: vi.fn(),
}));

const queryExpansionConfiguration = {
  prompt: {
    version: {},
  },
} as Parameters<
  typeof prepareRelatedNoteContext
>[0]["queryExpansionConfiguration"];

const embeddingConfiguration = {
  model: {},
} as Parameters<typeof prepareRelatedNoteContext>[0]["embeddingConfiguration"];

const matches = [
  {
    embeddingId: "embedding-1",
    sourceId: "22222222-2222-4222-8222-222222222222",
  },
];

const notes = [
  {
    chunkText: "관련 노트 chunk",
    distance: 0.1,
    embeddingId: "embedding-1",
    id: "22222222-2222-4222-8222-222222222222",
    similarity: 0.9,
    title: "관련 노트",
  },
];

describe("prepareRelatedNoteContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(expandRelatedNoteQuery).mockResolvedValue("expanded query");

    vi.mocked(getRelatedNoteRecommendationExcludedIds).mockResolvedValue([
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ]);

    vi.mocked(searchNoteEmbeddings).mockResolvedValue(matches as never);
    vi.mocked(getMatchedNotes).mockResolvedValue(notes);
    vi.mocked(buildRelatedNoteContext).mockReturnValue("related note context");
  });

  it("Query Expansion과 Note 검색 결과를 Related Notes Context로 구성한다", async () => {
    const result = await prepareRelatedNoteContext({
      title: "대상 노트",
      content: "대상 노트 내용",
      queryExpansionConfiguration,
      embeddingConfiguration,
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      targetNoteId: "33333333-3333-4333-8333-333333333333",
      limit: 10,
      minSimilarity: 0.5,
    });

    expect(expandRelatedNoteQuery).toHaveBeenCalledWith({
      configuration: queryExpansionConfiguration,
      title: "대상 노트",
      content: "대상 노트 내용",
    });

    expect(getRelatedNoteRecommendationExcludedIds).toHaveBeenCalledWith({
      noteId: "33333333-3333-4333-8333-333333333333",
    });

    expect(searchNoteEmbeddings).toHaveBeenCalledWith({
      embeddingConfiguration,
      excludeSourceIds: [
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
      ],
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      question: "expanded query",
      limit: 10,
      minSimilarity: 0.5,
    });

    expect(getMatchedNotes).toHaveBeenCalledWith({
      matches,
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    });

    expect(buildRelatedNoteContext).toHaveBeenCalledWith({
      notes,
    });

    expect(result).toEqual({
      context: "related note context",
      expandedQuery: "expanded query",
      notes,
    });
  });
});
