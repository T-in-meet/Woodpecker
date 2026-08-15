"use client";

import type { UseFormRegister } from "react-hook-form";

import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import type { AdminAiAgentFormValues } from "./AdminAiAgentForm.utils";

type AdminAiAgentBasicFieldsProps = {
  /** react-hook-form register 함수 */
  register: UseFormRegister<AdminAiAgentFormValues>;
};

/**
 * AI Agent의 기본 정보 입력 필드를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Agent 기본 정보 필드
 */
export function AdminAiAgentBasicFields({
  register,
}: AdminAiAgentBasicFieldsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          placeholder="관리자 화면에 표시할 Agent 이름"
          required
          {...register("displayName")}
        />

        <AdminTextField
          label="목적"
          placeholder="Agent가 수행하는 역할"
          required
          {...register("purpose")}
        />
      </div>

      <AdminTextareaField
        label="설명"
        placeholder="Agent에 대한 상세 설명을 입력하세요."
        rows={3}
        {...register("description")}
      />

      <AdminTextField
        label="Tags"
        placeholder="쉼표로 구분하여 입력하세요."
        {...register("tags")}
      />
    </>
  );
}
