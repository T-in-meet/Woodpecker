import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import { createAdminClient } from "@/lib/supabase/admin";

import { replaceRelatedNoteAiRecommendations } from "../../persistence/replace-related-note-ai-recommendations";
import { runRelatedNoteRecommendation } from "../run-related-note-recommendation";
import { scheduleRelatedNoteRecommendation } from "../schedule-related-note-recommendation";

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void>) => callback()),
}));

vi.mock("@/features/ai/runtimes", () => ({
  resolveAiRuntimeChatConfiguration: vi.fn(),
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../persistence/replace-related-note-ai-recommendations", () => ({
  replaceRelatedNoteAiRecommendations: vi.fn(),
}));

vi.mock("../run-related-note-recommendation", () => ({
  runRelatedNoteRecommendation: vi.fn(),
}));

const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockResolveAiRuntimeChatConfiguration = vi.mocked(
  resolveAiRuntimeChatConfiguration,
);
const mockResolveAiRuntimeEmbeddingConfiguration = vi.mocked(
  resolveAiRuntimeEmbeddingConfiguration,
);
const mockRunRelatedNoteRecommendation = vi.mocked(
  runRelatedNoteRecommendation,
);
const mockReplaceRelatedNoteAiRecommendations = vi.mocked(
  replaceRelatedNoteAiRecommendations,
);

const OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const RELATED_NOTE_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_UPDATED_AT = "2026-08-20T01:00:00.000Z";

const embeddingConfiguration = {} as Awaited<
  ReturnType<typeof resolveAiRuntimeEmbeddingConfiguration>
>;

const queryExpansionConfiguration = {} as Awaited<
  ReturnType<typeof resolveAiRuntimeChatConfiguration>
>;

const answerConfiguration = {} as Awaited<
  ReturnType<typeof resolveAiRuntimeChatConfiguration>
>;

/**
 * scheduleRelatedNoteRecommendation에서 사용하는
 * notes 조회 체인만 최소한으로 구현한 Supabase Admin Client mock을 생성합니다.
 *
 * 실제 SupabaseClient의 전체 API를 테스트할 필요는 없으므로,
 * 필요한 query chain만 구성한 뒤 createAdminClient의 반환 타입으로 맞춥니다.
 */
function createNotesQueryMock({
  data,
  error,
}: {
  data: unknown;
  error: unknown;
}): ReturnType<typeof createAdminClient> {
  const maybeSingle = vi.fn().mockResolvedValue({
    data,
    error,
  });

  const eqUserId = vi.fn().mockReturnValue({
    maybeSingle,
  });

  const eqNoteId = vi.fn().mockReturnValue({
    eq: eqUserId,
  });

  const select = vi.fn().mockReturnValue({
    eq: eqNoteId,
  });

  return {
    from: vi.fn().mockReturnValue({
      select,
    }),
  } as unknown as ReturnType<typeof createAdminClient>;
}

describe("scheduleRelatedNoteRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveAiRuntimeEmbeddingConfiguration.mockResolvedValue(
      embeddingConfiguration,
    );

    mockResolveAiRuntimeChatConfiguration
      .mockResolvedValueOnce(queryExpansionConfiguration)
      .mockResolvedValueOnce(answerConfiguration);
  });

  it("최신 Note snapshot으로 추천을 실행하고 sourceUpdatedAt과 함께 저장한다", async () => {
    const supabase = createNotesQueryMock({
      data: {
        id: NOTE_ID,
        title: "Source note",
        content: "Source note content",
        updated_at: SOURCE_UPDATED_AT,
      },
      error: null,
    });

    mockCreateAdminClient.mockReturnValue(supabase);

    mockRunRelatedNoteRecommendation.mockResolvedValue({
      expandedQuery: "expanded query",
      notes: [],
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          reason: "관련 노트 추천 이유",
          title: "Related note",
        },
      ],
    });

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockRunRelatedNoteRecommendation).toHaveBeenCalledWith({
        answerConfiguration,
        content: "Source note content",
        embeddingConfiguration,
        limit: 5,
        minSimilarity: 0,
        ownerUserId: OWNER_USER_ID,
        queryExpansionConfiguration,
        targetNoteId: NOTE_ID,
        title: "Source note",
      });
    });

    expect(mockReplaceRelatedNoteAiRecommendations).toHaveBeenCalledWith({
      noteId: NOTE_ID,
      recommendations: [
        {
          noteId: RELATED_NOTE_ID,
          title: "Related note",
          reason: "관련 노트 추천 이유",
        },
      ],
      sourceUpdatedAt: SOURCE_UPDATED_AT,
    });
  });

  it("Note가 존재하지 않으면 추천을 실행하지 않는다", async () => {
    const supabase = createNotesQueryMock({
      data: null,
      error: null,
    });

    mockCreateAdminClient.mockReturnValue(supabase);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    });

    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();
  });

  it("Note 조회에 실패하면 추천을 실행하지 않는다", async () => {
    const supabase = createNotesQueryMock({
      data: null,
      error: {
        message: "Failed to load note",
      },
    });

    mockCreateAdminClient.mockReturnValue(supabase);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: OWNER_USER_ID,
    });

    await vi.waitFor(() => {
      expect(mockRunRelatedNoteRecommendation).not.toHaveBeenCalled();
    });

    expect(mockReplaceRelatedNoteAiRecommendations).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
