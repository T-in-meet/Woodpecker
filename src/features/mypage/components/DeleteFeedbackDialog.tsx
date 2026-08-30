"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

import { deleteFeedbackAction } from "../actions";

type DeleteFeedbackDialogProps = {
  feedbackId: string;
  feedbackTitle: string;
};

export function DeleteFeedbackDialog({
  feedbackId,
  feedbackTitle,
}: DeleteFeedbackDialogProps) {
  const router = useRouter();
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
      const result = await deleteFeedbackAction(feedbackId);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="size-3.5" />
          삭제
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>문의사항 삭제</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* DialogDescription이 aria-describedby를 연결한다. */}
          <DialogDescription>
            <span className="font-medium text-foreground">
              &ldquo;{feedbackTitle}&rdquo;
            </span>{" "}
            문의사항을 삭제할까요? 첨부한 이미지도 함께 삭제되며 되돌릴 수
            없습니다.
          </DialogDescription>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
