"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { deleteNoteAction } from "../actions";

type DeleteNoteDialogProps = {
  noteId: string;
  noteTitle: string;
};

export function DeleteNoteDialog({ noteId, noteTitle }: DeleteNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
    }

    setOpen(nextOpen);
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
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="size-3.5" />
          노트 삭제
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>노트 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            삭제한 노트는 되돌릴 수 없습니다. 아래 노트를 영구적으로
            삭제하시겠습니까?
          </p>
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
