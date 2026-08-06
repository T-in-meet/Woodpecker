import { describe, expect, it } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";

import type { NoteChatMessage } from "../../types";
import { resolveNoteChatProviderMessages } from "../resolve-messages";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

/**
 * 테스트에 사용할 노트 챗봇 메시지 Row를 생성합니다.
 *
 * @param overrides 테스트별로 변경할 메시지 필드
 * @returns 노트 챗봇 메시지 Row
 */
function createMessage(
  overrides: Partial<NoteChatMessage> = {},
): NoteChatMessage {
  return {
    id: USER_MESSAGE_ID,
    conversation_id: CONVERSATION_ID,
    role: AI_CHAT_MESSAGE_ROLE.USER,
    content: {
      text: "질문입니다.",
    },
    sequence_number: 1,
    created_at: "2026-08-06T00:00:00.000Z",
    updated_at: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveNoteChatProviderMessages", () => {
  it("사용자 메시지를 Provider user 메시지로 변환한다", () => {
    const result = resolveNoteChatProviderMessages([
      createMessage({
        content: {
          text: "사용자 질문입니다.",
        },
      }),
    ]);

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "사용자 질문입니다.",
      },
    ]);
  });

  it("AI 메시지를 Provider assistant 메시지로 변환한다", () => {
    const result = resolveNoteChatProviderMessages([
      createMessage({
        id: ASSISTANT_MESSAGE_ID,
        role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: {
          text: "AI 답변입니다.",
          referencedNoteRanks: [1, 2],
        },
        sequence_number: 2,
      }),
    ]);

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "AI 답변입니다.",
      },
    ]);
  });

  it("전달받은 메시지 순서를 유지한다", () => {
    const result = resolveNoteChatProviderMessages([
      createMessage({
        content: {
          text: "첫 번째 질문",
        },
        sequence_number: 1,
      }),
      createMessage({
        id: ASSISTANT_MESSAGE_ID,
        role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: {
          text: "첫 번째 답변",
          referencedNoteRanks: [],
        },
        sequence_number: 2,
      }),
      createMessage({
        id: "44444444-4444-4444-8444-444444444444",
        content: {
          text: "두 번째 질문",
        },
        sequence_number: 3,
      }),
    ]);

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

  it("메시지가 없으면 빈 배열을 반환한다", () => {
    expect(resolveNoteChatProviderMessages([])).toEqual([]);
  });

  it("사용자 메시지 content가 올바르지 않으면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatProviderMessages([
        createMessage({
          content: {
            text: "",
          },
        }),
      ]),
    ).toThrow();
  });

  it("AI 메시지 content가 올바르지 않으면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatProviderMessages([
        createMessage({
          role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
          content: {
            text: "AI 답변입니다.",
          },
        }),
      ]),
    ).toThrow();
  });

  it("지원하지 않는 메시지 역할이면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatProviderMessages([
        createMessage({
          role: "system" as NoteChatMessage["role"],
        }),
      ]),
    ).toThrow("Unsupported note chat message role: system");
  });
});
