import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/features/admin/utils/require-admin";
import { generateNoteEmbedding } from "@/features/ai/rags/note/generate-embedding";
import { resolveAiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "./route";

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/ai/runtimes", () => ({
  resolveAiRuntimeEmbeddingConfiguration: vi.fn(),
}));

vi.mock("@/features/ai/rags/note/generate-embedding", () => ({
  generateNoteEmbedding: vi.fn(),
}));

const EMBEDDING_CONFIGURATION = {
  dimensions: 1536,
  distanceMetric: "cosine",
  model: "text-embedding-004",
  modelConfigId: "11111111-1111-4111-8111-111111111111",
  provider: "google",
} as never;

const NOTES = [
  {
    content: "첫 번째 노트 내용",
    id: "11111111-1111-4111-8111-111111111111",
    title: "첫 번째 노트",
    updated_at: "2026-08-17T01:00:00.000Z",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  },
  {
    content: "두 번째 노트 내용",
    id: "22222222-2222-4222-8222-222222222222",
    title: "두 번째 노트",
    updated_at: "2026-08-17T02:00:00.000Z",
    user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  },
  {
    content: "세 번째 노트 내용",
    id: "33333333-3333-4333-8333-333333333333",
    title: "세 번째 노트",
    updated_at: "2026-08-17T03:00:00.000Z",
    user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  },
] as const;

/**
 * 관리자 backfill Route를 호출하기 위한 Request를 생성합니다.
 *
 * offset을 전달하지 않으면 첫 번째 batch인 0부터 시작합니다.
 */
function createRequest(offset?: number) {
  const url = new URL("http://localhost/api/admin/ai/backfill-note-embeddings");

  if (offset !== undefined) {
    url.searchParams.set("offset", String(offset));
  }

  return new Request(url, {
    method: "POST",
  });
}

/**
 * Note 조회에 사용하는 Supabase query chain을 생성합니다.
 *
 * Route는 created_at, id 순으로 정렬한 뒤 range()를 호출하므로
 * 실제 호출 구조와 동일한 chain을 mock합니다.
 */
function createNotesQueryMock({
  data = NOTES,
  error = null,
}: {
  data?: typeof NOTES | [];
  error?: { message: string } | null;
} = {}) {
  const range = vi.fn().mockResolvedValue({
    data,
    error,
  });

  const secondOrder = vi.fn().mockReturnValue({
    range,
  });

  const firstOrder = vi.fn().mockReturnValue({
    order: secondOrder,
  });

  const select = vi.fn().mockReturnValue({
    order: firstOrder,
  });

  const from = vi.fn().mockReturnValue({
    select,
  });

  vi.mocked(createAdminClient).mockReturnValue({
    from,
  } as never);

  return {
    firstOrder,
    from,
    range,
    secondOrder,
    select,
  };
}

