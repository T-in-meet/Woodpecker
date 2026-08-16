import { Controller, useFormContext } from "react-hook-form";

import {
  AdminSelectField,
  type AdminSelectFieldOption,
} from "@/features/admin/components/common/AdminSelectField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import type { AdminAiSettingConfigurationFormValues } from "../types";

type AdminAiSettingEmbeddingFieldsProps = {
  /** 폼의 AI 구성 배열 위치입니다. */
  index: number;

  /** 선택 가능한 Embedding Model 목록입니다. */
  embeddingModelOptions: AdminSelectFieldOption[];
};

/**
 * @description Embedding 구성에 필요한 모델 입력 필드를 렌더링합니다.
 * @param props Embedding 구성 입력 필드의 속성입니다.
 * @returns Embedding 구성 입력 필드를 반환합니다.
 */
export function AdminAiSettingEmbeddingFields({
  embeddingModelOptions,
  index,
}: AdminAiSettingEmbeddingFieldsProps) {
  const { control, register } =
    useFormContext<AdminAiSettingConfigurationFormValues>();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AdminTextField
        label="Role Key"
        placeholder="예: note-retrieval"
        {...register(`configurations.${index}.roleKey` as const)}
      />
      <Controller
        control={control}
        name={`configurations.${index}.modelConfigId` as const}
        render={({ field }) => (
          <AdminSelectField
            label="Embedding Model"
            name={field.name}
            options={embeddingModelOptions}
            placeholder="Embedding Model을 선택하세요."
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
    </div>
  );
}
