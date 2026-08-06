import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "@/features/ai/providers/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";

type BuildNoteChatProviderMessagesParams = {
  /** 현재 질문을 제외하고 대화 순서대로 정렬된 이전 메시지입니다. */
  historyMessages: AiProviderChatMessage[];

  /** 실행에 사용할 Prompt Version의 System Template입니다. */
  systemTemplate: string;

  /** 실행에 사용할 Prompt Version의 User Template입니다. */
  userTemplate: string;

  /** 현재 사용자가 입력한 질문입니다. */
  question: string;
};

/**
 * 노트 챗봇 실행에 사용할 최종 Provider 메시지 목록을 생성합니다.
 *
 * 메시지는 다음 순서로 구성합니다.
 *
 * 1. 렌더링된 System Prompt
 * 2. 이전 사용자·AI 대화 이력
 * 3. 렌더링된 현재 User Prompt
 *
 * 현재 질문은 `historyMessages`에 포함하지 않고 `question`으로 따로 전달해야
 * 같은 질문이 Provider 요청에 중복해서 포함되지 않습니다.
 *
 * @param params Prompt Template과 이전 대화 이력, 현재 질문
 * @returns AI Provider에 전달할 최종 메시지 목록
 */
export function buildNoteChatProviderMessages(
  params: BuildNoteChatProviderMessagesParams,
): AiProviderChatMessage[] {
  /*
   * 현재 단계에서는 Prompt Template에 `question`만 전달합니다.
   * 이후 노트 Context가 추가되면 Note Chat 전용 변수도 이 위치에 확장합니다.
   */
  const templateVariables = {
    question: params.question,
  };

  const systemPrompt = renderPromptTemplate(
    params.systemTemplate,
    templateVariables,
  );

  const userPrompt = renderPromptTemplate(
    params.userTemplate,
    templateVariables,
  );

  return [
    {
      role: AI_PROVIDER_CHAT_MESSAGE_ROLE.SYSTEM,
      content: systemPrompt,
    },
    ...params.historyMessages,
    {
      role: AI_PROVIDER_CHAT_MESSAGE_ROLE.USER,
      content: userPrompt,
    },
  ];
}
