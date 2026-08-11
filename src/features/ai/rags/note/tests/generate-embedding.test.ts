import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH } from "@/features/ai/constants/embeddings";
import { deleteAiEmbeddingsBySource } from "@/features/ai/embeddings/cache";
import { generateAiEmbedding } from "@/features/ai/embeddings/generate";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import {
  createNoteEmbeddingInput,
  generateNoteEmbedding,
} from "../generate-embedding";

vi.mock("@/features/ai/embeddings/cache", () => ({
  deleteAiEmbeddingsBySource: vi.fn(),
}));

vi.mock("@/features/ai/embeddings/generate", () => ({
  generateAiEmbedding: vi.fn(),
}));

const EMBEDDING_CONFIGURATION = {
  model: {
    id: "embedding-model-id",
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 1536,
  },
} as AiRuntimeEmbeddingConfiguration;

const GENERATED_EMBEDDING_ID = "embedding-id";

const GENERATED_EMBEDDING = {
  id: GENERATED_EMBEDDING_ID,
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

    vi.mocked(generateAiEmbedding).mockResolvedValue(GENERATED_EMBEDDING);
    vi.mocked(deleteAiEmbeddingsBySource).mockResolvedValue(2);
  });

  it("Note embedding을 생성하고 기존 embedding을 정리한다", async () => {
    const title = "다익스트라 알고리즘";
    const content = "음수 가중치에서는 사용할 수 없다.";

    const result = await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      title,
      content,
    });

    const inputText = createNoteEmbeddingInput(title, content);

    expect(result).toBe(GENERATED_EMBEDDING);

    expect(generateAiEmbedding).toHaveBeenCalledWith({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      sourceType: "note",
      sourceId: "note-id",
      inputKind: "rag_note_content",
      inputText,
      inputPreview: inputText.slice(0, AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH),
    });

    expect(deleteAiEmbeddingsBySource).toHaveBeenCalledWith({
      ownerUserId: "user-id",
      sourceType: "note",
      sourceId: "note-id",
      inputKind: "rag_note_content",
      excludeEmbeddingId: GENERATED_EMBEDDING_ID,
    });
  });

  it("긴 Note 입력은 preview를 최대 길이까지 제한한다", async () => {
    const title = "Test Note";
    const content = "a".repeat(1000);

    await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      title,
      content,
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

  it("embedding 생성에 실패하면 기존 embedding을 삭제하지 않는다", async () => {
    const error = new Error("embedding generation failed");

    vi.mocked(generateAiEmbedding).mockRejectedValueOnce(error);

    await expect(
      generateNoteEmbedding({
        embeddingConfiguration: EMBEDDING_CONFIGURATION,
        ownerUserId: "user-id",
        noteId: "note-id",
        title: "Test Note",
        content: "Test content",
      }),
    ).rejects.toThrow("embedding generation failed");

    expect(deleteAiEmbeddingsBySource).not.toHaveBeenCalled();
  });

  it("새 embedding 생성이 완료된 후 기존 embedding을 삭제한다", async () => {
    const callOrder: string[] = [];

    vi.mocked(generateAiEmbedding).mockImplementationOnce(async () => {
      callOrder.push("generate");
      return GENERATED_EMBEDDING;
    });

    vi.mocked(deleteAiEmbeddingsBySource).mockImplementationOnce(async () => {
      callOrder.push("delete");
      return 2;
    });

    await generateNoteEmbedding({
      embeddingConfiguration: EMBEDDING_CONFIGURATION,
      ownerUserId: "user-id",
      noteId: "note-id",
      title: "Test Note",
      content: "Test content",
    });

    expect(callOrder).toEqual(["generate", "delete"]);
  });

  it("기존 embedding 삭제에 실패하면 오류를 전달한다", async () => {
    const error = new Error("embedding deletion failed");

    vi.mocked(deleteAiEmbeddingsBySource).mockRejectedValueOnce(error);

    await expect(
      generateNoteEmbedding({
        embeddingConfiguration: EMBEDDING_CONFIGURATION,
        ownerUserId: "user-id",
        noteId: "note-id",
        title: "Test Note",
        content: "Test content",
      }),
    ).rejects.toThrow("embedding deletion failed");

    expect(generateAiEmbedding).toHaveBeenCalledTimes(1);
    expect(deleteAiEmbeddingsBySource).toHaveBeenCalledTimes(1);
  });
});
