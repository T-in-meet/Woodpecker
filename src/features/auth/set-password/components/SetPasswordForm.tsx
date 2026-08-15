"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ResetPasswordFormInput,
  resetPasswordFormSchema,
} from "@/features/auth/reset-password/schemas/resetPasswordFormSchema";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";

import {
  INITIAL_SET_PASSWORD_ACTION_STATE,
  SetPasswordActionState,
} from "../actions/setPasswordActionState";
import {
  SET_PASSWORD_GLOBAL_ERROR_MESSAGE,
  SET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
  SET_PASSWORD_SAME_PASSWORD_MESSAGE,
} from "../constants/messages";

type SetPasswordFormProps = {
  action: (
    prevState: SetPasswordActionState,
    formData: FormData,
  ) => Promise<SetPasswordActionState>;
};

/**
 * OAuth 계정에 이메일/비밀번호 로그인을 추가하는 비밀번호 설정 폼입니다.
 */
export function SetPasswordForm({ action }: SetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_SET_PASSWORD_ACTION_STATE,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const passwordErrorId = "set-password-password-error";
  const confirmPasswordErrorId = "set-password-confirm-password-error";
  const globalErrorId = "set-password-global-error";

  const hasClientErrors = Boolean(
    errors.password?.message || errors.confirmPassword?.message,
  );

  const visibleFieldErrors = hasClientErrors
    ? {
        password: errors.password?.message
          ? [errors.password.message]
          : undefined,
        confirmPassword: errors.confirmPassword?.message
          ? [errors.confirmPassword.message]
          : undefined,
      }
    : state.status === "invalid_input"
      ? state.fieldErrors
      : {};

  const showGlobalError = state.status === "internal_error" && !hasClientErrors;
  const globalErrorMessage =
    state.status === "internal_error" && state.reason === "same_password"
      ? SET_PASSWORD_SAME_PASSWORD_MESSAGE
      : SET_PASSWORD_GLOBAL_ERROR_MESSAGE;

  usePreventPageLeave(
    isDirty && !isPending,
    SET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
  );

  /**
   * 클라이언트 검증을 통과한 비밀번호만 Server Action으로 전달합니다.
   */
  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.set("password", data.password);
    formData.set("confirmPassword", data.confirmPassword);

    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <div className="my-0 md:my-4 mx-auto max-w-2xl bg-white border-0 md:border md:border-outline-variant md:rounded-xl rounded-none md:shadow-sm shadow-none overflow-hidden">
      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-4xl space-y-2 py-7 px-4 md:px-8"
        noValidate
      >
        <div className="mb-5 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            이메일 로그인 추가
          </h1>
          <p className="text-sm text-muted-foreground">
            앞으로 같은 이메일과 비밀번호로도 로그인할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4 gap-y-2">
          <div className="flex items-center">
            <Label htmlFor="password" className="shrink-0 min-w-25">
              비밀번호
            </Label>
          </div>

          <Input
            id="password"
            type="password"
            aria-invalid={Boolean(visibleFieldErrors.password?.length)}
            aria-describedby={
              visibleFieldErrors.password?.length ? passwordErrorId : undefined
            }
            {...register("password")}
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

        <div className="grid grid-cols-1 md:grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4 gap-y-2">
          <div className="flex items-center">
            <Label htmlFor="confirmPassword" className="shrink-0 min-w-25">
              비밀번호 확인
            </Label>
          </div>

          <Input
            id="confirmPassword"
            type="password"
            aria-invalid={Boolean(visibleFieldErrors.confirmPassword?.length)}
            aria-describedby={
              visibleFieldErrors.confirmPassword?.length
                ? confirmPasswordErrorId
                : undefined
            }
            {...register("confirmPassword")}
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
          disabled={isPending}
          type="submit"
          className="w-full md:w-auto"
          aria-describedby={showGlobalError ? globalErrorId : undefined}
        >
          {isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isPending ? "설정 중..." : "비밀번호 설정하기"}
        </Button>
      </form>
    </div>
  );
}
