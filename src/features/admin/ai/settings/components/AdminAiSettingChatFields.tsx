import { Controller, useFormContext, useWatch } from "react-hook-form";

import {
  AdminSelectField,
  type AdminSelectFieldOption,
} from "@/features/admin/components/common/AdminSelectField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import {
  useAdminAiPromptFamilyOptions,
  useAdminAiPromptVersionOptions,
} from "../../prompts/hooks/use-admin-ai-prompt-queries";
import type { AdminAiSettingConfigurationFormValues } from "../types";

type AdminAiSettingChatFieldsProps = {
  /** 폼의 AI 구성 배열 위치입니다. */
  index: number;

  /** 선택 가능한 Agent 목록입니다. */
  agentOptions: AdminSelectFieldOption[];

  /** 선택 가능한 Chat Model 목록입니다. */
  chatModelOptions: AdminSelectFieldOption[];
};

/**
 * @description Chat 구성에 필요한 Role Key, Agent, Prompt Family, Prompt Version, 모델 및 Temperature 입력 필드를 렌더링합니다.
 * @param props Chat 구성 입력 필드의 속성입니다.
 * @returns Chat 구성 입력 필드를 반환합니다.
 */
export function AdminAiSettingChatFields({
  agentOptions,
  chatModelOptions,
  index,
}: AdminAiSettingChatFieldsProps) {
  const { control, register, setValue } =
    useFormContext<AdminAiSettingConfigurationFormValues>();

  const agentId = useWatch({
    control,
    name: `configurations.${index}.agentId` as const,
  });

  const promptFamilyId = useWatch({
    control,
    name: `configurations.${index}.promptFamilyId` as const,
  });

  const { data: promptFamilies = [] } = useAdminAiPromptFamilyOptions(agentId);

  const { data: promptVersions = [] } =
    useAdminAiPromptVersionOptions(promptFamilyId);

  const promptFamilyOptions = promptFamilies.map((family) => ({
    label: family.displayName,
    value: family.id,
  }));

  const promptVersionOptions = promptVersions.map((version) => ({
    label: `${version.displayName} · v${version.versionNumber}`,
    value: version.id,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AdminTextField
        label="Role Key"
        placeholder="예: answer-generation"
        {...register(`configurations.${index}.roleKey` as const)}
      />
      <Controller
        control={control}
        name={`configurations.${index}.agentId`}
        render={({ field }) => (
          <AdminSelectField
            label="Agent"
            name={field.name}
            options={agentOptions}
            placeholder="Agent를 선택하세요."
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);

              // Agent가 변경되면 종속된 Prompt 선택값을 초기화합니다.
              setValue(`configurations.${index}.promptFamilyId`, "");
              setValue(`configurations.${index}.promptVersionId`, "");
            }}
          />
        )}
      />

      <Controller
        control={control}
        name={`configurations.${index}.promptFamilyId`}
        render={({ field }) => (
          <AdminSelectField
            disabled={!agentId}
            label="Prompt Family"
            name={field.name}
            options={promptFamilyOptions}
            placeholder={
              agentId
                ? "Prompt Family를 선택하세요."
                : "먼저 Agent를 선택하세요."
            }
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);

              // Family가 변경되면 기존 Version 선택값을 초기화합니다.
              setValue(`configurations.${index}.promptVersionId`, "");
            }}
          />
        )}
      />

      <Controller
        control={control}
        name={`configurations.${index}.promptVersionId` as const}
        render={({ field }) => (
          <AdminSelectField
            disabled={!promptFamilyId}
            label="Prompt Version"
            name={field.name}
            options={promptVersionOptions}
            placeholder={
              promptFamilyId
                ? "Prompt Version을 선택하세요."
                : "먼저 Prompt Family를 선택하세요."
            }
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name={`configurations.${index}.modelConfigId`}
        render={({ field }) => (
          <AdminSelectField
            label="Chat Model"
            name={field.name}
            options={chatModelOptions}
            placeholder="Chat Model을 선택하세요."
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name={`configurations.${index}.temperature` as const}
        render={({ field }) => (
          <AdminTextField
            label="Temperature"
            name={field.name}
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={field.value}
            onChange={(event) => {
              field.onChange(
                event.target.value === "" ? "" : event.target.valueAsNumber,
              );
            }}
          />
        )}
      />
    </div>
  );
}
