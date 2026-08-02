"use client";

import { Loader2 } from "lucide-react";
import type { RefObject } from "react";
import type { FieldErrors } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

import type { FormInput } from "./SignupForm";

/**
 * 회원가입 액션 영역 props
 */
type SignupActionsProps = {
  rootError: FieldErrors<FormInput>["root"];
  isPending: boolean;
  isSubmitButtonVisuallyEnabled: boolean;
  submitButtonRef: RefObject<HTMLButtonElement | null>;
};

/**
 * 회원가입 하단 액션 영역
 */
export function SignupActions({
  rootError,
  isPending,
  isSubmitButtonVisuallyEnabled,
  submitButtonRef,
}: SignupActionsProps) {
  return (
    <div className="space-y-4">
      {rootError && (
        <p
          role="alert"
          data-testid="form-error"
          className="text-sm text-destructive"
        >
          {rootError.message}
        </p>
      )}

      <div
        data-testid="form-action-area"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <Button
          ref={submitButtonRef}
          type="submit"
          disabled={isPending}
          className={cn(
            "w-full transition-colors duration-200",
            isSubmitButtonVisuallyEnabled
              ? "hover:bg-primary"
              : "bg-primary/45 text-primary-foreground/85 hover:bg-primary/55",
          )}
        >
          {isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isPending ? "가입 중..." : "회원가입"}
        </Button>
      </div>
    </div>
  );
}
