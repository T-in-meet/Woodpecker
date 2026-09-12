"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import AuthFormError from "@/features/auth/components/AuthFormError";
import { AuthFormField } from "@/features/auth/components/AuthFormField";
import { AuthFormHeader } from "@/features/auth/components/AuthFormHeader";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import {
  AUTH_ROOT_ERROR_TYPE,
  shouldClearRootOnInputChange,
} from "@/features/auth/errors/authRootError";
import {
  INITIAL_RESET_PASSWORD_ACTION_STATE,
  ResetPasswordActionState,
} from "@/features/auth/reset-password/actions/resetPasswordActionState";
import {
  RESET_PASSWORD_GLOBAL_ERROR_MESSAGE,
  RESET_PASSWORD_PAGE_LEAVE_CONFIRM_MESSAGE,
  RESET_PASSWORD_SAME_PASSWORD_MESSAGE,
} from "@/features/auth/reset-password/constants/messages";
import {
  type ResetPasswordFormInput,
  resetPasswordFormSchema,
} from "@/features/auth/reset-password/schemas/resetPasswordFormSchema";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";

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
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  /**
   * 현재 root error가 입력 수정으로 해결 가능한 ATTEMPT 오류일 때만 제거한다.
   *
   * same_password는 새 password 값 자체와 관련된 실패이므로
   * password를 수정할 때만 제거한다.
   */
  const clearAttemptRootError = () => {
    if (shouldClearRootOnInputChange(errors.root?.type)) {
      clearErrors("root");
    }
  };

  /**
   * Server Action 결과를 React Hook Form error로 연결한다.
   *
   * - invalid_input → 해당 field error
   * - same_password → ATTEMPT root error
   * - 기타 internal_error → SYSTEM root error
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
      const isSamePassword = state.reason === "same_password";

      setError("root", {
        type: isSamePassword
          ? AUTH_ROOT_ERROR_TYPE.ATTEMPT
          : AUTH_ROOT_ERROR_TYPE.SYSTEM,
        message: isSamePassword
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
    /**
     * 클라이언트 검증을 통과해 실제 비밀번호 변경 요청을 시작하므로
     * 이전 root error를 종류와 관계없이 제거한다.
     */
    clearErrors("root");

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
              onChange: () => {
                clearErrors("password");
                clearAttemptRootError();
              },
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
