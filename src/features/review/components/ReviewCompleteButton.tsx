"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { completeReviewAction } from "../actions";

type ReviewCompleteButtonProps = {
  noteId: string;
  reviewLogId: string;
  completionToken: string;
};

export function ReviewCompleteButton({
  noteId,
  reviewLogId,
  completionToken,
}: ReviewCompleteButtonProps) {
  const [state, formAction, isPending] = useActionState(
    completeReviewAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="noteId" value={noteId} />
      <input type="hidden" name="reviewLogId" value={reviewLogId} />
      <input type="hidden" name="completionToken" value={completionToken} />

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "완료 처리 중..." : "복습 완료"}
      </Button>
    </form>
  );
}
