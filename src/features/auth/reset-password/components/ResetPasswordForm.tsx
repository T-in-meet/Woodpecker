"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordFormSchema } from "@/features/auth/reset-password/schemas/resetPasswordFormSchema";

import { INPUT_DEBOUNCE_DELAY_MS } from "../../constants/ui";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";
import {
  INITIAL_RESET_PASSWORD_ACTION_STATE,
  ResetPasswordActionState,
} from "../actions/resetPasswordActionState";
import {
  RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
  RESET_PASSWORD_SAME_PASSWORD_MESSAGE,
} from "../constants/messages";

type ClientFieldErrors = {
  password?: string[];
  confirmPassword?: string[];
};

type ResetPasswordFormProps = {
  action: (
    prevState: ResetPasswordActionState,
    formData: FormData,
  ) => Promise<ResetPasswordActionState>;
};

/**
 * 현재 FormData를 resetPasswordFormSchema로 검증하고,
 * UI에서 표시할 클라이언트 필드 에러 형태로 변환한다.
 */
function toClientErrors(formData: FormData): ClientFieldErrors {
  const parsed = resetPasswordFormSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (parsed.success) {
    return {};
  }

  const fieldErrors = parsed.error.flatten().fieldErrors;
  const errors: ClientFieldErrors = {};
  if (fieldErrors.password) {
    errors.password = fieldErrors.password;
  }
  if (fieldErrors.confirmPassword) {
    errors.confirmPassword = fieldErrors.confirmPassword;
  }
  return errors;
}

function hasClientErrors(errors: ClientFieldErrors): boolean {
  return Boolean(errors.password?.length || errors.confirmPassword?.length);
}

export function ResetPasswordForm({ action }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_RESET_PASSWORD_ACTION_STATE,
  );
  const [clientErrors, setClientErrors] = useState<ClientFieldErrors>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  /**
   * 클라이언트 검증 에러를 서버 액션의 invalid_input보다 우선 표시한다.
   * 사용자가 입력을 수정한 뒤에는 현재 입력값 기준의 에러를 보여주기 위함이다.
   */
  const visibleFieldErrors = useMemo(() => {
    if (hasClientErrors(clientErrors)) {
      return clientErrors;
    }
    if (state.status === "invalid_input") {
      return state.fieldErrors;
    }
    return {};
  }, [clientErrors, state]);

  const showGlobalError =
    state.status === "internal_error" && !hasClientErrors(clientErrors);
  const globalErrorMessage =
    state.status === "internal_error" && state.reason === "same_password"
      ? RESET_PASSWORD_SAME_PASSWORD_MESSAGE
      : RESET_PASSWORD_GLOBAL_ERROR_MESSAGE;
  const passwordErrorId = "reset-password-password-error";
  const confirmPasswordErrorId = "reset-password-confirm-password-error";
  const globalErrorId = "reset-password-global-error";

  /**
   * 입력 변경 시 즉시 검증하지 않고 debounce 후 현재 폼 값을 검증한다.
   * submit 시에는 별도로 즉시 검증하므로 예약된 검증은 handleSubmit에서 정리한다.
   */
  const { schedule: scheduleValidation, cancel: cancelValidation } =
    useDebouncedCallback(() => {
      const formElement = formRef.current;
      if (!formElement) return;

      const errors = toClientErrors(new FormData(formElement));
      setClientErrors(errors);
    }, INPUT_DEBOUNCE_DELAY_MS);

  /**
   * submit 직전에 클라이언트 검증을 즉시 수행한다.
   * 에러가 있으면 서버 액션 호출을 막고 필드 에러만 표시한다.
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    cancelValidation();

    const errors = toClientErrors(new FormData(event.currentTarget));
    setClientErrors(errors);
    if (hasClientErrors(errors)) {
      event.preventDefault();
    }
  };

  return (
    <div className="my-0 md:my-4 mx-auto max-w-2xl bg-white border-0 md:border md:border-outline-variant md:rounded-xl rounded-none md:shadow-sm shadow-none overflow-hidden">
      <form
        action={formAction}
        onSubmit={handleSubmit}
        ref={formRef}
        className="mx-auto max-w-4xl space-y-2 py-7 px-4 md:px-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
          <div className="flex items-center">
            <Label htmlFor="password" className="shrink-0 min-w-25">
              비밀번호
            </Label>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            onChange={scheduleValidation}
            aria-describedby={
              visibleFieldErrors.password?.length ? passwordErrorId : undefined
            }
          />
          <div className="hidden md:block" />
          <div className="min-h-5 mt-2">
            {visibleFieldErrors.password?.map((error) => (
              <p
                key={`password-${error}`}
                id={passwordErrorId}
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
          <div className="flex items-center">
            <Label htmlFor="confirmPassword" className="shrink-0 min-w-25">
              비밀번호 확인
            </Label>
          </div>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            onChange={scheduleValidation}
            aria-describedby={
              visibleFieldErrors.confirmPassword?.length
                ? confirmPasswordErrorId
                : undefined
            }
          />
          <div className="hidden md:block" />
          <div className="min-h-5 mt-2">
            {visibleFieldErrors.confirmPassword?.map((error) => (
              <p
                key={`confirmPassword-${error}`}
                id={confirmPasswordErrorId}
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ))}
          </div>
        </div>

        <div className="min-h-5">
          {showGlobalError ? (
            <p
              id={globalErrorId}
              role="alert"
              className="text-sm text-destructive"
            >
              {globalErrorMessage}
            </p>
          ) : null}
        </div>

        <Button
          disabled={isPending || hasClientErrors(clientErrors)}
          type="submit"
          className="w-full md:w-auto"
          aria-describedby={showGlobalError ? globalErrorId : undefined}
        >
          {isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isPending ? "변경 중..." : "비밀번호 변경하기"}
        </Button>
      </form>
    </div>
  );
}
