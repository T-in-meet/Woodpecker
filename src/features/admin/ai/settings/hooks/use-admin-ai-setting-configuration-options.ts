import { useAdminAiAgentOptions } from "../../agents/hooks/use-admin-ai-agent-queries";
import { useAdminAiModelOptions } from "../../models/hooks/use-admin-ai-model-queries";

/** 셀렉트 등에서 공통으로 사용하는 옵션 형태입니다. */
export type AdminAiSettingConfigurationOption = {
  /** 화면에 표시할 라벨입니다. */
  label: string;

  /** 실제 값으로 사용되는 ID입니다. */
  value: string;
};

/**
 * AI 구성 폼에서 사용하는 Agent, Chat 모델, Embedding 모델 옵션 목록을
 * 조회하고 셀렉트에서 사용할 수 있는 형태로 변환합니다.
 *
 * @returns Agent 옵션, Chat 모델 옵션, Embedding 모델 옵션 목록입니다.
 */
export function useAdminAiSettingConfigurationOptions() {
  const { data: agents = [] } = useAdminAiAgentOptions();
  const { data: chatModels = [] } = useAdminAiModelOptions("chat");
  const { data: embeddingModels = [] } = useAdminAiModelOptions("embedding");

  const agentOptions: AdminAiSettingConfigurationOption[] = agents.map(
    (agent) => ({
      label: agent.displayName,
      value: agent.id,
    }),
  );

  const chatModelOptions: AdminAiSettingConfigurationOption[] = chatModels.map(
    (model) => ({
      label: model.displayName,
      value: model.id,
    }),
  );

  const embeddingModelOptions: AdminAiSettingConfigurationOption[] =
    embeddingModels.map((model) => ({
      label: model.displayName,
      value: model.id,
    }));

  return { agentOptions, chatModelOptions, embeddingModelOptions };
}
