"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AI_EMBEDDING_DIMENSIONS } from "@/features/ai/constants/embeddings";
import { ROUTES } from "@/lib/constants/routes";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "../../constants/errors";
import {
  useCreateAdminAiModel,
  useDeleteAdminAiModel,
  useUpdateAdminAiModel,
} from "../hooks/use-admin-ai-model-mutations";
import type { AdminAiModelRow } from "../types";
import { AdminAiModelDeleteAction } from "./AdminAiModelDeleteAction";
import {
  type AdminAiModelFormValues,
  buildAiModelFormData,
  getDeleteBlockedReasons,
  getInitialDimensions,
  isCreateMode,
} from "./AdminAiModelForm.utils";
import {
  AdminAiModelBasicFields,
  AdminAiModelEmbeddingFields,
  AdminAiModelOperationalFields,
} from "./AdminAiModelFormFields";

type AdminAiModelFormProps = {
  /** 수정할 모델입니다. 없으면 생성 모드입니다. */
  model?: AdminAiModelRow;
};

/**
 * AI 모델 생성 및 수정 폼을 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns AI 모델 폼
 */
export function AdminAiModelForm({ model }: AdminAiModelFormProps) {
  const router = useRouter();
  const createMutation = useCreateAdminAiModel();
  const updateMutation = useUpdateAdminAiModel();
  const deleteMutation = useDeleteAdminAiModel();
  const createMode = isCreateMode(model);

  const [message, setMessage] = useState<string | null>(null);
  const {
    control,
    formState: { isDirty },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<AdminAiModelFormValues>({
    defaultValues: {
      provider: model?.provider ?? "",
      model: model?.model ?? "",
      displayName: model?.displayName ?? "",
      capability: model?.capability ?? "chat",
      dimensions: getInitialDimensions(model),
      distanceMetric:
        model?.distanceMetric ??
        (model?.capability === "embedding" ? "cosine" : ""),
      isActive: String(model?.isActive ?? true),
      notes: model?.notes ?? "",
    },
  });
  const capability = watch("capability");
  const savePending = createMutation.isPending || updateMutation.isPending;

  /**
   * 모델 저장을 처리합니다.
   *
   * 생성과 수정의 성공 결과를 사용자에게 알리고,
   * 예상하지 못한 요청 실패는 공통 오류 toast로 표시합니다.
   *
   * @param values RHF에서 관리하는 폼 값
   */
  async function handleSave(values: AdminAiModelFormValues) {
    setMessage(null);

    try {
      const formData = buildAiModelFormData(values, model);

      const result = createMode
        ? await createMutation.mutateAsync(formData)
        : await updateMutation.mutateAsync(formData);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      if (createMode && result.id) {
        toast.success("AI 모델을 생성했습니다.");
        router.push(`${ROUTES.ADMIN.AI.MODELS}/${result.id}`);
        return;
      }

      toast.success("AI 모델을 수정했습니다.");

      reset(values);
      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  /**
   * 모델 삭제를 처리합니다.
   *
   * 삭제 성공 시 목록으로 이동하고,
   * 예상하지 못한 요청 실패는 공통 오류 toast로 표시합니다.
   */
  async function handleDelete() {
    if (!model) {
      return;
    }

    setMessage(null);

    try {
      const result = await deleteMutation.mutateAsync(model.id);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      toast.success("AI 모델을 삭제했습니다.");
      router.push(ROUTES.ADMIN.AI.MODELS);
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  const deleteBlockedReasons = getDeleteBlockedReasons(model);
  const canDelete = deleteBlockedReasons.length === 0;

  /**
   * 모델 Capability 변경에 따라 Embedding 전용 설정을 초기화합니다.
   *
   * @param value 변경할 모델 Capability
   */
  function handleCapabilityChange(value: string) {
    /*
     * 현재 embedding은 DB vector 계약상 단일 dimensions만 지원한다.
     * capability 전환 시 embedding 전용 값을 폼 상태에서 함께 정규화해
     * submit FormData와 화면 표시가 항상 같은 값을 바라보게 한다.
     */
    setValue("capability", value, { shouldDirty: true });
    setValue(
      "dimensions",
      value === "embedding" ? String(AI_EMBEDDING_DIMENSIONS) : "",
      { shouldDirty: true },
    );
    setValue("distanceMetric", value === "embedding" ? "cosine" : "", {
      shouldDirty: true,
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(handleSave)}>
      <AdminAiModelBasicFields
        control={control}
        createMode={createMode}
        register={register}
        onCapabilityChange={handleCapabilityChange}
      />

      <AdminAiModelEmbeddingFields
        capability={capability}
        control={control}
        createMode={createMode}
        register={register}
      />

      <AdminAiModelOperationalFields control={control} register={register} />

      {!createMode ? (
        <p className="text-sm text-muted-foreground">
          Embedding 참조 수: {model.embeddingReferenceCount}
        </p>
      ) : null}

      <AdminActionMessage message={message} />

      <div className="flex items-center justify-end gap-3">
        {!createMode ? (
          <AdminAiModelDeleteAction
            canDelete={canDelete}
            deleteBlockedReasons={deleteBlockedReasons}
            pending={deleteMutation.isPending}
            onConfirm={handleDelete}
          />
        ) : null}

        <Button type="submit" disabled={savePending || !isDirty}>
          {createMode ? "저장" : "수정"}
        </Button>
      </div>
    </form>
  );
}
