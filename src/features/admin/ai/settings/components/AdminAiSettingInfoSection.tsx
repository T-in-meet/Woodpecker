"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";
import { ROUTES } from "@/lib/constants/routes";

import { useDeleteAdminAiSetting } from "../hooks/use-admin-ai-setting-mutations";
import type { AdminAiSetting } from "../types";
import { AdminAiSettingUpdateForm } from "./AdminAiSettingUpdateForm";

type AdminAiSettingInfoSectionProps = {
  /** 표시하고 수정할 AI 설정 정보입니다. */
  setting: AdminAiSetting;
};

/**
 * @description AI 설정 정보를 표시하고 수정 모드 전환을 관리합니다.
 * @param props AI 설정 정보 영역의 속성입니다.
 * @returns AI 설정 정보 또는 수정 폼을 반환합니다.
 */
export function AdminAiSettingInfoSection({
  setting,
}: AdminAiSettingInfoSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { mutate: deleteSetting, isPending: isDeleting } =
    useDeleteAdminAiSetting();

  function handleDelete() {
    deleteSetting(
      {
        settingId: setting.id,
      },
      {
        onSuccess: (result) => {
          if (!result.success) {
            toast.error(result.message);
            return;
          }

          toast.success("AI 설정을 삭제했습니다.");
          router.push(ROUTES.ADMIN.AI.SETTINGS);
        },
        onError: () => {
          toast.error("AI 설정 삭제 중 오류가 발생했습니다.");
        },
      },
    );
  }

  if (isEditing) {
    return (
      <AdminAiSettingUpdateForm
        setting={setting}
        onCancel={() => setIsEditing(false)}
        onSuccess={() => setIsEditing(false)}
      />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between  gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">설정 정보</h2>
          <p className="text-muted-foreground text-sm">
            AI 설정의 이름, 키 및 설명을 확인합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            수정
          </Button>

          <AdminAlertDialog
            trigger={
              <Button type="button" variant="destructive">
                삭제
              </Button>
            }
            title="AI 설정을 삭제할까요?"
            description={
              <>
                이 설정과 연결된 Chat 및 Embedding 구성도 함께 삭제됩니다.
                <br />이 작업은 되돌릴 수 없습니다.
              </>
            }
            confirmLabel="삭제"
            confirmVariant="destructive"
            pending={isDeleting}
            onConfirm={handleDelete}
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">설정 이름</p>
          <p className="font-medium">{setting.displayName}</p>
        </div>

        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">설정 키</p>
          <p className="font-mono text-sm">{setting.key}</p>
        </div>

        <div className="space-y-1 md:col-span-2">
          <p className="text-muted-foreground text-sm">설명</p>
          <p className="whitespace-pre-wrap">
            {setting.description || "등록된 설명이 없습니다."}
          </p>
        </div>
      </div>
    </section>
  );
}
