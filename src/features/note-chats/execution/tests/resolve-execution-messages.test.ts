import { describe, expect, it } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";

import type { NoteChatMessage } from "../../types";
import { resolveNoteChatExecutionMessages } from "../resolve-execution-messages";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const FIRST_USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";
const CURRENT_USER_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";
const LATER_MESSAGE_ID = "55555555-5555-4555-8555-555555555555";

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
    id: FIRST_USER_MESSAGE_ID,
    conversation_id: CONVERSATION_ID,
    role: AI_CHAT_MESSAGE_ROLE.USER,
    content: {
      text: "첫 번째 질문",
    },
    sequence_number: 1,
    created_at: "2026-08-06T00:00:00.000Z",
    updated_at: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveNoteChatExecutionMessages", () => {
  it("이전 대화 이력과 현재 질문으로 최종 Provider 메시지를 생성한다", () => {
    const messages = [
      createMessage(),
      createMessage({
        id: ASSISTANT_MESSAGE_ID,
        role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: {
          text: "첫 번째 답변",
          referencedNoteIds: [],
        },
        sequence_number: 2,
      }),
      createMessage({
        id: CURRENT_USER_MESSAGE_ID,
        content: {
          text: "현재 질문",
        },
        sequence_number: 3,
      }),
    ];

    const result = resolveNoteChatExecutionMessages({
      messages,
      userMessageId: CURRENT_USER_MESSAGE_ID,
      systemTemplate: "노트 챗봇 시스템 지침",
      userTemplate: "질문: {{question}}",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content: "노트 챗봇 시스템 지침",
      },
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
        content: "질문: 현재 질문",
      },
    ]);
  });

  it("현재 사용자 메시지를 이전 대화 이력에 중복 포함하지 않는다", () => {
    const result = resolveNoteChatExecutionMessages({
      messages: [
        createMessage({
          id: CURRENT_USER_MESSAGE_ID,
          content: {
            text: "현재 질문",
          },
        }),
      ],
      userMessageId: CURRENT_USER_MESSAGE_ID,
      systemTemplate: "시스템",
      userTemplate: "{{question}}",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content: "시스템",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "현재 질문",
      },
    ]);
  });

  it("현재 사용자 메시지 이후의 메시지는 대화 이력에서 제외한다", () => {
    const result = resolveNoteChatExecutionMessages({
      messages: [
        createMessage({
          id: CURRENT_USER_MESSAGE_ID,
          content: {
            text: "현재 질문",
          },
          sequence_number: 2,
        }),
        createMessage({
          id: LATER_MESSAGE_ID,
          role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
          content: {
            text: "이후 답변",
            referencedNoteIds: [],
          },
          sequence_number: 3,
        }),
      ],
      userMessageId: CURRENT_USER_MESSAGE_ID,
      systemTemplate: "시스템",
      userTemplate: "{{question}}",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content: "시스템",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "현재 질문",
      },
    ]);
  });

  it("현재 사용자 메시지를 찾을 수 없으면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatExecutionMessages({
        messages: [],
        userMessageId: CURRENT_USER_MESSAGE_ID,
        systemTemplate: "시스템",
        userTemplate: "{{question}}",
      }),
    ).toThrow(`Note chat user message not found: ${CURRENT_USER_MESSAGE_ID}`);
  });

  it("현재 실행 메시지가 AI 메시지이면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatExecutionMessages({
        messages: [
          createMessage({
            id: CURRENT_USER_MESSAGE_ID,
            role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
            content: {
              text: "AI 답변",
              referencedNoteIds: [],
            },
          }),
        ],
        userMessageId: CURRENT_USER_MESSAGE_ID,
        systemTemplate: "시스템",
        userTemplate: "{{question}}",
      }),
    ).toThrow(
      `Note chat execution message is not a user message: ${CURRENT_USER_MESSAGE_ID}`,
    );
  });

  it("현재 사용자 메시지 content가 올바르지 않으면 오류를 발생시킨다", () => {
    expect(() =>
      resolveNoteChatExecutionMessages({
        messages: [
          createMessage({
            id: CURRENT_USER_MESSAGE_ID,
            content: {
              text: "",
            },
          }),
        ],
        userMessageId: CURRENT_USER_MESSAGE_ID,
        systemTemplate: "시스템",
        userTemplate: "{{question}}",
      }),
    ).toThrow();
  });
});
