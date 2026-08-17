"use client";

import { useRouter } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";
import { getAdminAiSettingsRoute } from "@/lib/constants/routes";

import { useCreateAdminAiSetting } from "../hooks/use-admin-ai-setting-mutations";
import type { AdminAiSettingInfoFormValues } from "../types";

/**
 * @description 관리자 AI 설정을 생성하는 폼입니다.
 * @returns 설정 이름, 키, 설명 입력 필드와 저장 버튼을 반환합니다.
 */
export function AdminAiSettingCreateForm() {
  const router = useRouter();
  const { mutate, isPending } = useCreateAdminAiSetting();

  const form = useForm<AdminAiSettingInfoFormValues>({
    defaultValues: {
      setting: {
        displayName: "",
        key: "",
        description: "",
      },
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    mutate(values.setting, {
      onSuccess: (result) => {
        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success("AI 설정을 생성했습니다.");
        router.push(getAdminAiSettingsRoute(result.settingId));
      },
      onError: () => {
        toast.error("AI 설정 생성 중 오류가 발생했습니다.");
      },
    });
  });

  return (
    <FormProvider {...form}>
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
                label="설정 키"
                name={field.name}
                placeholder="예: note-chat"
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

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "생성 중..." : "설정 생성"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
