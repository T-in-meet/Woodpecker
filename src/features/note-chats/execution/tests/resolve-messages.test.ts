import { describe, expect, it } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";
import type { Json } from "@/types/db.helpers";

import { resolveNoteChatProviderMessages } from "../resolve-messages";

const createMessage = (
  id: string,
  role: "user" | "assistant",
  sequenceNumber: number,
  content: Json,
) => ({
  content,
  conversation_id: "conversation-1",
  created_at: "2026-08-11T00:00:00.000Z",
  id,
  role,
  sequence_number: sequenceNumber,
  updated_at: "2026-08-11T00:00:00.000Z",
});

describe("resolveNoteChatProviderMessages", () => {
  it("User 메시지를 Provider User 메시지로 변환한다", () => {
    const messages = [
      createMessage("message-1", AI_CHAT_MESSAGE_ROLE.USER, 1, {
        text: "사용자 질문",
      }),
    ];

    const result = resolveNoteChatProviderMessages(messages);

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "사용자 질문",
      },
    ]);
  });

  it("Assistant 메시지를 Provider Assistant 메시지로 변환한다", () => {
    const messages = [
      createMessage("message-1", AI_CHAT_MESSAGE_ROLE.ASSISTANT, 1, {
        text: "AI 답변",
        usedNoteIds: [
          "550e8400-e29b-41d4-a716-446655440000",
          "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        ],
      }),
    ];

    const result = resolveNoteChatProviderMessages(messages);

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "AI 답변",
      },
    ]);
  });

  it("메시지의 DB 순서를 유지하면서 Provider 메시지로 변환한다", () => {
    const messages = [
      createMessage("message-1", AI_CHAT_MESSAGE_ROLE.USER, 1, {
        text: "첫 번째 질문",
      }),
      createMessage("message-2", AI_CHAT_MESSAGE_ROLE.ASSISTANT, 2, {
        text: "첫 번째 답변",
        usedNoteIds: [],
      }),
      createMessage("message-3", AI_CHAT_MESSAGE_ROLE.USER, 3, {
        text: "두 번째 질문",
      }),
    ];

    const result = resolveNoteChatProviderMessages(messages);

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "첫 번째 질문",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "첫 번째 답변",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "두 번째 질문",
      },
    ]);
  });

  it("메시지 Content가 스키마를 만족하지 않으면 오류를 발생시킨다", () => {
    const messages = [
      createMessage("message-1", AI_CHAT_MESSAGE_ROLE.USER, 1, {
        text: "",
      }),
    ];

    expect(() => resolveNoteChatProviderMessages(messages)).toThrow();
  });
});
