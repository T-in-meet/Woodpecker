import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { AI_MODEL_CAPABILITY } from "@/features/ai/constants/models";
import { getActiveAiModelConfigById } from "@/features/ai/models/queries";
import { getPublishedAiPromptVersionForAgent } from "@/features/ai/prompts/queries";

import type { NoteChatRunSettings } from "../schema";

/**
 * 노트 챗봇 실행에 사용할 확정된 AI 설정입니다.
 *
 * Prompt Version과 Model Config는 실행 시작 시점에 조회·검증되며,
 * 이후 Context 구성과 답변 생성 과정에서는 이 결과를 재사용합니다.
 */
export type NoteChatExecutionSettings = {
  prompt: Awaited<ReturnType<typeof getPublishedAiPromptVersionForAgent>>;
  chatModel: Awaited<ReturnType<typeof getActiveAiModelConfigById>>;
  embeddingModel: Awaited<ReturnType<typeof getActiveAiModelConfigById>>;
};

/**
 * 노트 챗봇 실행에 사용할 Prompt와 Model Config를 확정합니다.
 *
 * 전달된 ID를 기준으로 다음 조건을 검증합니다.
 *
 * - Prompt Version이 Published 상태인지
 * - Prompt Version이 지정한 Agent에 속하는지
 * - Chat Model Config가 활성 상태이며 Chat capability인지
 * - Embedding Model Config가 활성 상태이며 Embedding capability인지
 * - Embedding Model의 dimensions가 현재 노트 임베딩 차원과 일치하는지
 *
 * @param settings 실행 전에 확정된 AI 설정 ID
 * @returns 검증된 Prompt와 Model Config
 */
export async function resolveNoteChatExecutionSettings(
  settings: NoteChatRunSettings,
): Promise<NoteChatExecutionSettings> {
  /*
   * 세 설정은 서로 의존하지 않으므로 병렬로 조회합니다.
   * 하나라도 유효하지 않으면 Promise.all이 해당 오류를 호출자에게 전달합니다.
   */
  const [prompt, chatModel, embeddingModel] = await Promise.all([
    getPublishedAiPromptVersionForAgent({
      agentId: settings.agentId,
      promptVersionId: settings.promptVersionId,
    }),
    getActiveAiModelConfigById({
      expectedCapability: AI_MODEL_CAPABILITY.CHAT,
      modelConfigId: settings.chatModelConfigId,
    }),
    getActiveAiModelConfigById({
      expectedCapability: AI_MODEL_CAPABILITY.EMBEDDING,
      expectedDimensions: AI_EMBEDDING_DIMENSIONS,
      modelConfigId: settings.embeddingModelConfigId,
    }),
  ]);

  return {
    prompt,
    chatModel,
    embeddingModel,
  };
}
