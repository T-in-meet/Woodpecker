"use client";

import { useEffect, useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { deleteNoteAction } from "../actions";

type DeleteNoteDialogProps = {
  noteId: string;
  noteTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 삭제 확인 다이얼로그. 트리거는 갖지 않고 열림 상태를 밖에서 받는다.
 * 삭제는 빈도가 낮은 파괴적 행동이라 액션 바가 아니라 관리 메뉴 안에서 연다.
 */
export function DeleteNoteDialog({
  noteId,
  noteTitle,
  open,
  onOpenChange,
}: DeleteNoteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 여는 주체가 밖(`NoteManageMenu`)이라 열 때는 Radix가 onOpenChange를 호출하지 않는다.
  // 이전 시도의 오류가 남지 않도록 열림 자체를 신호로 삼아 비운다.
  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteNoteAction(noteId);

      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>노트를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            삭제한 노트는 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* 여기만 `text-prose-ko`(overflow-wrap: break-word) 대신 `anywhere`를 쓴다.
            사용자가 지은 제목이 공백 없는 긴 문자열일 수 있는데, `break-word`는
            min-content 계산에 반영되지 않아 좁은 다이얼로그를 밀어낸다. */}
        <p className="min-w-0 max-w-full whitespace-normal break-keep rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
          {noteTitle}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(event) => {
              // 삭제 성공 시 Server Action의 redirect로 페이지가 바뀌므로
              // 요청 결과와 무관하게 자동으로 닫히지 않게 한다.
              event.preventDefault();
              handleDelete();
            }}
          >
            {isPending ? "삭제 중..." : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
