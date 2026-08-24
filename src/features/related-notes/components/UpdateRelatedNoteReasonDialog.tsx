"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useUpdateManualRelatedNoteReason } from "../hooks/use-update-manual-related-note-reason";

type UpdateRelatedNoteReasonDialogProps = {
  /** 수정할 Related Note가 연결된 기준 Note ID입니다. */
  noteId: string;

  /** 수정할 Related Note ID입니다. */
  relatedNoteId: string;

  /** 화면에 표시할 Related Note 제목입니다. */
  title: string;

  /** 현재 저장된 선택적 연결 이유입니다. */
  reason?: string;

  /** Dialog를 여는 Trigger입니다. */
  children: React.ReactNode;
};

type UpdateRelatedNoteReasonFormValues = {
  reason: string;
};

/**
 * manual Related Note의 선택적 연결 이유를 수정하는 Dialog입니다.
 *
 * 현재 저장된 reason을 초기값으로 표시하며,
 * 빈 값으로 저장하면 기존 reason을 제거합니다.
 *
 * 실제 저장값 기준으로 변경 사항이 없는 경우에는
 * 저장 버튼을 비활성화합니다.
 *
 * @param props 수정 대상 Related Note 정보와 Dialog Trigger
 */
export function UpdateRelatedNoteReasonDialog({
  noteId,
  relatedNoteId,
  title,
  reason,
  children,
}: UpdateRelatedNoteReasonDialogProps) {
  const updateReasonMutation = useUpdateManualRelatedNoteReason();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<UpdateRelatedNoteReasonFormValues>({
    defaultValues: {
      reason: reason ?? "",
    },
  });

  const reasonInput = watch("reason");
  const normalizedReason = reasonInput.trim();
  const normalizedInitialReason = (reason ?? "").trim();

  const hasChanges = normalizedReason !== normalizedInitialReason;

  useEffect(() => {
    reset({
      reason: reason ?? "",
    });
  }, [reason, reset]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset({
        reason: reason ?? "",
      });
      updateReasonMutation.reset();
    }
  }

  async function onSubmit(values: UpdateRelatedNoteReasonFormValues) {
    const nextReason = values.reason.trim();

    try {
      await updateReasonMutation.mutateAsync({
        noteId,
        relatedNoteId,
        ...(nextReason
          ? {
              reason: nextReason,
            }
          : {}),
      });

      reset({
        reason: nextReason,
      });

      toast.success("연결 이유를 수정했습니다.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "연결 이유 수정에 실패했습니다.",
      );
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>연결 이유 수정</DialogTitle>
            <DialogDescription>
              Related Note의 연결 이유를 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <Label>관련 노트</Label>
              <p
                className="truncate text-sm text-muted-foreground"
                title={title}
              >
                {title}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`related-note-reason-${relatedNoteId}`}>
                연결 이유
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  선택
                </span>
              </Label>

              <Textarea
                id={`related-note-reason-${relatedNoteId}`}
                rows={4}
                maxLength={500}
                placeholder="이 노트를 연결하는 이유를 입력할 수 있습니다."
                {...register("reason")}
              />

              <p className="text-right text-xs text-muted-foreground">
                {reasonInput.length}/500
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                reset({
                  reason: reason ?? "",
                })
              }
            >
              취소
            </Button>

            <Button
              type="submit"
              disabled={
                !hasChanges || isSubmitting || updateReasonMutation.isPending
              }
            >
              {updateReasonMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
