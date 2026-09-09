"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import {
  type ResetPasswordFormInput,
  resetPasswordFormSchema,
} from "@/features/auth/reset-password/schemas/resetPasswordFormSchema";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";

import { AuthCard } from "../../components/AuthCard";
import AuthFormError from "../../components/AuthFormError";
import { AuthFormField } from "../../components/AuthFormField";
import { AuthFormHeader } from "../../components/AuthFormHeader";
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
    formState: { errors, isDirty, isValid },
    setError,
    clearErrors,
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  /**
   * Server Action 결과를 React Hook Form error로 연결한다.
   *
   * - invalid_input → 해당 field error
   * - same_password → root error
   * - 기타 internal_error → root error
   *
   * UI에서는 RHF errors만 참조하므로
   * client/server error 렌더링 경로를 하나로 통일한다.
   */
  useEffect(() => {
    if (state.status === "invalid_input") {
      const passwordError = state.fieldErrors.password?.[0];
      const confirmPasswordError = state.fieldErrors.confirmPassword?.[0];

      if (passwordError) {
        setError("password", {
          type: "server",
          message: passwordError,
        });
      }

      if (confirmPasswordError) {
        setError("confirmPassword", {
          type: "server",
          message: confirmPasswordError,
        });
      }

      return;
    }

    if (state.status === "internal_error") {
      setError("root", {
        type: "server",
        message:
          state.reason === "same_password"
            ? RESET_PASSWORD_SAME_PASSWORD_MESSAGE
            : RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
      });
    }
  }, [state, setError]);

  /**
   * reset-password 페이지 이탈 제어
   *
   * 비밀번호 변경 submit 진행 중에는 정상 흐름을 방해하지 않고,
   * 그 외 상황에서는 페이지 이탈 시 재설정 흐름이 중단될 수 있음을 안내한다.
   */
  usePreventPageLeave(
    isDirty && !isPending,
    RESET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
  );

  /**
   * React Hook Form 검증을 통과한 값만 Server Action에 전달한다.
   */
  const onSubmit = handleSubmit((data) => {
    clearErrors();

    const formData = new FormData();

    formData.set("password", data.password);
    formData.set("confirmPassword", data.confirmPassword);

    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <AuthCard variant="compact">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <AuthFormHeader title="비밀번호 재설정" />

        <AuthFormField
          label="비밀번호"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            placeholder="새 비밀번호를 입력하세요"
            {...register("password", {
              onChange: () => clearErrors("password"),
            })}
          />
        </AuthFormField>

        <AuthFormField
          label="비밀번호 확인"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            placeholder="새 비밀번호를 다시 입력하세요"
            {...register("confirmPassword", {
              onChange: () => clearErrors("confirmPassword"),
            })}
          />
        </AuthFormField>

        <Button
          disabled={isPending || !isValid}
          type="submit"
          className="w-full"
        >
          {isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isPending ? "변경 중..." : "비밀번호 변경하기"}
        </Button>

        <AuthFormError error={errors.root?.message} />
      </form>
    </AuthCard>
  );
}
