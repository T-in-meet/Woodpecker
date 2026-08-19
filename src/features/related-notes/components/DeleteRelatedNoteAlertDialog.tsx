"use client";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useDeleteRelatedNote } from "../hooks/use-delete-related-note";

type DeleteRelatedNoteAlertDialogProps = {
  /** Related Notes가 연결된 기준 Note ID입니다. */
  noteId: string;

  /** 삭제할 Related Note ID입니다. */
  relatedNoteId: string;

  /** 삭제 확인 문구에 표시할 Related Note 제목입니다. */
  title: string;

  /** Related Note 관계가 생성된 출처입니다. */
  origin: "manual" | "ai";

  /** AlertDialog를 여는 Trigger입니다. */
  children: React.ReactNode;
};

/**
 * Related Note 삭제 여부를 확인하는 AlertDialog입니다.
 *
 * manual 관계는 실제 관계 row를 삭제하고,
 * AI 추천은 dismissed 상태로 변경되어 현재 목록에서 제외됩니다.
 *
 * 실제 삭제 방식은 Client에서 결정하지 않고
 * `delete_note_related` RPC에서 저장된 origin을 기준으로 처리합니다.
 *
 * @param props 삭제 대상 Related Note 정보와 Dialog Trigger
 */
export function DeleteRelatedNoteAlertDialog({
  noteId,
  relatedNoteId,
  title,
  origin,
  children,
}: DeleteRelatedNoteAlertDialogProps) {
  const deleteRelatedNoteMutation = useDeleteRelatedNote();

  const isManual = origin === "manual";

  async function handleDelete() {
    try {
      await deleteRelatedNoteMutation.mutateAsync({
        noteId,
        relatedNoteId,
      });

      toast.success(
        isManual ? "관련 노트 연결을 삭제했습니다." : "AI 추천을 숨겼습니다.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "관련 노트 삭제에 실패했습니다.",
      );
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-base font-bold">
            {isManual ? "관련 노트 연결을 삭제할까요?" : "AI 추천을 숨길까요?"}
          </AlertDialogTitle>

          <AlertDialogDescription className="text-pretty">
            {isManual ? (
              <>
                <span className="font-semibold text-foreground">
                  {`"${title}"`}
                </span>{" "}
                노트와의 직접 연결이 삭제됩니다.
              </>
            ) : (
              <>
                <span className="font-semibold text-foreground">
                  {`"${title}"`}
                </span>{" "}
                노트는 AI 추천 목록에서 제외되며 이후 동일한 추천이 다시
                표시되지 않습니다.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteRelatedNoteMutation.isPending}>
            취소
          </AlertDialogCancel>

          <AlertDialogAction
            variant="destructive"
            disabled={deleteRelatedNoteMutation.isPending}
            onClick={handleDelete}
          >
            {deleteRelatedNoteMutation.isPending
              ? "삭제 중..."
              : isManual
                ? "삭제"
                : "숨기기"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
