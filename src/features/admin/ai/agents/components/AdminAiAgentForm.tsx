"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";
import { ROUTES } from "@/lib/constants/routes";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import {
  useCreateAdminAiAgent,
  useDeleteAdminAiAgent,
  useUpdateAdminAiAgent,
} from "../hooks/use-admin-ai-agent-mutations";
import type { AdminAiAgentDetail } from "../types";
import { AdminAiAgentBasicFields } from "./AdminAiAgentBasicFields";
import {
  type AdminAiAgentFormValues,
  buildAiAgentFormData,
  isCreateMode,
} from "./AdminAiAgentForm.utils";

type AdminAiAgentFormProps = {
  /** 수정할 Agent입니다. 없으면 생성 모드입니다. */
  agent?: AdminAiAgentDetail;
};

/**
 * AI Agent 생성 및 수정 폼을 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns AI Agent 폼
 */
export function AdminAiAgentForm({ agent }: AdminAiAgentFormProps) {
  const router = useRouter();
  const createMutation = useCreateAdminAiAgent();
  const updateMutation = useUpdateAdminAiAgent();
  const deleteMutation = useDeleteAdminAiAgent();
  const createMode = isCreateMode(agent);

  const [message, setMessage] = useState<string | null>(null);

  const {
    formState: { isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<AdminAiAgentFormValues>({
    defaultValues: {
      displayName: agent?.displayName ?? "",
      purpose: agent?.purpose ?? "",
      description: agent?.description ?? "",
      tags: agent?.tags.join(", ") ?? "",
    },
  });

  const savePending = createMutation.isPending || updateMutation.isPending;

  /**
   * Agent 저장을 처리합니다.
   *
   * 생성과 수정의 성공 결과를 toast로 알리고,
   * 예상하지 못한 요청 실패는 공통 오류 메시지로 표시합니다.
   *
   * @param values RHF에서 관리하는 폼 값
   */
  async function handleSave(values: AdminAiAgentFormValues) {
    setMessage(null);

    try {
      const formData = buildAiAgentFormData(values, agent);

      const result = createMode
        ? await createMutation.mutateAsync(formData)
        : await updateMutation.mutateAsync(formData);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      if (createMode && result.id) {
        toast.success("AI Agent를 생성했습니다.");
        router.push(`${ROUTES.ADMIN.AI.AGENTS}/${result.id}`);
        return;
      }

      toast.success("AI Agent를 수정했습니다.");

      reset(values);
      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  /**
   * Agent 삭제를 처리합니다.
   *
   * 삭제 성공 시 목록으로 이동하고,
   * 예상하지 못한 요청 실패는 공통 오류 메시지로 표시합니다.
   */
  async function handleDelete() {
    if (!agent) {
      return;
    }

    setMessage(null);

    try {
      const result = await deleteMutation.mutateAsync(agent.id);

      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      toast.success("AI Agent를 삭제했습니다.");
      router.push(ROUTES.ADMIN.AI.AGENTS);
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-5" onSubmit={handleSubmit(handleSave)}>
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">에이전트 정보</h2>
            <p className="text-sm text-muted-foreground">
              AI 기능에서 사용할 Agent의 기본 정보를 설정합니다.
            </p>
          </div>

          <AdminAiAgentBasicFields register={register} />
        </section>

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
                title="AI Agent를 삭제할까요?"
                description="삭제한 Agent는 복구할 수 없습니다."
                confirmLabel="삭제"
                confirmVariant="destructive"
                cancelLabel="취소"
                pending={deleteMutation.isPending}
                onConfirm={handleDelete}
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
