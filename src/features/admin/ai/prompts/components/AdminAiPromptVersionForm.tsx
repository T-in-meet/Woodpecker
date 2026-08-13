"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
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
 * JSON 값을 Textarea 기본값으로 직렬화합니다.
 *
 * @param value JSON 값
 * @returns 들여쓰기한 JSON 문자열
 */
function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/**
 * Prompt Version 생성 모드 여부를 판별합니다.
 *
 * @param version Prompt Version
 * @returns 생성 모드면 true
 */
function isCreateMode(version: AdminAiPromptVersionRow | undefined) {
  return version === undefined;
}

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

  const editable =
    createMode ||
    version?.lifecycleStatus === "draft" ||
    version?.lifecycleStatus === "published";

  const templateEditable = createMode || version?.lifecycleStatus === "draft";

  // Published Version은 배포 이력 보호를 위해 개별 삭제를 허용하지 않는다.
  const deletable =
    !createMode &&
    version !== undefined &&
    (version.lifecycleStatus === "draft" ||
      version.lifecycleStatus === "archived");

  const [message, setMessage] = useState<string | null>(null);

  /**
   * Prompt Version 저장을 처리합니다.
   *
   * 생성과 수정의 성공 결과를 toast로 알리고,
   * 예상하지 못한 요청 실패는 공통 오류 메시지로 표시합니다.
   *
   * @param event 폼 제출 이벤트
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editable) {
      return;
    }

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
        toast.success("AI Prompt Version을 생성했습니다.");
        router.push(getAdminAiPromptVersionRoute(family.id, result.id));
        return;
      }

      toast.success("AI Prompt Version을 수정했습니다.");
      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  const variablesDefaultValue = sourceVersion
    ? stringifyJson(sourceVersion.variables)
    : "[]";

  const responseSchemaDefaultValue = sourceVersion
    ? stringifyJson(sourceVersion.responseSchema)
    : "{}";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <input type="hidden" name="familyId" value={family.id} />

      {!createMode && version ? (
        <input type="hidden" name="versionId" value={version.id} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          name="versionDisplayName"
          defaultValue={sourceVersion?.displayName ?? "draft"}
          placeholder="Prompt Version 이름"
          readOnly={!editable}
          required
        />

        <AdminTextField
          label="Tags"
          name="tags"
          defaultValue={sourceVersion?.tags.join(", ") ?? ""}
          placeholder="쉼표로 구분하여 입력하세요."
          readOnly={!editable}
        />
      </div>

      <AdminTextField
        label="변경 요약"
        name="changeSummary"
        defaultValue={sourceVersion?.changeSummary ?? ""}
        placeholder="이 Version의 변경 내용을 입력하세요."
        readOnly={!editable}
      />

      <AdminTextareaField
        label="System Template"
        name="systemTemplate"
        defaultValue={sourceVersion?.systemTemplate ?? ""}
        placeholder="System Prompt Template을 입력하세요."
        readOnly={!templateEditable}
        rows={12}
        required
      />

      <AdminTextareaField
        label="User Template"
        name="userTemplate"
        defaultValue={sourceVersion?.userTemplate ?? ""}
        placeholder="User Prompt Template을 입력하세요."
        readOnly={!templateEditable}
        rows={12}
        required
      />

      {!createMode && version?.lifecycleStatus === "published" ? (
        <p className="text-sm text-muted-foreground">
          Published Version의 System/User Template은 수정할 수 없습니다.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextareaField
          label="Variables JSON"
          name="variables"
          defaultValue={variablesDefaultValue}
          placeholder="Prompt 변수 정의를 JSON 배열로 입력하세요."
          readOnly={!editable}
          rows={8}
        />

        <AdminTextareaField
          label="Response Schema JSON"
          name="responseSchema"
          defaultValue={responseSchemaDefaultValue}
          placeholder="응답 Schema를 JSON 객체로 입력하세요."
          readOnly={!editable}
          rows={8}
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
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMode ? "생성" : "저장"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
