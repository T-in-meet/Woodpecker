"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";

import { AdminSelectField } from "@/features/admin/components/common/AdminSelectField";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import type { AdminAiPromptFamilyFormValues } from "./AdminAiPromptFamilyForm.utils";

type AdminAiPromptAgentOption = {
  /** Agent 표시 이름 */
  displayName: string;

  /** Agent ID */
  id: string;
};

type AdminAiPromptFamilyBasicFieldsProps = {
  /** 생성 모드 여부 */
  createMode: boolean;

  /** Agent 선택 목록 */
  agentOptions: AdminAiPromptAgentOption[];

  /** Agent 선택 목록 조회 진행 여부 */
  isAgentOptionsPending: boolean;

  /** react-hook-form control 객체 */
  control: Control<AdminAiPromptFamilyFormValues>;

  /** react-hook-form register 함수 */
  register: UseFormRegister<AdminAiPromptFamilyFormValues>;
};

/**
 * AI Prompt Family의 Agent와 기본 정보 입력 필드를 렌더링합니다.
 *
 * 생성 화면에서는 Family에 연결할 Agent를 선택합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Family 기본 정보 필드
 */
export function AdminAiPromptFamilyBasicFields({
  createMode,
  agentOptions,
  isAgentOptionsPending,
  control,
  register,
}: AdminAiPromptFamilyBasicFieldsProps) {
  return (
    <>
      {createMode ? (
        <Controller
          control={control}
          name="agentId"
          render={({ field }) => (
            <AdminSelectField
              label="Agent"
              name={field.name}
              value={field.value}
              placeholder={
                isAgentOptionsPending
                  ? "Agent 목록을 불러오는 중입니다."
                  : "Agent를 선택하세요."
              }
              disabled={isAgentOptionsPending}
              onValueChange={field.onChange}
              options={agentOptions.map((agent) => ({
                label: agent.displayName,
                value: agent.id,
              }))}
            />
          )}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Agent</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          placeholder="관리자 화면에 표시할 Prompt Family 이름"
          required
          {...register("displayName")}
        />
      </div>

      <AdminTextareaField
        label="설명"
        placeholder="Prompt Family의 목적과 사용 방식을 입력하세요."
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
