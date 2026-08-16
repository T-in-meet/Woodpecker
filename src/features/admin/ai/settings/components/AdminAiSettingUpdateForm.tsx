"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import { useUpdateAdminAiSetting } from "../hooks/use-admin-ai-setting-mutations";
import type { AdminAiSetting, AdminAiSettingInfoFormValues } from "../types";

type AdminAiSettingUpdateFormProps = {
  /** 수정할 AI 설정 정보입니다. */
  setting: AdminAiSetting;

  /** 수정 취소 시 호출하는 함수입니다. */
  onCancel: () => void;

  /** 수정 성공 시 호출하는 함수입니다. */
  onSuccess: () => void;
};

/**
 * @description 기존 AI 설정의 이름과 설명을 수정하는 폼입니다.
 * @param props AI 설정 수정 폼의 속성입니다.
 * @returns AI 설정 수정 입력 필드와 취소 및 저장 버튼을 반환합니다.
 */
export function AdminAiSettingUpdateForm({
  onCancel,
  onSuccess,
  setting,
}: AdminAiSettingUpdateFormProps) {
  const form = useForm<AdminAiSettingInfoFormValues>({
    defaultValues: {
      setting: {
        description: setting.description,
        displayName: setting.displayName,
        key: setting.key,
      },
    },
  });

  const { mutate, isPending } = useUpdateAdminAiSetting();

  const handleSubmit = form.handleSubmit((values) => {
    mutate(
      {
        settingId: setting.id,
        displayName: values.setting.displayName,
        description: values.setting.description,
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            toast.error(result.message);
            return;
          }

          toast.success("AI 설정을 수정했습니다.");
          onSuccess();
        },
        onError: () => {
          toast.error("AI 설정 수정 중 오류가 발생했습니다.");
        },
      },
    );
  });

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">설정 정보 수정</h2>
        <p className="text-muted-foreground text-sm">
          AI 설정의 이름과 설명을 수정합니다. 설정 키는 생성 후 변경할 수
          없습니다.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="setting.displayName"
            render={({ field }) => (
              <AdminTextField
                label="설정 이름"
                name={field.name}
                placeholder="설정 이름을 입력하세요."
                value={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            control={form.control}
            name="setting.key"
            render={({ field }) => (
              <AdminTextField
                readOnly
                label="설정 키"
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="setting.description"
          render={({ field }) => (
            <AdminTextareaField
              label="설명"
              name={field.name}
              placeholder="설정의 목적과 사용처를 입력하세요."
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onCancel}
          >
            취소
          </Button>

          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </section>
  );
}
