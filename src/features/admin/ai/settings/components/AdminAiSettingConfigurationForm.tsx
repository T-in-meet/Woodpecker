"use client";

import { useEffect, useMemo, useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";
import {
  AdminDetailError,
  AdminDetailLoading,
} from "@/features/admin/components/common/AdminDetailState";

import { useSaveAdminAiSettingConfigurations } from "../hooks/use-admin-ai-setting-configuration-mutations";
import { useAdminAiSettingConfigurations } from "../hooks/use-admin-ai-setting-configuration-queries";
import type { AdminAiSettingConfigurationFormValues } from "../types";
import { AdminAiSettingConfigurationsSection } from "./AdminAiSettingConfigurationsSection";

type AdminAiSettingConfigurationFormProps = {
  /** AI 설정 ID입니다. */
  settingId: string;
};

/**
 * @description AI 설정에 연결할 Chat 및 Embedding 구성을 관리하는 폼입니다.
 * @returns 관리자 AI 설정 폼을 반환합니다.
 */
export function AdminAiSettingConfigurationForm({
  settingId,
}: AdminAiSettingConfigurationFormProps) {
  const form = useForm<AdminAiSettingConfigurationFormValues>({
    defaultValues: {
      configurations: [],
    },
  });

  const {
    formState: { isDirty },
  } = form;

  const {
    data: configurations,
    isPending,
    error,
    refetch,
  } = useAdminAiSettingConfigurations(settingId);

  const { mutate, isPending: isSaving } = useSaveAdminAiSettingConfigurations();

  const { append, fields, remove } = useFieldArray({
    control: form.control,
    keyName: "fieldArrayId",
    name: "configurations",
  });

  const [pendingValues, setPendingValues] =
    useState<AdminAiSettingConfigurationFormValues | null>(null);

  const originalRoleKeyByConfigurationId = useMemo(() => {
    const roleKeyByConfigurationId = new Map<string, string>();

    for (const configuration of configurations ?? []) {
      if (configuration.id) {
        roleKeyByConfigurationId.set(configuration.id, configuration.roleKey);
      }
    }

    return roleKeyByConfigurationId;
  }, [configurations]);

  useEffect(() => {
    if (!configurations) {
      return;
    }

    form.reset({
      configurations,
    });
  }, [configurations, form]);

  /**
   * Chat 구성을 폼에 추가합니다.
   */
  function appendChatConfiguration() {
    append({
      kind: "chat",
      roleKey: "",
      agentId: "",
      promptFamilyId: "",
      promptVersionId: "",
      modelConfigId: "",
      temperature: 0.2,
    });
  }

  /**
   * Embedding 구성을 폼에 추가합니다.
   */
  function appendEmbeddingConfiguration() {
    append({
      kind: "embedding",
      roleKey: "",
      modelConfigId: "",
    });
  }

  /**
   * 기존에 저장된 구성의 Role Key가 변경되었는지 확인합니다.
   *
   * 새로 추가된 구성은 비교 대상에서 제외합니다.
   *
   * @param values 현재 제출하려는 폼 값
   * @returns 기존 Role Key가 변경되었으면 true
   */
  function hasRoleKeyChanges(
    values: AdminAiSettingConfigurationFormValues,
  ): boolean {
    if (originalRoleKeyByConfigurationId.size === 0) {
      return false;
    }

    return values.configurations.some((configuration) => {
      if (!configuration.id) {
        return false;
      }

      const originalRoleKey = originalRoleKeyByConfigurationId.get(
        configuration.id,
      );

      if (originalRoleKey === undefined) {
        return false;
      }

      return originalRoleKey !== configuration.roleKey;
    });
  }

  /**
   * 현재 AI 구성 값을 서버에 저장합니다.
   *
   * @param values 저장할 AI 구성 폼 값
   */
  function saveConfigurations(values: AdminAiSettingConfigurationFormValues) {
    mutate(
      {
        settingId,
        configurations: values.configurations.map((configuration) => {
          if (configuration.kind === "embedding") {
            return {
              kind: "embedding",
              roleKey: configuration.roleKey,
              modelConfigId: configuration.modelConfigId,
            };
          }

          return {
            kind: "chat",
            roleKey: configuration.roleKey,
            promptVersionId: configuration.promptVersionId,
            modelConfigId: configuration.modelConfigId,
            temperature: configuration.temperature,
          };
        }),
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            toast.error(result.message);
            return;
          }

          /*
           * 저장된 현재 값을 새로운 기준값으로 설정하여
           * 이후 변경 여부를 올바르게 추적합니다.
           */
          form.reset(form.getValues());

          setPendingValues(null);

          toast.success("AI 구성을 저장했습니다.");
        },
        onError: () => {
          toast.error("AI 구성 저장 중 오류가 발생했습니다.");
        },
      },
    );
  }

  const handleSubmit = form.handleSubmit((values) => {
    /*
     * 기존 Role Key가 변경된 경우에는 바로 저장하지 않고
     * 사용자에게 런타임 참조가 깨질 수 있음을 경고합니다.
     */
    if (hasRoleKeyChanges(values)) {
      setPendingValues(values);
      return;
    }

    saveConfigurations(values);
  });

  /**
   * Role Key 변경 경고를 확인하고 저장합니다.
   */
  function handleConfirmRoleKeyChange() {
    if (!pendingValues) {
      return;
    }

    saveConfigurations(pendingValues);
  }

  /**
   * Role Key 변경 경고 다이얼로그 닫힘을 처리합니다.
   *
   * 다이얼로그는 `pendingValues` 존재 여부로 열림 상태가 결정되므로,
   * 닫기 동작에서는 보류 중인 제출 값만 정리합니다.
   *
   * @param open 다이얼로그의 다음 열림 상태입니다.
   */
  function handleRoleKeyWarningOpenChange(open: boolean) {
    if (open) {
      return;
    }

    setPendingValues(null);
  }

  if (isPending) {
    return <AdminDetailLoading />;
  }

  if (error) {
    return (
      <AdminDetailError
        title="AI 구성을 불러오지 못했습니다."
        action={
          <Button type="button" variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      />
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <AdminAiSettingConfigurationsSection
          fields={fields}
          onAddChat={appendChatConfiguration}
          onAddEmbedding={appendEmbeddingConfiguration}
          onRemove={remove}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSaving}>
            {isSaving ? "저장 중..." : isDirty ? "저장" : "변경 사항 없음"}
          </Button>
        </div>

        <AdminAlertDialog
          trigger={<span className="hidden" aria-hidden />}
          open={pendingValues !== null}
          onOpenChange={handleRoleKeyWarningOpenChange}
          title="Role Key를 변경하시겠습니까?"
          description={
            <p>
              Role Key를 변경하면 이 값을 사용하는 AI 기능에서 해당 구성을 찾지
              못할 수 있습니다. 관련 기능의 Role Key 참조도 함께 변경되었는지
              확인해주세요.
            </p>
          }
          confirmLabel="변경 후 저장"
          cancelLabel="취소"
          pending={isSaving}
          onConfirm={handleConfirmRoleKeyChange}
        />
      </form>
    </FormProvider>
  );
}
