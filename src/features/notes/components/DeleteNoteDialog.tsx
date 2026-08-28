"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
    }

    onOpenChange(nextOpen);
  }

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>노트 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* DialogDescription이 aria-describedby를 연결한다. */}
          <DialogDescription>
            삭제한 노트는 되돌릴 수 없습니다. 아래 노트를 영구적으로
            삭제하시겠습니까?
          </DialogDescription>
          <p className="min-w-0 max-w-full whitespace-normal break-keep rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            {noteTitle}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "삭제 중..." : "삭제하기"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
