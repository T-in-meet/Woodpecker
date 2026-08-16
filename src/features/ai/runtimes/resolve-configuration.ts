import "server-only";

import { AI_MODEL_CAPABILITY } from "@/features/ai/constants/models";
import { getActiveAiModelConfigById } from "@/features/ai/models/queries";
import { getPublishedAiPromptVersionForAgent } from "@/features/ai/prompts/queries";

import { getAiRuntimeConfigurationRow } from "./queries";
import type {
  AiRuntimeChatConfiguration,
  AiRuntimeEmbeddingConfiguration,
} from "./types";

type ResolveAiRuntimeConfigurationParams = {
  /** AI 기능을 식별하는 key입니다. */
  featureKey: string;

  /** 기능 내부에서 Configuration 역할을 식별하는 key입니다. */
  roleKey: string;
};

type AiRuntimeConfigurationRow = Awaited<
  ReturnType<typeof getAiRuntimeConfigurationRow>
>;

/**
 * Chat Configuration row를 실제 실행 가능한 Runtime Configuration으로
 * 검증하고 변환합니다.
 *
 * Prompt Version과 Chat Model이 각각 실행 가능한 상태인지 확인하며,
 * Runtime Configuration에 저장된 temperature를 소비 기능에 전달합니다.
 *
 * @param configuration Chat Configuration DB row입니다.
 * @param featureKey AI 기능 key입니다.
 * @param roleKey 기능 내부 Configuration 역할 key입니다.
 * @returns 검증된 Chat Runtime Configuration입니다.
 * @throws Prompt Version 또는 Prompt Family가 연결되어 있지 않은 경우 오류를 발생시킵니다.
 * @throws Prompt Version이 Published 상태가 아니거나 Agent와의 관계가 유효하지 않은 경우 오류를 발생시킵니다.
 * @throws Chat에 사용할 Model Config가 활성 상태가 아니거나 capability가 일치하지 않는 경우 오류를 발생시킵니다.
 */
async function resolveChatRuntimeConfiguration(
  configuration: AiRuntimeConfigurationRow,
  featureKey: string,
  roleKey: string,
): Promise<AiRuntimeChatConfiguration> {
  if (
    configuration.prompt_version_id === null ||
    configuration.temperature === null
  ) {
    throw new Error(
      `Invalid chat AI runtime configuration: ${featureKey}/${roleKey}`,
    );
  }

  const promptVersion = configuration.ai_prompt_versions;

  if (!promptVersion) {
    throw new Error(
      `AI runtime prompt version not found: ${featureKey}/${roleKey}`,
    );
  }

  const promptFamily = promptVersion.ai_prompt_families;

  if (!promptFamily) {
    throw new Error(
      `AI runtime prompt family not found: ${featureKey}/${roleKey}`,
    );
  }

  const [prompt, model] = await Promise.all([
    getPublishedAiPromptVersionForAgent({
      agentId: promptFamily.agent_id,
      promptVersionId: configuration.prompt_version_id,
    }),
    getActiveAiModelConfigById({
      expectedCapability: AI_MODEL_CAPABILITY.CHAT,
      modelConfigId: configuration.model_config_id,
    }),
  ]);

  /*
   * Runtime 계층은 temperature를 설정에서 읽어 소비 기능까지 전달한다.
   * 실제 Provider 호출에 이 값을 적용하는 책임은 Runtime이 아닌
   * 해당 AI 기능의 실행 계층에 있다.
   */
  return {
    kind: "chat",
    featureKey,
    roleKey,
    model,
    prompt,
    temperature: configuration.temperature,
  };
}

/**
 * Embedding Configuration row를 실제 실행 가능한 Runtime Configuration으로
 * 검증하고 변환합니다.
 *
 * Embedding Configuration에는 Prompt Version이나 temperature가 포함되지 않는다는
 * 구조적 제약을 확인하고, 활성 Embedding Model Config를 조회합니다.
 *
 * @param configuration Embedding Configuration DB row입니다.
 * @param featureKey AI 기능 key입니다.
 * @param roleKey 기능 내부 Configuration 역할 key입니다.
 * @returns 검증된 Embedding Runtime Configuration입니다.
 * @throws Embedding Configuration에 Chat 전용 필드가 포함된 경우 오류를 발생시킵니다.
 * @throws Embedding Model Config가 활성 상태가 아니거나 capability가 일치하지 않는 경우 오류를 발생시킵니다.
 */
