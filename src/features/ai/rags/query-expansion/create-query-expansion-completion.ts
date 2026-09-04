import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import type { AiTokenUsage } from "@/features/ai/providers/types";
import type { AiChatCompletionResult } from "@/features/ai/providers/types";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import { type AiObserver, notifyAiObserver } from "@/lib/ai/notify-observer";
import type { Json } from "@/types/db.helpers";

/** Query Expansion 공통 helper가 노출하는 실행 관측 이벤트입니다. */
export type QueryExpansionCompletionObservation =
  | {
      /** Provider 호출에 사용한 실제 렌더링·설정 값입니다. */
      type: "prepared";
      configuration: AiRuntimeChatConfiguration;
      responseFormat: Parameters<
        typeof createAiChatCompletionWithProvider
      >[0]["responseFormat"];
      systemPrompt: string;
      userPrompt: string;
      variables: Record<string, string>;
    }
  | {
      /** Provider 공통 계층이 한 번의 호출에서 반환한 원문과 metadata입니다. */
      type: "completed";
      result: AiChatCompletionResult;
    }
  | {
      /** API key 조회 또는 Provider 호출에서 발생한 원래 오류입니다. */
      type: "failed";
      error: unknown;
    };

type CreateQueryExpansionCompletionParams = {
  /** 질의 확장에 사용할 Chat Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** Query Expansion Prompt Template에 전달할 변수입니다. */
  variables: Record<string, string>;

  /** Provider Response Schema의 이름입니다. */
  responseSchemaName: string;

  /** AI Runs accumulator가 실행값을 기록할 best-effort 관측 callback입니다. */
  onObservation?: AiObserver<QueryExpansionCompletionObservation> | undefined;
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
  const { configuration, onObservation, variables, responseSchemaName } =
    params;
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

  // 렌더링과 Provider 설정을 다시 계산하지 않도록 실제 호출 직전 값을 전달한다.
  await notifyAiObserver(onObservation, {
    configuration,
    responseFormat,
    systemPrompt,
    type: "prepared",
    userPrompt,
    variables,
  });

  let apiKey: string;

  try {
    apiKey = getProviderApiKey(model.provider);
  } catch (error) {
    await notifyAiObserver(onObservation, {
      error,
      type: "failed",
    });

    console.error(
      "[Query Expansion Completion API Key Failed]",
      error instanceof Error ? error.message : error,
    );

    throw error;
  }

  let result: AiChatCompletionResult;

  try {
    result = await createAiChatCompletionWithProvider({
      apiKey,
      model: model.model,
      provider: model.provider,
      responseFormat,
      systemPrompt,
      temperature: configuration.temperature,
      userPrompt,
    });
  } catch (error) {
    await notifyAiObserver(onObservation, {
      error,
      type: "failed",
    });

    console.error(
      "[Query Expansion Completion Failed]",
      error instanceof Error ? error.message : error,
    );

    throw error;
  }

  // content, metadata, usage를 Provider 호출 결과 그대로 한 번만 관측시킨다.
  await notifyAiObserver(onObservation, {
    result,
    type: "completed",
  });

  return {
    content: result.content,
    usage: result.usage,
  };
}