describe("POST /api/admin/ai/backfill-note-embeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAdmin).mockResolvedValue(undefined as never);

    vi.mocked(resolveAiRuntimeEmbeddingConfiguration).mockResolvedValue(
      EMBEDDING_CONFIGURATION,
    );

    vi.mocked(generateNoteEmbedding).mockResolvedValue([]);
  });

  it("관리자 인증에 실패하면 backfill을 실행하지 않는다", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Forbidden"));

    await expect(POST(createRequest())).rejects.toThrow("Forbidden");

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(resolveAiRuntimeEmbeddingConfiguration).not.toHaveBeenCalled();
    expect(generateNoteEmbedding).not.toHaveBeenCalled();
  });

  it("Runtime 설정 조회에 실패하면 Note backfill을 실행하지 않는다", async () => {
    vi.mocked(resolveAiRuntimeEmbeddingConfiguration).mockRejectedValue(
      new Error("Runtime configuration not found"),
    );

    await expect(POST(createRequest())).rejects.toThrow(
      "Runtime configuration not found",
    );

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(generateNoteEmbedding).not.toHaveBeenCalled();
  });

  it("Note 조회에 실패하면 500 응답을 반환하고 embedding을 생성하지 않는다", async () => {
    createNotesQueryMock({
      data: [],
      error: {
        message: "Failed to query notes",
      },
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Failed to load notes: Failed to query notes",
    });

    expect(generateNoteEmbedding).not.toHaveBeenCalled();
  });

  it("관리자 인증 후 현재 batch의 Note embedding을 모두 다시 생성한다", async () => {
    const { firstOrder, from, range, secondOrder, select } =
      createNotesQueryMock();

    const response = await POST(createRequest());
    const body = await response.json();

    expect(requireAdmin).toHaveBeenCalledTimes(1);

    expect(resolveAiRuntimeEmbeddingConfiguration).toHaveBeenCalledWith({
      featureKey: NOTE_CHAT_AI_FEATURE_KEY,
      roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
    });

    expect(from).toHaveBeenCalledWith("notes");

    expect(select).toHaveBeenCalledWith(
      "id, user_id, title, content, updated_at",
    );

    expect(firstOrder).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });

    expect(secondOrder).toHaveBeenCalledWith("id", {
      ascending: true,
    });

    /**
     * batch size가 10이고 hasMore 확인을 위해 한 건을 더 조회하므로
     * 첫 요청은 0부터 10까지 총 11개 범위를 조회합니다.
     */
    expect(range).toHaveBeenCalledWith(0, 10);

    expect(generateNoteEmbedding).toHaveBeenCalledTimes(3);

    expect(generateNoteEmbedding).toHaveBeenNthCalledWith(1, {
      content: NOTES[0].content,
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      noteId: NOTES[0].id,
      ownerUserId: NOTES[0].user_id,
      sourceUpdatedAt: NOTES[0].updated_at,
      title: NOTES[0].title,
    });

    expect(generateNoteEmbedding).toHaveBeenNthCalledWith(2, {
      content: NOTES[1].content,
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      noteId: NOTES[1].id,
      ownerUserId: NOTES[1].user_id,
      sourceUpdatedAt: NOTES[1].updated_at,
      title: NOTES[1].title,
    });

    expect(generateNoteEmbedding).toHaveBeenNthCalledWith(3, {
      content: NOTES[2].content,
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      noteId: NOTES[2].id,
      ownerUserId: NOTES[2].user_id,
      sourceUpdatedAt: NOTES[2].updated_at,
      title: NOTES[2].title,
    });

    expect(response.status).toBe(200);

    expect(body).toEqual({
      failed: 0,
      failures: [],
      hasMore: false,
      nextOffset: null,
      offset: 0,
      processed: 3,
      succeeded: 3,
    });
  });

  it("일부 Note의 embedding 생성이 실패해도 나머지 Note를 계속 처리한다", async () => {
    createNotesQueryMock();

    vi.mocked(generateNoteEmbedding)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("Embedding generation failed"))
      .mockResolvedValueOnce([]);

    const response = await POST(createRequest());
    const body = await response.json();

    expect(generateNoteEmbedding).toHaveBeenCalledTimes(3);

    expect(response.status).toBe(200);

    expect(body).toEqual({
      failed: 1,
      failures: [
        {
          error: "Embedding generation failed",
          noteId: NOTES[1].id,
        },
      ],
      hasMore: false,
      nextOffset: null,
      offset: 0,
      processed: 3,
      succeeded: 2,
    });
  });

  it("다음 batch가 존재하면 10개만 처리하고 다음 offset을 반환한다", async () => {
    const notes = Array.from({ length: 11 }, (_, index) => ({
      content: `${index + 1}번째 노트 내용`,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      title: `${index + 1}번째 노트`,
      updated_at: "2026-08-17T01:00:00.000Z",
      user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }));

    const range = vi.fn().mockResolvedValue({
      data: notes,
      error: null,
    });

    const secondOrder = vi.fn().mockReturnValue({
      range,
    });

    const firstOrder = vi.fn().mockReturnValue({
      order: secondOrder,
    });

    const select = vi.fn().mockReturnValue({
      order: firstOrder,
    });

    const from = vi.fn().mockReturnValue({
      select,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from,
    } as never);

    const response = await POST(createRequest(20));
    const body = await response.json();

    /**
     * offset 20에서 batch size 10개와 다음 batch 존재 여부를 확인하기 위한
     * sentinel 1개까지 포함해 20~30 범위를 조회합니다.
     */
    expect(range).toHaveBeenCalledWith(20, 30);

    /**
     * 조회된 11개 중 실제 embedding 생성 대상은 첫 10개뿐이며,
     * 마지막 Note는 다음 batch 존재 여부를 판단하기 위한 sentinel이므로
     * 이번 요청에서는 처리하지 않습니다.
     */
    expect(generateNoteEmbedding).toHaveBeenCalledTimes(10);

    expect(generateNoteEmbedding).not.toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: notes[10]!.id,
      }),
    );

    /**
     * 다음 batch가 존재하므로 현재 처리한 10개 이후 offset을 반환합니다.
     */
    expect(response.status).toBe(200);
    expect(body).toEqual({
      failed: 0,
      failures: [],
      hasMore: true,
      nextOffset: 30,
      offset: 20,
      processed: 10,
      succeeded: 10,
    });
  });
});
