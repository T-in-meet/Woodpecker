import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_MODEL_PROVIDER } from "../../constants/models";
import {
  createGoogleChatCompletion,
  createGoogleJsonChatCompletion,
  streamGoogleChatCompletion,
} from "../google/chat";
import { createGoogleEmbedding } from "../google/embeddings";
import {
  createAiChatCompletionWithProvider,
  createAiEmbeddingWithProvider,
  createAiJsonChatCompletionWithProvider,
  streamAiChatCompletionWithProvider,
} from "../index";
import {
  createOpenAiChatCompletion,
  createOpenAiJsonChatCompletion,
  streamOpenAiChatCompletion,
} from "../openai/chat";
import { createOpenAiEmbedding } from "../openai/embeddings";
import type {
  AiChatCompletionResult,
  AiChatStreamEvent,
  AiEmbeddingResult,
} from "../types";

vi.mock("../openai/chat", () => ({
  createOpenAiChatCompletion: vi.fn(),
  createOpenAiJsonChatCompletion: vi.fn(),
  streamOpenAiChatCompletion: vi.fn(),
}));

vi.mock("../google/chat", () => ({
  createGoogleChatCompletion: vi.fn(),
  createGoogleJsonChatCompletion: vi.fn(),
  streamGoogleChatCompletion: vi.fn(),
}));

vi.mock("../openai/embeddings", () => ({
  createOpenAiEmbedding: vi.fn(),
}));

vi.mock("../google/embeddings", () => ({
  createGoogleEmbedding: vi.fn(),
}));

const OPENAI_EMBEDDING_RESULT = {
  embedding: [0.1, 0.2, 0.3],
  metadata: {},
  usage: {
    inputTokens: 10,
    outputTokens: 0,
    totalTokens: 10,
  },
} satisfies AiEmbeddingResult;

const GOOGLE_EMBEDDING_RESULT = {
  embedding: [0.4, 0.5, 0.6],
  metadata: {},
  usage: {
    inputTokens: 20,
    outputTokens: 0,
    totalTokens: 20,
  },
} satisfies AiEmbeddingResult;

const OPENAI_CHAT_RESULT = {
  content: "OpenAI 응답",
  metadata: {},
  usage: {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  },
} satisfies AiChatCompletionResult;

const GOOGLE_CHAT_RESULT = {
  content: "Google 응답",
  metadata: {},
  usage: {
    inputTokens: 15,
    outputTokens: 25,
    totalTokens: 40,
  },
} satisfies AiChatCompletionResult;

const OPENAI_STREAM = {} as AsyncGenerator<AiChatStreamEvent>;
const GOOGLE_STREAM = {} as AsyncGenerator<AiChatStreamEvent>;

const COMMON_PARAMS = {
  apiKey: "test-api-key",
  messages: [
    {
      role: "user" as const,
      content: "질문입니다.",
    },
  ],
  model: "test-model",
  temperature: 0.2,
};

const EMBEDDING_PARAMS = {
  apiKey: "test-api-key",
  dimensions: 1536,
  input: "임베딩할 텍스트입니다.",
  model: "test-embedding-model",
};

const CHAT_PARAMS = {
  apiKey: "test-api-key",
  model: "test-model",
  systemPrompt: "시스템 프롬프트입니다.",
  temperature: 0.2,
  userPrompt: "질문입니다.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createAiEmbeddingWithProvider", () => {
  it("OpenAI Provider이면 OpenAI embedding 생성을 호출하고 결과를 반환한다", async () => {
    vi.mocked(createOpenAiEmbedding).mockResolvedValue(OPENAI_EMBEDDING_RESULT);

    const result = await createAiEmbeddingWithProvider({
      ...EMBEDDING_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });

    expect(createOpenAiEmbedding).toHaveBeenCalledWith({
      ...EMBEDDING_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });
    expect(createGoogleEmbedding).not.toHaveBeenCalled();
    expect(result).toBe(OPENAI_EMBEDDING_RESULT);
  });

  it("Google Provider이면 Google embedding 생성을 호출하고 결과를 반환한다", async () => {
    vi.mocked(createGoogleEmbedding).mockResolvedValue(GOOGLE_EMBEDDING_RESULT);

    const result = await createAiEmbeddingWithProvider({
      ...EMBEDDING_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });

    expect(createGoogleEmbedding).toHaveBeenCalledWith({
      ...EMBEDDING_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });
    expect(createOpenAiEmbedding).not.toHaveBeenCalled();
    expect(result).toBe(GOOGLE_EMBEDDING_RESULT);
  });
});

