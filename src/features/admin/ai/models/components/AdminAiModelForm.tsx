"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";
import { AdminSelectField } from "@/features/admin/components/common/AdminSelectField";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";
import { ROUTES } from "@/lib/constants/routes";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "../../constants/errors";
import {
  useCreateAdminAiModel,
  useDeleteAdminAiModel,
  useUpdateAdminAiModel,
} from "../hooks/use-admin-ai-model-mutations";
import type { AdminAiModelRow } from "../types";

type AdminAiModelFormProps = {
  /** 수정할 모델입니다. 없으면 생성 모드입니다. */
  model?: AdminAiModelRow;
};

/**
 * 생성 모드 여부를 판별합니다.
 *
 * @param model 모델 상세
 * @returns 생성 모드면 true
 */
function isCreateMode(model: AdminAiModelRow | undefined) {
  return model === undefined;
}

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

  const [provider, setProvider] = useState<string>(model?.provider ?? "");
  const [physicalModel, setPhysicalModel] = useState(model?.model ?? "");
  const [capability, setCapability] = useState<string>(
    model?.capability ?? "chat",
  );
  const [distanceMetric, setDistanceMetric] = useState(
    model?.distanceMetric ??
      (model?.capability === "embedding" ? "cosine" : ""),
  );
  const [isActive, setIsActive] = useState(String(model?.isActive ?? true));
  const [message, setMessage] = useState<string | null>(null);

  /**
   * 모델 저장을 처리합니다.
   *
   * 생성과 수정의 성공 결과를 사용자에게 알리고,
   * 예상하지 못한 요청 실패는 공통 오류 toast로 표시합니다.
   *
   * @param event 폼 제출 이벤트
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const formData = new FormData(event.currentTarget);

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

  const deleteBlockedReasons = model
    ? [
        model.isActive ? "활성 상태인 모델은 삭제할 수 없습니다." : null,
        model.embeddingReferenceCount > 0
          ? `Embedding에서 ${model.embeddingReferenceCount}건 참조 중입니다.`
          : null,
      ].filter((reason): reason is string => reason !== null)
    : [];

  const canDelete = deleteBlockedReasons.length === 0;

  /**
   * 모델 Capability 변경에 따라 Embedding 전용 설정을 초기화합니다.
   *
   * @param value 변경할 모델 Capability
   */
  function handleCapabilityChange(value: string) {
    setCapability(value);

    // Chat 모델에는 Embedding 전용 거리 측정 설정을 유지하지 않는다.
    setDistanceMetric(value === "embedding" ? "cosine" : "");
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {!createMode ? (
        <input type="hidden" name="modelConfigId" value={model.id} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminSelectField
          label="Provider"
          name="provider"
          value={provider}
          placeholder="Provider를 선택하세요."
          onValueChange={setProvider}
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

        <AdminTextField
          label="Model"
          name="model"
          value={physicalModel}
          placeholder="예: gpt-4o-mini"
          onChange={(event) => setPhysicalModel(event.target.value)}
          readOnly={!createMode}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          name="displayName"
          defaultValue={model?.displayName ?? ""}
          placeholder="관리자 화면에 표시할 모델 이름"
          required
        />

        <AdminSelectField
          label="모델 용도"
          name="capability"
          value={capability}
          placeholder="모델 용도를 선택하세요."
          onValueChange={handleCapabilityChange}
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
      </div>

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
              name="dimensions"
              type="number"
              min="1"
              defaultValue={model?.dimensions ?? ""}
              placeholder="예: 1536"
              readOnly={!createMode}
              disabled={createMode && capability !== "embedding"}
              required={capability === "embedding"}
            />

            <AdminSelectField
              label="Distance Metric"
              name="distanceMetric"
              value={distanceMetric}
              placeholder="거리 측정 방식을 선택하세요."
              disabled={!createMode || capability !== "embedding"}
              onValueChange={setDistanceMetric}
              options={[
                {
                  label: "Cosine",
                  value: "cosine",
                },
                {
                  label: "Euclidean",
                  value: "12",
                },
                {
                  label: "Inner Product",
                  value: "inner_product",
                },
              ]}
            />
          </div>
        </div>
      </div>

      <AdminSelectField
        label="활성 상태"
        name="isActive"
        value={isActive}
        placeholder="활성 상태를 선택하세요."
        onValueChange={setIsActive}
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

      <AdminTextareaField
        label="Notes"
        name="notes"
        defaultValue={model?.notes ?? ""}
        placeholder="모델 설정에 대한 운영 메모를 입력하세요."
        rows={4}
      />

      {!createMode ? (
        <p className="text-sm text-muted-foreground">
          Embedding 참조 수: {model.embeddingReferenceCount}
        </p>
      ) : null}

      <AdminActionMessage message={message} />

      <div className="flex items-center justify-end gap-3">
        {!createMode ? (
          <div className="mr-auto">
            <AdminAlertDialog
              trigger={
                <Button type="button" variant="destructive">
                  삭제
                </Button>
              }
              title={
                canDelete
                  ? "AI 모델을 삭제할까요?"
                  : "AI 모델을 삭제할 수 없습니다."
              }
              description={
                canDelete ? (
                  "삭제한 모델은 복구할 수 없습니다."
                ) : (
                  <ul className="space-y-1 text-left">
                    {deleteBlockedReasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                )
              }
              confirmLabel={canDelete ? "삭제" : "확인"}
              confirmVariant={canDelete ? "destructive" : "default"}
              cancelLabel={canDelete ? "취소" : "닫기"}
              pending={deleteMutation.isPending}
              onConfirm={canDelete ? handleDelete : () => undefined}
            />
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMode ? "생성" : "저장"}
        </Button>
      </div>
    </form>
  );
}
