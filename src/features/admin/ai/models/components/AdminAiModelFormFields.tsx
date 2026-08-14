"use client";

import type { Control, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";

import { AdminSelectField } from "@/features/admin/components/common/AdminSelectField";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";
import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";

import type { AdminAiModelFormValues } from "./AdminAiModelForm.utils";

/** 관리자 AI 모델 기본 정보 필드 속성입니다. */
type AdminAiModelBasicFieldsProps = {
  /** react-hook-form control 객체 */
  control: Control<AdminAiModelFormValues>;

  /** 생성 모드 여부 */
  createMode: boolean;

  /** 모델 capability 변경 핸들러 */
  onCapabilityChange: (value: string) => void;

  /** react-hook-form register 함수 */
  register: UseFormRegister<AdminAiModelFormValues>;
};

/** 관리자 AI 모델 embedding 설정 필드 속성입니다. */
type AdminAiModelEmbeddingFieldsProps = {
  /** 현재 모델 capability */
  capability: string;

  /** react-hook-form control 객체 */
  control: Control<AdminAiModelFormValues>;

  /** 생성 모드 여부 */
  createMode: boolean;

  /** react-hook-form register 함수 */
  register: UseFormRegister<AdminAiModelFormValues>;
};

/** 관리자 AI 모델 운영 정보 필드 속성입니다. */
type AdminAiModelOperationalFieldsProps = {
  /** react-hook-form control 객체 */
  control: Control<AdminAiModelFormValues>;

  /** react-hook-form register 함수 */
  register: UseFormRegister<AdminAiModelFormValues>;
};

/**
 * AI 모델 식별 정보와 capability 선택 필드를 렌더링합니다.
 *
 * @param props 기본 정보 필드 속성
 * @returns 관리자 AI 모델 기본 정보 입력 영역
 */
export function AdminAiModelBasicFields({
  control,
  createMode,
  onCapabilityChange,
  register,
}: AdminAiModelBasicFieldsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          control={control}
          name="provider"
          render={({ field }) => (
            <AdminSelectField
              label="Provider"
              name={field.name}
              value={field.value}
              placeholder="Provider를 선택하세요."
              onValueChange={field.onChange}
              disabled={!createMode}
              options={[
                {
                  label: "OpenAI",
                  value: "openai",
                },
                {
                  label: "Google",
                  value: "google",
                },
              ]}
            />
          )}
        />

        <AdminTextField
          label="Model"
          placeholder="예: gpt-4o-mini"
          readOnly={!createMode}
          required
          {...register("model")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          placeholder="관리자 화면에 표시할 모델 이름"
          required
          {...register("displayName")}
        />

        <Controller
          control={control}
          name="capability"
          render={({ field }) => (
            <AdminSelectField
              label="모델 용도"
              name={field.name}
              value={field.value}
              placeholder="모델 용도를 선택하세요."
              onValueChange={onCapabilityChange}
              disabled={!createMode}
              options={[
                {
                  label: "Chat",
                  value: "chat",
                },
                {
                  label: "Embedding",
                  value: "embedding",
                },
              ]}
            />
          )}
        />
      </div>
    </>
  );
}

/**
 * Embedding 모델 전용 설정 필드를 렌더링합니다.
 *
 * @param props Embedding 설정 필드 속성
 * @returns Embedding 설정 입력 영역
 */
export function AdminAiModelEmbeddingFields({
  capability,
  control,
  createMode,
  register,
}: AdminAiModelEmbeddingFieldsProps) {
  return (
    <div
      className={
        capability === "embedding"
          ? "grid grid-rows-[1fr] opacity-100 transition-all duration-200"
          : "-my-1 grid grid-rows-[0fr] opacity-0 transition-all duration-200"
      }
    >
      <div className="overflow-hidden">
        <div className="grid gap-4 md:grid-cols-2">
          <AdminTextField
            label="Dimensions"
            type="number"
            min="1"
            placeholder={String(AI_EMBEDDING_DIMENSIONS)}
            readOnly
            disabled={createMode && capability !== "embedding"}
            required={capability === "embedding"}
            {...register("dimensions")}
          />

          <Controller
            control={control}
            name="distanceMetric"
            render={({ field }) => (
              <AdminSelectField
                label="Distance Metric"
                name={field.name}
                value={field.value}
                placeholder="거리 측정 방식을 선택하세요."
                disabled={!createMode || capability !== "embedding"}
                onValueChange={field.onChange}
                options={[
                  {
                    label: "Cosine",
                    value: "cosine",
                  },
                  {
                    label: "Euclidean",
                    value: "l2",
                  },
                  {
                    label: "Inner Product",
                    value: "inner_product",
                  },
                ]}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * AI 모델 활성 상태와 운영 메모 필드를 렌더링합니다.
 *
 * @param props 운영 정보 필드 속성
 * @returns 관리자 AI 모델 운영 정보 입력 영역
 */
export function AdminAiModelOperationalFields({
  control,
  register,
}: AdminAiModelOperationalFieldsProps) {
  return (
    <>
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <AdminSelectField
            label="활성 상태"
            name={field.name}
            value={field.value}
            placeholder="활성 상태를 선택하세요."
            onValueChange={field.onChange}
            options={[
              {
                label: "active",
                value: "true",
              },
              {
                label: "inactive",
                value: "false",
              },
            ]}
          />
        )}
      />

      <AdminTextareaField
        label="Notes"
        placeholder="모델 설정에 대한 운영 메모를 입력하세요."
        rows={4}
        {...register("notes")}
      />
    </>
  );
}
