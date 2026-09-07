import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import type { AiTokenUsage } from "@/features/ai/providers/types";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import type { Json } from "@/types/db.helpers";

type CreateQueryExpansionCompletionParams = {
  /** 질의 확장에 사용할 Chat Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** Query Expansion Prompt Template에 전달할 변수입니다. */
  variables: Record<string, string>;

  /** Provider Response Schema의 이름입니다. */
  responseSchemaName: string;
};

export type QueryExpansionCompletionResult = {
  /** Provider가 반환한 원본 응답 내용입니다. */
  content: string;

  /** 질의 확장 Chat Completion에서 사용한 token 사용량입니다. */
  usage: AiTokenUsage;
};

/**
 * Query Expansion Prompt를 렌더링하고 Provider Chat Completion을 실행합니다.
 *
 * Note Chat의 대화 구조나 Related Note의 입력 구조를 알지 않으며,
 * 호출자가 전달한 Prompt 변수와 Runtime Configuration만 사용합니다.
 *
 * Provider 응답의 구체적인 JSON 구조와 의미는 호출자가 검증합니다.
 *
 * @param params Query Expansion Runtime Configuration, Prompt 변수 및 Response Schema 정보
 * @returns Provider가 반환한 질의 확장 결과와 token 사용량
 */
export async function createQueryExpansionCompletion(
  params: CreateQueryExpansionCompletionParams,
): Promise<QueryExpansionCompletionResult> {
  const { configuration, variables, responseSchemaName } = params;
  const { model, prompt } = configuration;
  const responseSchema = prompt.version.response_schema;

  const systemPrompt = renderPromptTemplate(
    prompt.version.system_template,
    variables,
  );

  const userPrompt = renderPromptTemplate(
    prompt.version.user_template,
    variables,
  );

  const responseFormat =
    responseSchema == null
      ? undefined
      : {
          type: "json_schema" as const,
          jsonSchema: {
            name: responseSchemaName,
            schema: responseSchema as Json,
            strict: true,
          },
        };

  let apiKey: string;

  try {
    apiKey = getProviderApiKey(model.provider);
  } catch (error) {
    await reportAiOperationalError({
      context: {
        model: model.model,
        modelConfigId: model.id,
        provider: model.provider,
      },
      error,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROVIDER_API_KEY_MISSING,
      message: "AI Provider API key 설정이 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_CHAT_COMPLETION,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    throw error;
  }

  const result = await createAiChatCompletionWithProvider({
    apiKey,
    model: model.model,
    provider: model.provider,
    responseFormat,
    systemPrompt,
    temperature: configuration.temperature,
    userPrompt,
  });

  return {
    content: result.content,
    usage: result.usage,
  };
}
