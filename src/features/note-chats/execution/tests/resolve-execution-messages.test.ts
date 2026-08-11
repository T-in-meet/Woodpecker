import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";

import {
  NOTE_CHAT_HISTORY_CHAR_LIMIT,
  NOTE_CHAT_HISTORY_MESSAGE_LIMIT,
} from "../../constants/execution";
import { buildNoteChatProviderMessages } from "../build-provider-messages";
import { resolveNoteChatExecutionMessages } from "../resolve-execution-messages";
import { resolveNoteChatProviderMessages } from "../resolve-messages";

vi.mock("../build-provider-messages", () => ({
  buildNoteChatProviderMessages: vi.fn(),
}));

vi.mock("../resolve-messages", () => ({
  resolveNoteChatProviderMessages: vi.fn(),
}));

const createMessage = (
  id: string,
  role: "user" | "assistant",
  sequenceNumber: number,
  text: string,
) => ({
  content: {
    text,
  },
  conversation_id: "conversation-1",
  created_at: "2026-08-11T00:00:00.000Z",
  id,
  role,
  sequence_number: sequenceNumber,
  updated_at: "2026-08-11T00:00:00.000Z",
});

describe("resolveNoteChatExecutionMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("현재 질문 이전의 대화 이력만 Provider 메시지 생성에 전달한다", () => {
    const messages = [
      createMessage("message-1", "user", 1, "이전 질문"),
      createMessage("message-2", "assistant", 2, "이전 답변"),
      createMessage("message-3", "user", 3, "현재 질문"),
      createMessage("message-4", "assistant", 4, "이후 답변"),
    ];

    const providerHistoryMessages: AiProviderChatMessage[] = [
      {
        role: AI_CHAT_MESSAGE_ROLE.USER,
        content: "이전 질문",
      },
      {
        role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "이전 답변",
      },
    ];

    const builtMessages: AiProviderChatMessage[] = [
      {
        role: AI_CHAT_MESSAGE_ROLE.USER,
        content: "현재 질문",
      },
    ];

    vi.mocked(resolveNoteChatProviderMessages).mockReturnValue(
      providerHistoryMessages,
    );
    vi.mocked(buildNoteChatProviderMessages).mockReturnValue(builtMessages);

    const result = resolveNoteChatExecutionMessages({
      context: "노트 Context",
      messages,
      userMessageId: "message-3",
      systemTemplate: "System Template",
      userTemplate: "User Template",
    });

    expect(resolveNoteChatProviderMessages).toHaveBeenCalledWith(
      messages.slice(0, 2),
    );

    expect(buildNoteChatProviderMessages).toHaveBeenCalledWith({
      context: "노트 Context",
      historyMessages: providerHistoryMessages,
      question: "현재 질문",
      systemTemplate: "System Template",
      userTemplate: "User Template",
    });

    expect(result).toBe(builtMessages);
  });

  it("현재 User Message를 찾을 수 없으면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatExecutionMessages({
        context: "",
        messages: [createMessage("message-1", "user", 1, "질문")],
        userMessageId: "missing-message",
        systemTemplate: "System Template",
        userTemplate: "User Template",
      }),
    ).toThrow("Note chat user message not found: missing-message");

    expect(resolveNoteChatProviderMessages).not.toHaveBeenCalled();
    expect(buildNoteChatProviderMessages).not.toHaveBeenCalled();
  });

  it("현재 실행 대상 Message가 User Message가 아니면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatExecutionMessages({
        context: "",
        messages: [createMessage("message-1", "assistant", 1, "답변")],
        userMessageId: "message-1",
        systemTemplate: "System Template",
        userTemplate: "User Template",
      }),
    ).toThrow("Note chat execution message is not a user message: message-1");

    expect(resolveNoteChatProviderMessages).not.toHaveBeenCalled();
    expect(buildNoteChatProviderMessages).not.toHaveBeenCalled();
  });

  it("Provider 메시지 이력이 메시지 개수 제한을 초과하면 최근 이력만 사용한다", () => {
    const historyMessageCount = NOTE_CHAT_HISTORY_MESSAGE_LIMIT + 1;

    const historyMessages = Array.from(
      { length: historyMessageCount },
      (_, index) =>
        createMessage(
          `message-${index + 1}`,
          index % 2 === 0 ? "user" : "assistant",
          index + 1,
          `질문 또는 답변 ${index + 1}`,
        ),
    );

    const currentMessage = createMessage(
      `message-${historyMessageCount + 1}`,
      "user",
      historyMessageCount + 1,
      "현재 질문",
    );

    const messages = [...historyMessages, currentMessage];

    const providerHistoryMessages: AiProviderChatMessage[] =
      historyMessages.map((message) => ({
        role:
          message.role === "user"
            ? AI_CHAT_MESSAGE_ROLE.USER
            : AI_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: message.content.text,
      }));

    vi.mocked(resolveNoteChatProviderMessages).mockReturnValue(
      providerHistoryMessages,
    );
    vi.mocked(buildNoteChatProviderMessages).mockReturnValue([]);

    resolveNoteChatExecutionMessages({
      context: "",
      messages,
      userMessageId: currentMessage.id,
      systemTemplate: "System Template",
      userTemplate: "User Template",
    });

    expect(buildNoteChatProviderMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        historyMessages: providerHistoryMessages.slice(
          -NOTE_CHAT_HISTORY_MESSAGE_LIMIT,
        ),
      }),
    );
  });

  it("최근 이력부터 문자 수 제한을 적용하고 원래 순서를 유지한다", () => {
    const messages = [
      createMessage("message-1", "user", 1, "질문 1"),
      createMessage("message-2", "assistant", 2, "답변 1"),
      createMessage("message-3", "user", 3, "현재 질문"),
    ];

    const messageLength = Math.floor(NOTE_CHAT_HISTORY_CHAR_LIMIT / 2);

    const providerHistoryMessages: AiProviderChatMessage[] = [
      {
        role: AI_CHAT_MESSAGE_ROLE.USER,
        content: "a".repeat(messageLength),
      },
      {
        role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "b".repeat(messageLength),
      },
      {
        role: AI_CHAT_MESSAGE_ROLE.USER,
        content: "c".repeat(messageLength),
      },
    ];

    vi.mocked(resolveNoteChatProviderMessages).mockReturnValue(
      providerHistoryMessages,
    );
    vi.mocked(buildNoteChatProviderMessages).mockReturnValue([]);

    resolveNoteChatExecutionMessages({
      context: "",
      messages,
      userMessageId: "message-3",
      systemTemplate: "System Template",
      userTemplate: "User Template",
    });

    expect(buildNoteChatProviderMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        historyMessages: [
          providerHistoryMessages[1],
          providerHistoryMessages[2],
        ],
      }),
    );
  });
});
