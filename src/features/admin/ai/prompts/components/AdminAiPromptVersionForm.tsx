"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";
import { getAdminAiPromptVersionRoute } from "@/lib/constants/routes";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import type { AdminAiPromptVersionRow } from "../../types";
import {
  useCreateAdminAiPromptVersion,
  useUpdateAdminAiPromptVersion,
} from "../hooks/use-admin-ai-prompt-version-mutations";
import type { AdminAiPromptFamilyDetail } from "../types";
import { getAdminAiPromptVersionEditPolicy } from "../utils/version-actions";
import {
  type AdminAiPromptVersionFormValues,
  buildAiPromptVersionFormData,
  isCreateMode,
  stringifyJson,
} from "./AdminAiPromptVersionForm.utils";

type AdminAiPromptVersionFormProps = {
  /** Version이 속한 Prompt Family입니다. */
  family: AdminAiPromptFamilyDetail;

  /** 수정할 Version입니다. 없으면 생성 모드입니다. */
  version?: AdminAiPromptVersionRow;

  /** Version 삭제 이벤트입니다. */
  onDelete?: (versionId: string) => void;

  /** Version 삭제 요청 진행 여부입니다. */
  deletePending?: boolean;
};

/**
 * AI Prompt Version 생성 및 수정 폼을 렌더링합니다.
 *
 * Draft Version은 모든 필드를 수정할 수 있습니다.
 * Published Version은 Prompt Template을 제외한 관리 필드를 수정할 수 있습니다.
 * Archived Version은 읽기 전용으로 표시합니다.
 *
 * Version 개별 삭제는 Draft와 Archived 상태에서만 허용합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Version 폼
 */
export function AdminAiPromptVersionForm({
  family,
  version,
  onDelete,
  deletePending = false,
}: AdminAiPromptVersionFormProps) {
  const router = useRouter();
  const createMode = isCreateMode(version);
  const createMutation = useCreateAdminAiPromptVersion();
  const updateMutation = useUpdateAdminAiPromptVersion();
  const sourceVersion = version ?? family.versions[0] ?? null;
  const editPolicy = version
    ? getAdminAiPromptVersionEditPolicy(version.lifecycleStatus)
    : {
        canEditMetadata: true,
        canEditTemplate: true,
      };

  const editable = createMode || editPolicy.canEditMetadata;

  const templateEditable = createMode || editPolicy.canEditTemplate;

  // Published Version은 배포 이력 보호를 위해 개별 삭제를 허용하지 않는다.
  const deletable =
    !createMode &&
    version !== undefined &&
    (version.lifecycleStatus === "draft" ||
      version.lifecycleStatus === "archived");

  const [message, setMessage] = useState<string | null>(null);

  const {
    formState: { isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<AdminAiPromptVersionFormValues>({
    defaultValues: {
      versionDisplayName: sourceVersion?.displayName ?? "draft",
      tags: sourceVersion?.tags.join(", ") ?? "",
      changeSummary: sourceVersion?.changeSummary ?? "",
      systemTemplate: sourceVersion?.systemTemplate ?? "",
      userTemplate: sourceVersion?.userTemplate ?? "",
      variables: sourceVersion ? stringifyJson(sourceVersion.variables) : "[]",
      responseSchema: sourceVersion
        ? stringifyJson(sourceVersion.responseSchema)
        : "{}",
    },
  });

  const savePending = createMutation.isPending || updateMutation.isPending;

  /**
   * Prompt Version 저장을 처리합니다.
   *
   * 생성과 수정의 성공 결과를 toast로 알리고,
   * 예상하지 못한 요청 실패는 공통 오류 메시지로 표시합니다.
   *
   * @param values RHF에서 관리하는 폼 값
   */
  async function handleSave(values: AdminAiPromptVersionFormValues) {
    if (!editable) {
      return;
    }

    setMessage(null);

    try {
      const formData = buildAiPromptVersionFormData(values, family.id, version);

      const result = createMode
        ? await createMutation.mutateAsync(formData)
        : await updateMutation.mutateAsync(formData);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      if (createMode && result.id) {
        toast.success("AI Prompt Version을 생성했습니다.");
        router.push(getAdminAiPromptVersionRoute(family.id, result.id));
        return;
      }

      toast.success("AI Prompt Version을 수정했습니다.");

      reset(values);
      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(handleSave)}>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          placeholder="Prompt Version 이름"
          readOnly={!editable}
          required
          {...register("versionDisplayName")}
        />

        <AdminTextField
          label="Tags"
          placeholder="쉼표로 구분하여 입력하세요."
          readOnly={!editable}
          {...register("tags")}
        />
      </div>

      <AdminTextField
        label="변경 요약"
        placeholder="이 Version의 변경 내용을 입력하세요."
        readOnly={!editable}
        {...register("changeSummary")}
      />

      <AdminTextareaField
        label="System Template"
        placeholder="System Prompt Template을 입력하세요."
        readOnly={!templateEditable}
        rows={12}
        required
        {...register("systemTemplate")}
      />

      <AdminTextareaField
        label="User Template"
        placeholder="User Prompt Template을 입력하세요."
        readOnly={!templateEditable}
        rows={12}
        required
        {...register("userTemplate")}
      />

      {!createMode && version?.lifecycleStatus === "published" ? (
        <p className="text-sm text-muted-foreground">
          Published Version의 System/User Template은 수정할 수 없습니다.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextareaField
          label="Variables JSON"
          placeholder="Prompt 변수 정의를 JSON 배열로 입력하세요."
          readOnly={!editable}
          rows={8}
          {...register("variables")}
        />

        <AdminTextareaField
          label="Response Schema JSON"
          placeholder="응답 Schema를 JSON 객체로 입력하세요."
          readOnly={!editable}
          rows={8}
          {...register("responseSchema")}
        />
      </div>

      <AdminActionMessage message={message} />

      {!editable ? (
        <p className="text-sm text-muted-foreground">
          Archived Version은 수정할 수 없습니다.
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {deletable && version && onDelete ? (
          <div className="mr-auto">
            <AdminAlertDialog
              trigger={
                <Button type="button" variant="destructive">
                  삭제
                </Button>
              }
              title="AI Prompt Version을 삭제할까요?"
              description="삭제한 Prompt Version은 복구할 수 없습니다."
              confirmLabel="삭제"
              confirmVariant="destructive"
              pending={deletePending}
              onConfirm={() => onDelete(version.id)}
            />
          </div>
        ) : null}

        {editable ? (
          <Button type="submit" disabled={savePending || !isDirty}>
            {createMode ? "저장" : "수정"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
