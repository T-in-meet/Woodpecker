"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";
import { ROUTES } from "@/lib/constants/routes";

import { useAdminAiAgentOptions } from "../../agents/hooks/use-admin-ai-agent-queries";
import { AdminActionMessage } from "../../components/AdminActionMessage";
import {
  useCreateAdminAiPromptFamily,
  useDeleteAdminAiPromptFamily,
  useUpdateAdminAiPromptFamily,
} from "../hooks/use-admin-ai-prompt-family-mutations";
import type { AdminAiPromptFamilyDetail } from "../types";
import { AdminAiPromptFamilyBasicFields } from "./AdminAiPromptFamilyBasicFields";
import {
  type AdminAiPromptFamilyFormValues,
  buildAiPromptFamilyFormData,
  isCreateMode,
} from "./AdminAiPromptFamilyForm.utils";
import { AdminAiPromptInitialVersionFields } from "./AdminAiPromptInitialVersionFields";

type AdminAiPromptFamilyFormProps = {
  /** 수정할 Prompt Family입니다. 없으면 생성 모드입니다. */
  family?: AdminAiPromptFamilyDetail;

  /** 생성 화면에 기본 선택할 Agent ID입니다. */
  initialAgentId?: string;
};

/**
 * Prompt Family 생성·수정 및 Version 관리를 처리합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Family 폼과 Version 목록
 */
export function AdminAiPromptFamilyForm({
  family,
  initialAgentId,
}: AdminAiPromptFamilyFormProps) {
  const router = useRouter();
  const createMode = isCreateMode(family);
  const agentOptionsQuery = useAdminAiAgentOptions();
  const createMutation = useCreateAdminAiPromptFamily();
  const updateMutation = useUpdateAdminAiPromptFamily();
  const deleteFamilyMutation = useDeleteAdminAiPromptFamily();

  const [message, setMessage] = useState<string | null>(null);

  const {
    control,
    formState: { isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<AdminAiPromptFamilyFormValues>({
    defaultValues: {
      agentId: family?.agentId ?? initialAgentId ?? "",
      displayName: family?.displayName ?? "",
      description: family?.description ?? "",
      tags: family?.tags.join(", ") ?? "",
      versionDisplayName: "v1 draft",
      changeSummary: "",
      systemTemplate: "",
      userTemplate: "",
      variables: "",
      responseSchema: "",
    },
  });

  const savePending = createMutation.isPending || updateMutation.isPending;

  /**
   * Prompt Family 저장을 처리합니다.
   *
   * 생성과 수정의 성공 결과를 toast로 알리고,
   * 예상하지 못한 요청 실패는 공통 오류 메시지로 표시합니다.
   *
   * @param values RHF에서 관리하는 폼 값
   */
  async function handleSave(values: AdminAiPromptFamilyFormValues) {
    setMessage(null);

    try {
      const formData = buildAiPromptFamilyFormData(values, family);

      const result = createMode
        ? await createMutation.mutateAsync(formData)
        : await updateMutation.mutateAsync(formData);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      if (createMode && result.id) {
        toast.success("AI Prompt Family를 생성했습니다.");
        router.push(`${ROUTES.ADMIN.AI.PROMPTS}/${result.id}`);
        return;
      }

      toast.success("AI Prompt Family를 수정했습니다.");

      reset(values);
      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  /**
   * Prompt Family 삭제를 처리합니다.
   *
   * 삭제 성공 시 목록으로 이동하고,
   * 예상하지 못한 요청 실패는 공통 오류 메시지로 표시합니다.
   */
  async function handleDeleteFamily() {
    if (!family) {
      return;
    }

    setMessage(null);

    try {
      const result = await deleteFamilyMutation.mutateAsync(family.id);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      toast.success("AI Prompt Family를 삭제했습니다.");
      router.push(ROUTES.ADMIN.AI.PROMPTS);
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
        {createMode ? (
          <div className="grid items-start gap-8 xl:grid-cols-2">
            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">프롬프트 정보</h2>
                <p className="text-sm text-muted-foreground">
                  Agent에 연결할 Prompt Family의 기본 정보를 설정합니다.
                </p>
              </div>

              <AdminAiPromptFamilyBasicFields
                createMode
                agentOptions={agentOptionsQuery.data ?? []}
                isAgentOptionsPending={agentOptionsQuery.isPending}
                control={control}
                register={register}
              />
            </section>

            <AdminAiPromptInitialVersionFields register={register} />
          </div>
        ) : (
          <AdminAiPromptFamilyBasicFields
            createMode={false}
            currentAgentDisplayName={family?.agentDisplayName ?? "-"}
            currentAgentId={family?.agentId ?? ""}
            agentOptions={agentOptionsQuery.data ?? []}
            isAgentOptionsPending={agentOptionsQuery.isPending}
            control={control}
            register={register}
          />
        )}

        <AdminActionMessage message={message} />

        <div className="flex items-center justify-end gap-3">
          {!createMode && family ? (
            <div className="mr-auto">
              <AdminAlertDialog
                trigger={
                  <Button type="button" variant="destructive">
                    삭제
                  </Button>
                }
                title="AI Prompt Family를 삭제할까요?"
                description="삭제한 Prompt Family와 하위 Version은 복구할 수 없습니다."
                confirmLabel="삭제"
                confirmVariant="destructive"
                cancelLabel="취소"
                pending={deleteFamilyMutation.isPending}
                onConfirm={handleDeleteFamily}
              />
            </div>
          ) : null}

          <Button type="submit" disabled={savePending || !isDirty}>
            {createMode ? "저장" : "수정"}
          </Button>
        </div>
      </form>
    </div>
  );
}
