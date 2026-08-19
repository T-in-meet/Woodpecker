import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH } from "@/features/ai/constants/embeddings";
import { deleteInactiveAiEmbeddingGeneration } from "@/features/ai/embeddings/cache";
import { generateAiEmbedding } from "@/features/ai/embeddings/generate";
import {
  activateAiEmbeddingGeneration,
  hasActiveAiEmbeddingGenerationForContent,
} from "@/features/ai/embeddings/generation";
import { createAiSha256Hash } from "@/features/ai/embeddings/hash";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import { createNoteContentChunks } from "../chunk";
import {
  createNoteEmbeddingInput,
  generateNoteEmbedding,
} from "../generate-embedding";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    randomUUID: vi.fn(),
  };
});

vi.mock("@/features/ai/embeddings/cache", () => ({
  deleteInactiveAiEmbeddingGeneration: vi.fn(),
}));

vi.mock("@/features/ai/embeddings/generation", () => ({
  activateAiEmbeddingGeneration: vi.fn(),
  hasActiveAiEmbeddingGenerationForContent: vi.fn(),
}));

vi.mock("@/features/ai/embeddings/generate", () => ({
  generateAiEmbedding: vi.fn(),
}));

vi.mock("../chunk", () => ({
  createNoteContentChunks: vi.fn(),
}));

const EMBEDDING_CONFIGURATION = {
  model: {
    id: "embedding-model-id",
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 1536,
  },
} as AiRuntimeEmbeddingConfiguration;

const GENERATION_ID = "55555555-5555-4555-8555-555555555555";

const SOURCE_UPDATED_AT = "2026-08-17T05:13:48.150038+00:00";

const GENERATED_EMBEDDING_0 = {
  id: "embedding-id-0",
} as never;

const GENERATED_EMBEDDING_1 = {
  id: "embedding-id-1",
} as never;

describe("createNoteEmbeddingInput", () => {
  it("제목과 내용을 RAG embedding 입력 형식으로 변환한다", () => {
    expect(
      createNoteEmbeddingInput(
        "다익스트라 알고리즘",
        "음수 가중치에서는 사용할 수 없다.",
      ),
    ).toBe(
      `Title:
다익스트라 알고리즘

Content:
음수 가중치에서는 사용할 수 없다.`,
    );
  });
});