describe("createAiChatCompletionWithProvider", () => {
  it("OpenAI Provider이면 OpenAI Chat Completion을 호출하고 결과를 반환한다", async () => {
    vi.mocked(createOpenAiChatCompletion).mockResolvedValue(OPENAI_CHAT_RESULT);

    const result = await createAiChatCompletionWithProvider({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });

    expect(createOpenAiChatCompletion).toHaveBeenCalledWith({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });
    expect(createGoogleChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe(OPENAI_CHAT_RESULT);
  });

  it("Google Provider이면 Google Chat Completion을 호출하고 결과를 반환한다", async () => {
    vi.mocked(createGoogleChatCompletion).mockResolvedValue(GOOGLE_CHAT_RESULT);

    const result = await createAiChatCompletionWithProvider({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });

    expect(createGoogleChatCompletion).toHaveBeenCalledWith({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });
    expect(createOpenAiChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe(GOOGLE_CHAT_RESULT);
  });
});

describe("createAiJsonChatCompletionWithProvider", () => {
  it("OpenAI Provider이면 OpenAI JSON Chat Completion을 호출하고 결과를 반환한다", async () => {
    vi.mocked(createOpenAiJsonChatCompletion).mockResolvedValue(
      OPENAI_CHAT_RESULT,
    );

    const result = await createAiJsonChatCompletionWithProvider({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });

    expect(createOpenAiJsonChatCompletion).toHaveBeenCalledWith({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });
    expect(createGoogleJsonChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe(OPENAI_CHAT_RESULT);
  });

  it("Google Provider이면 Google JSON Chat Completion을 호출하고 결과를 반환한다", async () => {
    vi.mocked(createGoogleJsonChatCompletion).mockResolvedValue(
      GOOGLE_CHAT_RESULT,
    );

    const result = await createAiJsonChatCompletionWithProvider({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });

    expect(createGoogleJsonChatCompletion).toHaveBeenCalledWith({
      ...CHAT_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });
    expect(createOpenAiJsonChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe(GOOGLE_CHAT_RESULT);
  });
});

describe("streamAiChatCompletionWithProvider", () => {
  it("OpenAI Provider이면 OpenAI Chat 스트림을 반환한다", () => {
    vi.mocked(streamOpenAiChatCompletion).mockReturnValue(OPENAI_STREAM);

    const result = streamAiChatCompletionWithProvider({
      ...COMMON_PARAMS,
      provider: AI_MODEL_PROVIDER.OPENAI,
    });

    expect(streamOpenAiChatCompletion).toHaveBeenCalledWith(COMMON_PARAMS);
    expect(streamGoogleChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe(OPENAI_STREAM);
  });

  it("Google Provider이면 Google Chat 스트림을 반환한다", () => {
    vi.mocked(streamGoogleChatCompletion).mockReturnValue(GOOGLE_STREAM);

    const result = streamAiChatCompletionWithProvider({
      ...COMMON_PARAMS,
      provider: AI_MODEL_PROVIDER.GOOGLE,
    });

    expect(streamGoogleChatCompletion).toHaveBeenCalledWith(COMMON_PARAMS);
    expect(streamOpenAiChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe(GOOGLE_STREAM);
  });
});
