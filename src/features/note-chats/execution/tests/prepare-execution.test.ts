import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { buildNoteContext } from "@/features/ai/rags/note/build-context";
import { getMatchedNotes } from "@/features/ai/rags/note/get-matched-notes";
import { searchNoteEmbeddingsWithUsage } from "@/features/ai/rags/note/search-embeddings";
import { NOTE_CHAT_OPERATIONAL_ERROR_CODES } from "@/features/operational-errors/constants";

import { getNoteChatConversationDetailForExecution } from "../../internal-queries";
import { reportNoteChatOperationalError } from "../../utils/report-operational-error";
import { buildNoteChatSources } from "../build-note-sources";
import { expandNoteChatQuery } from "../expand-query";
import {
  type NoteChatExecutionSettings,
  prepareNoteChatExecution,
} from "../prepare-execution";
import { resolveNoteChatExecutionMessages } from "../resolve-execution-messages";

vi.mock("../../internal-queries", () => ({
  getNoteChatConversationDetailForExecution: vi.fn(),
}));

vi.mock("../../utils/report-operational-error", () => ({
  reportNoteChatOperationalError: vi.fn(),
}));

vi.mock("@/features/ai/rags/note/build-context", () => ({
  buildNoteContext: vi.fn(),
}));

vi.mock("@/features/ai/rags/note/get-matched-notes", () => ({
  getMatchedNotes: vi.fn(),
}));

vi.mock("@/features/ai/rags/note/search-embeddings", () => ({
  searchNoteEmbeddingsWithUsage: vi.fn(),
}));

vi.mock("../build-note-sources", () => ({
  buildNoteChatSources: vi.fn(),
}));

vi.mock("../expand-query", () => ({
  expandNoteChatQuery: vi.fn(),
}));

vi.mock("../resolve-execution-messages", () => ({
  resolveNoteChatExecutionMessages: vi.fn(),
}));

const settings = {
  chat: {
    prompt: {
      version: {
        system_template: "System Template",
        user_template: "User Template",
      },
    },
  },
} as unknown as NoteChatExecutionSettings;

const conversation = {
  id: "conversation-1",
  user_id: "user-1",
};

const userMessage = {
  content: { text: "질문" },
  id: "message-1",
  role: AI_CHAT_MESSAGE_ROLE.USER,
  sequence_number: 1,
};

const messages = [userMessage];

const detail = {
  conversation,
  messages,
} as never;

/**
 * 질의 확장 Chat Completion에서 사용한 token 사용량입니다.
 */
const queryExpansionUsage = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
};

/**
 * 검색 질의 embedding Provider 호출에서 발생한 token 사용량입니다.
 */
const queryEmbeddingUsage = {
  inputTokens: 40,
  outputTokens: 0,
  totalTokens: 40,
};

