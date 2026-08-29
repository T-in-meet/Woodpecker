"use client";

import { useEffect, useState, useTransition } from "react";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* 여기만 `text-prose-ko`(overflow-wrap: break-word) 대신 `anywhere`를 쓴다.
              사용자가 지은 제목이 공백 없는 긴 문자열일 수 있는데, `break-word`는
              min-content 계산에 반영되지 않아 좁은 다이얼로그를 밀어낸다. */}
          <p className="min-w-0 max-w-full whitespace-normal break-keep rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            {noteTitle}
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
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
