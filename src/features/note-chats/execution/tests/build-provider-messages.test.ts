import { describe, expect, it } from "vitest";

import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";

import { buildNoteChatProviderMessages } from "../build-provider-messages";

describe("buildNoteChatProviderMessages", () => {
  it("System Prompt와 현재 User Prompt를 렌더링한다", () => {
    const result = buildNoteChatProviderMessages({
      historyMessages: [],
      question: "프로세스와 스레드의 차이는 무엇인가요?",
      systemTemplate: "당신은 사용자의 노트를 설명하는 AI입니다.",
      userTemplate: "다음 질문에 답변하세요.\n\n{{question}}",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content: "당신은 사용자의 노트를 설명하는 AI입니다.",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content:
          "다음 질문에 답변하세요.\n\n프로세스와 스레드의 차이는 무엇인가요?",
      },
    ]);
  });

  it("System Prompt와 현재 질문 사이에 이전 대화 이력을 유지한다", () => {
    const historyMessages = [
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "운영체제란 무엇인가요?",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "운영체제는 하드웨어와 응용 프로그램을 관리합니다.",
      },
    ];

    const result = buildNoteChatProviderMessages({
      historyMessages,
      question: "그럼 프로세스는 무엇인가요?",
      systemTemplate: "당신은 설명을 이어가는 AI입니다.",
      userTemplate: "{{question}}",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content: "당신은 설명을 이어가는 AI입니다.",
      },
      ...historyMessages,
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "그럼 프로세스는 무엇인가요?",
      },
    ]);
  });

  it("System Template에서도 question 변수를 사용할 수 있다", () => {
    const result = buildNoteChatProviderMessages({
      historyMessages: [],
      question: "캐시란 무엇인가요?",
      systemTemplate: "현재 질문: {{question}}",
      userTemplate: "{{question}}",
    });

    expect(result[0]).toEqual({
      role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
      content: "현재 질문: 캐시란 무엇인가요?",
    });
  });

  it("전달받은 이전 대화 이력 배열을 변경하지 않는다", () => {
    const historyMessages = [
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "이전 질문",
      },
    ];

    buildNoteChatProviderMessages({
      historyMessages,
      question: "현재 질문",
      systemTemplate: "시스템",
      userTemplate: "{{question}}",
    });

    expect(historyMessages).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "이전 질문",
      },
    ]);
  });
});