describe("prepareNoteChatExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getNoteChatConversationDetailForExecution).mockResolvedValue(
      detail,
    );

    vi.mocked(expandNoteChatQuery).mockResolvedValue({
      expandedQuery: "확장된 검색 질의",
      usage: queryExpansionUsage,
    });

    vi.mocked(searchNoteEmbeddingsWithUsage).mockResolvedValue({
      matches: [],
      usage: queryEmbeddingUsage,
    });

    vi.mocked(getMatchedNotes).mockResolvedValue([]);

    vi.mocked(buildNoteContext).mockReturnValue("");

    vi.mocked(buildNoteChatSources).mockReturnValue([]);

    vi.mocked(resolveNoteChatExecutionMessages).mockReturnValue([]);

    vi.mocked(reportNoteChatOperationalError).mockResolvedValue(undefined);
  });

  it("실행에 필요한 정보와 질의 확장 usage를 준비하고 PreparedNoteChatExecution을 반환한다", async () => {
    const result = await prepareNoteChatExecution({
      conversationId: "conversation-1",
      settings,
      userId: "user-1",
      userMessageId: "message-1",
    });

    expect(getNoteChatConversationDetailForExecution).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
      "message-1",
    );

    expect(expandNoteChatQuery).toHaveBeenCalledWith({
      configuration: settings.queryExpansion,
      messages,
      userMessageId: "message-1",
    });

    expect(searchNoteEmbeddingsWithUsage).toHaveBeenCalledWith({
      embeddingConfiguration: settings.embedding,
      limit: expect.any(Number),
      minSimilarity: expect.any(Number),
      onUsage: undefined,
      ownerUserId: "user-1",
      question: "확장된 검색 질의",
    });

    expect(getMatchedNotes).toHaveBeenCalledWith({
      matches: [],
      ownerUserId: "user-1",
    });

    expect(buildNoteContext).toHaveBeenCalledWith({
      notes: [],
    });

    expect(buildNoteChatSources).toHaveBeenCalledWith([]);

    expect(resolveNoteChatExecutionMessages).toHaveBeenCalledWith({
      context: "",
      messages,
      systemTemplate: settings.chat.prompt.version.system_template,
      userMessageId: "message-1",
      userTemplate: settings.chat.prompt.version.user_template,
    });

    expect(result).toEqual({
      conversation,
      context: "",
      expandedQuery: "확장된 검색 질의",
      history: [],
      messages: [],
      question: "질문",
      queryEmbeddingUsage,
      queryExpansionUsage,
      settings,
      sources: [],
      userMessageId: "message-1",
    });
  });

  it("Conversation을 찾을 수 없으면 실행 상태 오류를 보고하고 예외를 발생시킨다", async () => {
    vi.mocked(getNoteChatConversationDetailForExecution).mockResolvedValue(
      null,
    );

    await expect(
      prepareNoteChatExecution({
        conversationId: "conversation-1",
        settings,
        userId: "user-1",
        userMessageId: "message-1",
      }),
    ).rejects.toThrow("Note chat conversation not found: conversation-1");

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          conversationId: "conversation-1",
          userMessageId: "message-1",
        },
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_STATE_INVALID,
      }),
    );
  });

  it("실행 대상 User Message를 찾을 수 없으면 실행 상태 오류를 보고하고 예외를 발생시킨다", async () => {
    vi.mocked(getNoteChatConversationDetailForExecution).mockResolvedValue({
      conversation,
      messages: [],
    } as never);

    await expect(
      prepareNoteChatExecution({
        conversationId: "conversation-1",
        settings,
        userId: "user-1",
        userMessageId: "message-1",
      }),
    ).rejects.toThrow("Note chat user message not found: message-1");

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_STATE_INVALID,
        userId: "user-1",
      }),
    );
  });

  it("실행 대상 Message가 User 역할이 아니면 실행 상태 오류를 보고하고 예외를 발생시킨다", async () => {
    const assistantMessage = {
      id: "message-1",
      role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
    };

    vi.mocked(getNoteChatConversationDetailForExecution).mockResolvedValue({
      conversation,
      messages: [assistantMessage],
    } as never);

    await expect(
      prepareNoteChatExecution({
        conversationId: "conversation-1",
        settings,
        userId: "user-1",
        userMessageId: "message-1",
      }),
    ).rejects.toThrow(
      "Note chat execution message is not a user message: message-1",
    );

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_STATE_INVALID,
        userId: "user-1",
      }),
    );
  });

  it("검색된 Note 조회에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = new Error("matched notes load failed");

    vi.mocked(getMatchedNotes).mockRejectedValue(error);

    await expect(
      prepareNoteChatExecution({
        conversationId: "conversation-1",
        settings,
        userId: "user-1",
        userMessageId: "message-1",
      }),
    ).rejects.toBe(error);

    expect(reportNoteChatOperationalError).toHaveBeenCalledOnce();
    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        context: {
          conversationId: "conversation-1",
          userMessageId: "message-1",
        },
        error,
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.MATCHED_NOTES_LOAD_FAILED,
        userId: "user-1",
      }),
    );
  });

  it("Provider 메시지 구성에 실패하면 운영 오류를 보고하고 예외를 발생시킨다", async () => {
    const error = new Error("message resolve failed");

    vi.mocked(resolveNoteChatExecutionMessages).mockImplementation(() => {
      throw error;
    });

    await expect(
      prepareNoteChatExecution({
        conversationId: "conversation-1",
        settings,
        userId: "user-1",
        userMessageId: "message-1",
      }),
    ).rejects.toThrow("message resolve failed");

    expect(reportNoteChatOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        error,
        userId: "user-1",
      }),
    );
  });

  it("같은 Note의 여러 chunk도 중복 제거하지 않고 Context와 Source에 전달한다", async () => {
    const matchedChunks = [
      {
        chunkText: "Title:\n테스트 노트\n\nContent:\nchunk 0",
        distance: 0.1,
        embeddingId: "embedding-1",
        id: "11111111-1111-4111-8111-111111111111",
        similarity: 0.9,
        title: "테스트 노트",
      },
      {
        chunkText: "Title:\n테스트 노트\n\nContent:\nchunk 1",
        distance: 0.2,
        embeddingId: "embedding-2",
        id: "11111111-1111-4111-8111-111111111111",
        similarity: 0.8,
        title: "테스트 노트",
      },
    ];

    const context = "chunk context";
    const sources = [
      {
        contextIndex: 1,
        content: matchedChunks[0]!.chunkText,
        embeddingId: "embedding-1",
        noteId: matchedChunks[0]!.id,
        type: "note",
      },
      {
        contextIndex: 2,
        content: matchedChunks[1]!.chunkText,
        embeddingId: "embedding-2",
        noteId: matchedChunks[1]!.id,
        type: "note",
      },
    ];

    vi.mocked(getMatchedNotes).mockResolvedValue(matchedChunks);
    vi.mocked(buildNoteContext).mockReturnValue(context);
    vi.mocked(buildNoteChatSources).mockReturnValue(sources as never);
    vi.mocked(resolveNoteChatExecutionMessages).mockReturnValue([]);

    const result = await prepareNoteChatExecution({
      conversationId: "conversation-1",
      settings,
      userId: "user-1",
      userMessageId: "message-1",
    });

    expect(buildNoteContext).toHaveBeenCalledWith({
      notes: matchedChunks,
    });

    expect(buildNoteChatSources).toHaveBeenCalledWith(matchedChunks);

    expect(resolveNoteChatExecutionMessages).toHaveBeenCalledWith({
      context,
      messages,
      systemTemplate: settings.chat.prompt.version.system_template,
      userMessageId: "message-1",
      userTemplate: settings.chat.prompt.version.user_template,
    });

    /*
     * 검색 결과와 무관하게 질의 확장에서 사용한 token 사용량은
     * 이후 Note Chat Run에서 합산할 수 있도록 그대로 전달합니다.
     */
    expect(result.queryExpansionUsage).toEqual(queryExpansionUsage);
  });
});
