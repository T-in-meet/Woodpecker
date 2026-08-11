import { describe, expect, it, vi } from "vitest";

import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";

import { buildNoteChatProviderMessages } from "../build-provider-messages";

const { renderPromptTemplateMock } = vi.hoisted(() => ({
  renderPromptTemplateMock: vi.fn(),
}));

vi.mock("@/features/ai/prompts/render", () => ({
  renderPromptTemplate: renderPromptTemplateMock,
}));

describe("buildNoteChatProviderMessages", () => {
  it("System Prompt, Note Context, 이전 대화 이력, 현재 User Prompt 순서로 메시지를 구성한다", () => {
    renderPromptTemplateMock
      .mockReturnValueOnce("렌더링된 System Prompt")
      .mockReturnValueOnce("렌더링된 User Prompt");

    const historyMessages = [
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "이전 질문",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "이전 답변",
      },
    ];

    const result = buildNoteChatProviderMessages({
      context: "<note>\n<title>노트</title>\n<content>내용</content>\n</note>",
      historyMessages,
      question: "현재 질문",
      systemTemplate: "System: {{question}}",
      userTemplate: "User: {{question}}",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content:
          "렌더링된 System Prompt\n\n다음은 답변에 사용할 수 있는 사용자 노트 Context입니다.\n\n<note>\n<title>노트</title>\n<content>내용</content>\n</note>",
      },
      ...historyMessages,
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "렌더링된 User Prompt",
      },
    ]);

    expect(renderPromptTemplateMock).toHaveBeenNthCalledWith(
      1,
      "System: {{question}}",
      { question: "현재 질문" },
    );
    expect(renderPromptTemplateMock).toHaveBeenNthCalledWith(
      2,
      "User: {{question}}",
      { question: "현재 질문" },
    );
  });

  it("Note Context가 없으면 사용 가능한 Context가 없다는 안내를 포함한다", () => {
    renderPromptTemplateMock
      .mockReturnValueOnce("렌더링된 System Prompt")
      .mockReturnValueOnce("렌더링된 User Prompt");

    const result = buildNoteChatProviderMessages({
      context: "",
      historyMessages: [],
      question: "현재 질문",
      systemTemplate: "System Template",
      userTemplate: "User Template",
    });

    expect(result).toEqual([
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
        content:
          "렌더링된 System Prompt\n\n사용 가능한 사용자 노트 Context가 없습니다.",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "렌더링된 User Prompt",
      },
    ]);
  });

  it("현재 질문은 이전 대화 이력에 포함하지 않고 별도의 User 메시지로 전달한다", () => {
    renderPromptTemplateMock
      .mockReturnValueOnce("System Prompt")
      .mockReturnValueOnce("User Prompt");

    const historyMessages = [
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
        content: "이전 질문",
      },
      {
        role: AI_PROVIDER_CHAT_MESSAGE_ROLE.ASSISTANT,
        content: "이전 답변",
      },
    ];

    const result = buildNoteChatProviderMessages({
      context: "Note Context",
      historyMessages,
      question: "현재 질문",
      systemTemplate: "System",
      userTemplate: "User",
    });

    expect(result).toHaveLength(4);
    expect(result[1]).toEqual(historyMessages[0]);
    expect(result[2]).toEqual(historyMessages[1]);
    expect(result[3]).toEqual({
      role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
      content: "User Prompt",
    });

    expect(result).not.toContainEqual({
      role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
      content: "현재 질문",
    });
  });
});