describe("generateNoteEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(randomUUID).mockReturnValue(GENERATION_ID);

    vi.mocked(createNoteContentChunks).mockImplementation(({ content }) => [
      content,
    ]);

    vi.mocked(generateAiEmbedding).mockResolvedValue(GENERATED_EMBEDDING_0);

    vi.mocked(activateAiEmbeddingGeneration).mockResolvedValue();

    vi.mocked(hasActiveAiEmbeddingGenerationForContent).mockResolvedValue(
      false,
    );

    vi.mocked(deleteInactiveAiEmbeddingGeneration).mockResolvedValue(0);
  });

  it("생성할 chunk가 없으면 embedding generation을 실행하지 않는다", async () => {
    vi.mocked(createNoteContentChunks).mockReturnValue([]);

    const result = await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      title: "빈 노트",
      content: "",
    });

    expect(result).toEqual([]);

    expect(randomUUID).not.toHaveBeenCalled();
    expect(generateAiEmbedding).not.toHaveBeenCalled();
    expect(activateAiEmbeddingGeneration).not.toHaveBeenCalled();
    expect(deleteInactiveAiEmbeddingGeneration).not.toHaveBeenCalled();
  });

  it("같은 Note의 모든 chunk에 원본 Note 기준 contentHash를 전달하고 완성된 generation을 활성화한다", async () => {
    const title = "다익스트라 알고리즘";

    const chunks = [
      "다익스트라는 음수 가중치에서 사용할 수 없다.",
      "우선순위 큐를 사용하면 효율적으로 구현할 수 있다.",
    ] as const;

    const content = chunks.join("\n");

    vi.mocked(createNoteContentChunks).mockReturnValue([...chunks]);

    vi.mocked(generateAiEmbedding)
      .mockResolvedValueOnce(GENERATED_EMBEDDING_0)
      .mockResolvedValueOnce(GENERATED_EMBEDDING_1);

    const result = await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      title,
      content,
    });

    expect(result).toEqual([GENERATED_EMBEDDING_0, GENERATED_EMBEDDING_1]);

    expect(createNoteContentChunks).toHaveBeenCalledWith({
      content,
    });

    const contentHash = createAiSha256Hash(
      createNoteEmbeddingInput(title, content),
    );

    const firstInputText = createNoteEmbeddingInput(title, chunks[0]);
    const secondInputText = createNoteEmbeddingInput(title, chunks[1]);

    expect(generateAiEmbedding).toHaveBeenNthCalledWith(1, {
      chunkCount: 2,
      chunkIndex: 0,
      contentHash,
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      generationId: GENERATION_ID,
      inputKind: "rag_note_content",
      inputPreview: firstInputText.slice(
        0,
        AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH,
      ),
      inputText: firstInputText,
      ownerUserId: "user-id",
      sourceId: "note-id",
      sourceType: "note",
    });

    expect(generateAiEmbedding).toHaveBeenNthCalledWith(2, {
      chunkCount: 2,
      chunkIndex: 1,
      contentHash,
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      generationId: GENERATION_ID,
      inputKind: "rag_note_content",
      inputPreview: secondInputText.slice(
        0,
        AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH,
      ),
      inputText: secondInputText,
      ownerUserId: "user-id",
      sourceId: "note-id",
      sourceType: "note",
    });

    expect(activateAiEmbeddingGeneration).toHaveBeenCalledWith({
      generationId: GENERATION_ID,
      inputKind: "rag_note_content",
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: "user-id",
      sourceId: "note-id",
      sourceType: "note",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
    });

    expect(deleteInactiveAiEmbeddingGeneration).not.toHaveBeenCalled();
  });

  it("각 chunk의 preview를 최대 길이까지 제한한다", async () => {
    const chunk = "a".repeat(1000);

    vi.mocked(createNoteContentChunks).mockReturnValue([chunk]);

    await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      title: "Test Note",
      content: chunk,
    });

    const call = vi.mocked(generateAiEmbedding).mock.calls[0]?.[0];

    expect(call).toBeDefined();

    expect(call?.inputPreview).toBe(
      call?.inputText.slice(0, AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH),
    );

    expect(call?.inputPreview).toHaveLength(
      AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH,
    );
  });

  it("모든 chunk embedding 생성이 끝난 후 generation을 활성화한다", async () => {
    const callOrder: string[] = [];

    vi.mocked(createNoteContentChunks).mockReturnValue(["chunk 0", "chunk 1"]);

    vi.mocked(generateAiEmbedding)
      .mockImplementationOnce(async () => {
        callOrder.push("generate-0");

        return GENERATED_EMBEDDING_0;
      })
      .mockImplementationOnce(async () => {
        callOrder.push("generate-1");

        return GENERATED_EMBEDDING_1;
      });

    vi.mocked(activateAiEmbeddingGeneration).mockImplementationOnce(
      async () => {
        callOrder.push("activate");
      },
    );

    await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      title: "Test Note",
      content: "Test content",
    });

    expect(callOrder).toEqual(["generate-0", "generate-1", "activate"]);
  });

  it("chunk embedding 생성 중 실패하면 비활성 generation cleanup을 요청하고 활성화하지 않는다", async () => {
    const error = new Error("embedding generation failed");

    vi.mocked(createNoteContentChunks).mockReturnValue(["chunk 0", "chunk 1"]);

    vi.mocked(generateAiEmbedding)
      .mockResolvedValueOnce(GENERATED_EMBEDDING_0)
      .mockRejectedValueOnce(error);

    await expect(
      generateNoteEmbedding({
        embeddingConfiguration: EMBEDDING_CONFIGURATION,
        ownerUserId: "user-id",
        noteId: "note-id",
        sourceUpdatedAt: SOURCE_UPDATED_AT,
        title: "Test Note",
        content: "Test content",
      }),
    ).rejects.toThrow("embedding generation failed");

    expect(generateAiEmbedding).toHaveBeenCalledTimes(2);
    expect(activateAiEmbeddingGeneration).not.toHaveBeenCalled();

    expect(deleteInactiveAiEmbeddingGeneration).toHaveBeenCalledWith({
      generationId: GENERATION_ID,
      inputKind: "rag_note_content",
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: "user-id",
      sourceId: "note-id",
      sourceType: "note",
    });
  });

  it("generation 활성화 호출이 실패하면 안전한 비활성 generation cleanup을 요청하고 오류를 전달한다", async () => {
    const error = new Error("generation activation failed");

    vi.mocked(createNoteContentChunks).mockReturnValue(["chunk 0", "chunk 1"]);

    vi.mocked(generateAiEmbedding)
      .mockResolvedValueOnce(GENERATED_EMBEDDING_0)
      .mockResolvedValueOnce(GENERATED_EMBEDDING_1);

    vi.mocked(activateAiEmbeddingGeneration).mockRejectedValueOnce(error);

    await expect(
      generateNoteEmbedding({
        embeddingConfiguration: EMBEDDING_CONFIGURATION,
        ownerUserId: "user-id",
        noteId: "note-id",
        sourceUpdatedAt: SOURCE_UPDATED_AT,
        title: "Test Note",
        content: "Test content",
      }),
    ).rejects.toThrow("generation activation failed");

    expect(generateAiEmbedding).toHaveBeenCalledTimes(2);
    expect(activateAiEmbeddingGeneration).toHaveBeenCalledTimes(1);

    /*
     * activation이 DB에서는 이미 성공했을 가능성도 있으므로
     * 무조건 삭제하는 함수가 아니라 active 여부를 DB에서 확인하는
     * 안전한 cleanup RPC 경로를 사용해야 합니다.
     */
    expect(deleteInactiveAiEmbeddingGeneration).toHaveBeenCalledWith({
      generationId: GENERATION_ID,
      inputKind: "rag_note_content",
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: "user-id",
      sourceId: "note-id",
      sourceType: "note",
    });
  });

  it("비활성 generation 정리에 실패해도 원래 오류를 유지한다", async () => {
    const generationError = new Error("embedding generation failed");
    const cleanupError = new Error("generation cleanup failed");

    vi.mocked(generateAiEmbedding).mockRejectedValueOnce(generationError);

    vi.mocked(deleteInactiveAiEmbeddingGeneration).mockRejectedValueOnce(
      cleanupError,
    );

    await expect(
      generateNoteEmbedding({
        embeddingConfiguration: EMBEDDING_CONFIGURATION,
        ownerUserId: "user-id",
        noteId: "note-id",
        sourceUpdatedAt: SOURCE_UPDATED_AT,
        title: "Test Note",
        content: "Test content",
      }),
    ).rejects.toBe(generationError);

    expect(deleteInactiveAiEmbeddingGeneration).toHaveBeenCalledTimes(1);
    expect(activateAiEmbeddingGeneration).not.toHaveBeenCalled();
  });

  it("동일한 content의 활성 generation이 이미 있으면 embedding을 다시 생성하지 않는다", async () => {
    const title = "다익스트라 알고리즘";
    const content = "음수 가중치에서는 사용할 수 없다.";

    vi.mocked(hasActiveAiEmbeddingGenerationForContent).mockResolvedValue(true);

    const result = await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      sourceUpdatedAt: SOURCE_UPDATED_AT,
      title,
      content,
    });

    const contentHash = createAiSha256Hash(
      createNoteEmbeddingInput(title, content),
    );

    expect(hasActiveAiEmbeddingGenerationForContent).toHaveBeenCalledWith({
      contentHash,
      inputKind: "rag_note_content",
      modelConfigId: EMBEDDING_CONFIGURATION.model.id,
      ownerUserId: "user-id",
      sourceId: "note-id",
      sourceType: "note",
    });

    expect(result).toEqual([]);
    expect(randomUUID).not.toHaveBeenCalled();
    expect(generateAiEmbedding).not.toHaveBeenCalled();
    expect(activateAiEmbeddingGeneration).not.toHaveBeenCalled();
    expect(deleteInactiveAiEmbeddingGeneration).not.toHaveBeenCalled();
  });
});