async function resolveEmbeddingRuntimeConfiguration(
  configuration: AiRuntimeConfigurationRow,
  featureKey: string,
  roleKey: string,
): Promise<AiRuntimeEmbeddingConfiguration> {
  if (
    configuration.prompt_version_id !== null ||
    configuration.temperature !== null
  ) {
    throw new Error(
      `Invalid embedding AI runtime configuration: ${featureKey}/${roleKey}`,
    );
  }

  /*
   * Embedding dimensions는 현재 Runtime 공통 계층에서 임의로 결정하지 않는다.
   * 실제 사용처에서 필요한 dimensions가 있다면 해당 AI 기능의 책임으로 검증한다.
   */
  const model = await getActiveAiModelConfigById({
    expectedCapability: AI_MODEL_CAPABILITY.EMBEDDING,
    modelConfigId: configuration.model_config_id,
  });

  return {
    kind: "embedding",
    featureKey,
    roleKey,
    model,
  };
}

/**
 * Chat Runtime Configuration을 조회하고 실제 실행 가능한 상태인지 검증합니다.
 *
 * 조회된 Configuration의 kind를 먼저 확인한 후 Chat 전용 검증을 수행하여,
 * Embedding Configuration이 Chat 실행 경로로 잘못 전달되는 것을 방지합니다.
 *
 * @param featureKey AI 기능 key입니다.
 * @param roleKey 기능 내부 Configuration 역할 key입니다.
 * @returns 검증된 Chat Runtime Configuration입니다.
 * @throws 지정한 Runtime Configuration을 조회할 수 없는 경우 오류를 발생시킵니다.
 * @throws 조회된 Configuration의 kind가 `chat`이 아닌 경우 오류를 발생시킵니다.
 * @throws Chat Configuration의 Prompt 또는 Model이 실행 조건을 만족하지 않는 경우 오류를 발생시킵니다.
 */
export async function resolveAiRuntimeChatConfiguration({
  featureKey,
  roleKey,
}: ResolveAiRuntimeConfigurationParams): Promise<AiRuntimeChatConfiguration> {
  const configuration = await getAiRuntimeConfigurationRow(featureKey, roleKey);

  /*
   * 세부 resolver에 진입하기 전에 kind를 확인하여
   * Chat과 Embedding의 서로 다른 필드 제약이 섞이지 않도록 한다.
   */
  if (configuration.kind !== "chat") {
    throw new Error(
      `AI runtime configuration kind mismatch: expected chat, received ${configuration.kind}: ${featureKey}/${roleKey}`,
    );
  }

  return resolveChatRuntimeConfiguration(configuration, featureKey, roleKey);
}

/**
 * Embedding Runtime Configuration을 조회하고 실제 실행 가능한 상태인지 검증합니다.
 *
 * 조회된 Configuration의 kind를 먼저 확인한 후 Embedding 전용 검증을 수행하여,
 * Chat Configuration이 Embedding 실행 경로로 잘못 전달되는 것을 방지합니다.
 *
 * @param featureKey AI 기능 key입니다.
 * @param roleKey 기능 내부 Configuration 역할 key입니다.
 * @returns 검증된 Embedding Runtime Configuration입니다.
 * @throws 지정한 Runtime Configuration을 조회할 수 없는 경우 오류를 발생시킵니다.
 * @throws 조회된 Configuration의 kind가 `embedding`이 아닌 경우 오류를 발생시킵니다.
 * @throws Embedding Model이 실행 조건을 만족하지 않는 경우 오류를 발생시킵니다.
 */
export async function resolveAiRuntimeEmbeddingConfiguration({
  featureKey,
  roleKey,
}: ResolveAiRuntimeConfigurationParams): Promise<AiRuntimeEmbeddingConfiguration> {
  const configuration = await getAiRuntimeConfigurationRow(featureKey, roleKey);

  /*
   * 세부 resolver에 진입하기 전에 kind를 확인하여
   * Chat 전용 필드 검증이 Embedding Configuration에 적용되지 않도록 한다.
   */
  if (configuration.kind !== "embedding") {
    throw new Error(
      `AI runtime configuration kind mismatch: expected embedding, received ${configuration.kind}: ${featureKey}/${roleKey}`,
    );
  }

  return resolveEmbeddingRuntimeConfiguration(
    configuration,
    featureKey,
    roleKey,
  );
}
