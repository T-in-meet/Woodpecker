import type { getActiveAiModelConfigById } from "@/features/ai/models/queries";
import type { getPublishedAiPromptVersionForAgent } from "@/features/ai/prompts/queries";

/**
 * AI Runtime Configuration의 공통 식별 정보입니다.
 *
 * 모든 Runtime Configuration은 AI 기능 key와 기능 내부의 role key를 통해
 * 어떤 실행 설정을 사용하는지 식별합니다.
 */
type AiRuntimeConfigurationBase = {
  /** AI 기능을 식별하는 key입니다. */
  featureKey: string;

  /** 기능 내부에서 Configuration 역할을 식별하는 key입니다. */
  roleKey: string;
};

/**
 * Chat 실행에 필요한 Runtime Configuration입니다.
 *
 * 실행에 사용할 Published Prompt, 활성 Chat Model 및 temperature를 포함합니다.
 */
export type AiRuntimeChatConfiguration = AiRuntimeConfigurationBase & {
  /** Runtime Configuration의 실행 종류입니다. */
  kind: "chat";

  /** 실행에 사용할 Published Prompt 정보입니다. */
  prompt: Awaited<ReturnType<typeof getPublishedAiPromptVersionForAgent>>;

  /** 실행에 사용할 활성 Chat Model 설정입니다. */
  model: Awaited<ReturnType<typeof getActiveAiModelConfigById>>;

  /** Provider Chat 요청에 사용할 temperature 값입니다. */
  temperature: number;
};

/**
 * Embedding 실행에 필요한 Runtime Configuration입니다.
 *
 * Embedding 실행에 사용할 활성 Embedding Model 설정을 포함합니다.
 */
export type AiRuntimeEmbeddingConfiguration = AiRuntimeConfigurationBase & {
  /** Runtime Configuration의 실행 종류입니다. */
  kind: "embedding";

  /** 실행에 사용할 활성 Embedding Model 설정입니다. */
  model: Awaited<ReturnType<typeof getActiveAiModelConfigById>>;
};

/**
 * AI 실행에 사용할 수 있는 Runtime Configuration의 유니온 타입입니다.
 *
 * `kind`를 discriminator로 사용하여 Chat과 Embedding Configuration을
 * 타입 안전하게 구분할 수 있습니다.
 */
export type AiRuntimeConfiguration =
  | AiRuntimeChatConfiguration
  | AiRuntimeEmbeddingConfiguration;
