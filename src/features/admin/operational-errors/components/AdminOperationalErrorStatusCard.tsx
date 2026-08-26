"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AdminCollapsibleSection } from "@/features/admin/components/common/AdminCollapsibleSection";
import {
  OPERATIONAL_ERROR_STATUS,
  type OperationalErrorStatusType,
} from "@/features/operational-errors/constants";
import { formatOperationalErrorStatusLabel } from "@/features/operational-errors/utils/format-operational-error-label";
import { formatDateTime } from "@/lib/utils/formatDate";

import { AdminAlertDialog } from "../../components/common/AdminAlertDialog";
import { ADMIN_SELECT_DEFAULTS } from "../../constants/admin-select";
import { useUpdateOperationalErrorStatus } from "../hooks/use-update-operational-error-status";
import { OperationalErrorStatusBadge } from "./OperationalErrorStatusBadge";

const STATUS_OPTIONS = [
  {
    label: formatOperationalErrorStatusLabel(OPERATIONAL_ERROR_STATUS.OPEN),
    value: OPERATIONAL_ERROR_STATUS.OPEN,
  },
  {
    label: formatOperationalErrorStatusLabel(OPERATIONAL_ERROR_STATUS.RESOLVED),
    value: OPERATIONAL_ERROR_STATUS.RESOLVED,
  },
  {
    label: formatOperationalErrorStatusLabel(OPERATIONAL_ERROR_STATUS.IGNORED),
    value: OPERATIONAL_ERROR_STATUS.IGNORED,
  },
] as const;

type AdminOperationalErrorStatusCardProps = {
  /** 상태를 관리할 운영 오류 ID */
  operationalErrorId: string;

  /** 현재 저장된 운영 오류 상태 */
  currentStatus: OperationalErrorStatusType;

  /** 가장 최근 처리 이력의 생성 시각 */
  lastHandledAt: string | null;

  /** 가장 최근 처리 이력을 작성한 관리자 표시 이름 */
  lastHandledByLabel: string | null;
};

/**
 * 운영 오류의 현재 상태를 확인하고 새로운 처리를 등록하는 카드입니다.
 *
 * 변경할 상태는 선택되지 않은 상태로 시작합니다.
 * 상태를 선택하지 않고 메모만 입력하면 현재 상태를 유지한 채
 * 새로운 처리 이력만 추가합니다.
 *
 * 처리 이력은 저장 후 수정하거나 삭제할 수 없으므로,
 * 저장 전에 확인 대화상자에서 상태와 메모를 다시 확인합니다.
 */
export function AdminOperationalErrorStatusCard({
  operationalErrorId,
  currentStatus,
  lastHandledAt,
  lastHandledByLabel,
}: AdminOperationalErrorStatusCardProps) {
  const [status, setStatus] = useState<OperationalErrorStatusType | "">("");
  const [resolutionNote, setResolutionNote] = useState("");

  const statusMutation = useUpdateOperationalErrorStatus();

  useEffect(() => {
    setStatus("");
    setResolutionNote("");
  }, [currentStatus]);

  /** 현재 저장된 상태의 사용자 표시 문구 */
  const currentStatusLabel =
    STATUS_OPTIONS.find((option) => option.value === currentStatus)?.label ??
    currentStatus;

  /**
   * 상태가 선택되지 않았다면 현재 상태를 유지합니다.
   *
   * 메모만 입력한 경우에도 확인 대화상자에 실제 저장될 상태를
   * 표시할 수 있도록 최종 상태를 별도로 계산합니다.
   */
  const nextStatus = status || currentStatus;

  /** 실제로 저장될 상태의 사용자 표시 문구 */
  const nextStatusLabel =
    STATUS_OPTIONS.find((option) => option.value === nextStatus)?.label ??
    nextStatus;

  /** 상태와 처리 메모가 모두 변경되지 않았는지 여부 */
  const isUnchanged = status === "" && resolutionNote.trim().length === 0;

  /**
   * 확인 대화상자에서 저장을 선택하면 상태 변경 요청을 실행합니다.
   */
  const handleSave = () => {
    statusMutation.mutate(
      {
        operationalErrorId,

        // 상태를 선택하지 않은 경우 현재 상태를 유지합니다.
        status: nextStatus,

        resolutionNote: resolutionNote.trim(),
      },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setStatus("");
            setResolutionNote("");
          }
        },
      },
    );
  };

  return (
    <AdminCollapsibleSection title="상태 관리">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">현재 상태</p>

            <OperationalErrorStatusBadge status={currentStatus} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">처리자</p>

            <p className="text-sm font-medium">{lastHandledByLabel ?? "-"}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">처리일</p>

            <p className="text-sm font-medium">
              {lastHandledAt ? formatDateTime(lastHandledAt) : "-"}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <label className="text-sm font-medium">변경할 상태</label>

          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as OperationalErrorStatusType)
            }
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="변경할 상태를 선택하세요." />
            </SelectTrigger>

            <SelectContent {...ADMIN_SELECT_DEFAULTS.content}>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">처리 메모</label>

          <Textarea
            value={resolutionNote}
            rows={5}
            placeholder="이번 처리에 대한 조사 내용이나 처리 근거를 남겨주세요."
            onChange={(event) => setResolutionNote(event.target.value)}
          />
        </div>

        <AdminAlertDialog
          trigger={
            <Button
              type="button"
              className="w-full"
              disabled={statusMutation.isPending || isUnchanged}
            >
              {statusMutation.isPending ? "저장 중" : "처리 저장"}
            </Button>
          }
          title="처리 내용을 저장하시겠습니까?"
          description={
            <div className="space-y-4">
              <p>
                처리 내용을 저장하면 새로운 이력이 추가됩니다. 저장된 처리
                이력은 수정하거나 삭제할 수 없습니다.
              </p>

              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-md border p-4">
                <dt className="text-muted-foreground">현재 상태</dt>
                <dd className="font-medium">{currentStatusLabel}</dd>

                <dt className="text-muted-foreground">저장 상태</dt>
                <dd className="font-medium">{nextStatusLabel}</dd>

                <dt className="text-muted-foreground">처리 메모</dt>
                <dd className="whitespace-pre-wrap wrap-break-words">
                  {resolutionNote.trim() || "작성하지 않음"}
                </dd>
              </dl>
            </div>
          }
          confirmLabel="처리 저장"
          pending={statusMutation.isPending}
          onConfirm={handleSave}
        />
      </div>
    </AdminCollapsibleSection>
  );
}
