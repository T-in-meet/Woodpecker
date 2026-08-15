"use client";

import type { UseFormRegister } from "react-hook-form";

import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import type { AdminAiPromptFamilyFormValues } from "./AdminAiPromptFamilyForm.utils";

type AdminAiPromptInitialVersionFieldsProps = {
  /** react-hook-form register 함수 */
  register: UseFormRegister<AdminAiPromptFamilyFormValues>;
};

/**
 * AI Prompt Family 생성 시 함께 등록할 초기 Version 필드를 렌더링합니다.
 *
 * @param props 초기 Version 필드 속성
 * @returns 초기 Prompt Version 입력 필드
 */
export function AdminAiPromptInitialVersionFields({
  register,
}: AdminAiPromptInitialVersionFieldsProps) {
  return (
    <section className="grid content-start gap-5 border-t pt-5 xl:border-t-0 xl:pt-0">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">초기 Draft Version</h2>
        <p className="text-sm text-muted-foreground">
          Prompt Family 생성과 함께 사용할 첫 Draft Version을 등록합니다.
        </p>
      </div>

      <AdminTextField
        label="초기 Version 이름"
        placeholder="초기 Prompt Version 이름"
        required
        {...register("versionDisplayName")}
      />

      <AdminTextField
        label="변경 요약"
        placeholder="초기 Version의 변경 내용을 입력하세요."
        {...register("changeSummary")}
      />

      <AdminTextareaField
        label="System Template"
        placeholder="System Prompt Template을 입력하세요."
        rows={8}
        required
        {...register("systemTemplate")}
      />

      <AdminTextareaField
        label="User Template"
        placeholder="User Prompt Template을 입력하세요."
        rows={8}
        required
        {...register("userTemplate")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextareaField
          label="Variables JSON"
          placeholder="Prompt 변수 정의를 JSON 배열로 입력하세요."
          rows={6}
          {...register("variables")}
        />

        <AdminTextareaField
          label="Response Schema JSON"
          placeholder="응답 Schema를 JSON 객체로 입력하세요."
          rows={6}
          {...register("responseSchema")}
        />
      </div>
    </section>
  );
}
