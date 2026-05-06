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
  INITIAL_RESET_PASSWORD_ACTION_STATE,
  ResetPasswordActionState,
} from "../actions/resetPasswordActionState";
import {
  RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
  RESET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
  RESET_PASSWORD_SAME_PASSWORD_MESSAGE,
} from "../constants/messages";

type ResetPasswordFormProps = {
  action: (
    prevState: ResetPasswordActionState,
    formData: FormData,
  ) => Promise<ResetPasswordActionState>;
};

export function ResetPasswordForm({ action }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_RESET_PASSWORD_ACTION_STATE,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const passwordErrorId = "reset-password-password-error";
  const confirmPasswordErrorId = "reset-password-confirm-password-error";
  const globalErrorId = "reset-password-global-error";

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
      ? RESET_PASSWORD_SAME_PASSWORD_MESSAGE
      : RESET_PASSWORD_GLOBAL_ERROR_MESSAGE;

  /**
   * reset-password 페이지 이탈 제어
   *
   * 비밀번호 변경 submit 진행 중에는 정상 흐름을 방해하지 않고,
   * 그 외 상황에서는 페이지 이탈 시 재설정 흐름이 중단될 수 있음을 안내한다.
   */
  usePreventPageLeave(!isPending, RESET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE);

  /**
   * react-hook-form 검증을 통과한 값만 Server Action에 전달한다.
   *
   * ForgotPasswordForm과 동일하게 native form action을 사용하지 않고,
   * handleSubmit으로 검증한 뒤 FormData를 직접 구성해 useActionState dispatch를 호출한다.
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
          {isPending ? "변경 중..." : "비밀번호 변경하기"}
        </Button>
      </form>
    </div>
  );
}
