"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { completeReviewAction } from "../actions";

type ReviewCompleteButtonProps = {
  disabled?: boolean;
  noteId: string;
  reviewLogId: string;
};

export function ReviewCompleteButton({
  disabled = false,
  noteId,
  reviewLogId,
}: ReviewCompleteButtonProps) {
  const [state, formAction, isPending] = useActionState(
    completeReviewAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="reviewLogId" value={reviewLogId} />

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending || disabled}>
        {disabled
          ? "내일부터 완료 가능"
          : isPending
            ? "완료 처리 중..."
            : "복습 완료"}
      </Button>
    </form>
  );
}
