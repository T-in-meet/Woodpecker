"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import {
  ForgotPasswordActionState,
  INITIAL_FORGOT_PASSWORD_ACTION_STATE,
} from "@/features/auth/forgot-password/actions/forgotPasswordActionState";
import {
  FORGOT_PASSWORD_GLOBAL_ERROR_MESSAGE,
  FORGOT_PASSWORD_INVALID_RESET_LINK_MESSAGE,
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
} from "@/features/auth/forgot-password/constants/messages";
import { consumeForgotPasswordPrefillEmail } from "@/features/auth/forgot-password/lib/forgotPasswordPrefillMemory";
import {
  ForgotPasswordFormInput,
  forgotPasswordFormSchema,
  ForgotPasswordFormValues,
} from "@/features/auth/forgot-password/schemas/forgotPasswordFormSchema";
import { showToast } from "@/lib/utils/showToast";

type ForgotPasswordFormProps = {
  action: (
    prevState: ForgotPasswordActionState,
    formData: FormData,
  ) => Promise<ForgotPasswordActionState>;
};

export function ForgotPasswordForm({ action }: ForgotPasswordFormProps) {
  const searchParams = useSearchParams();
  const hasHandledQueryErrorRef = useRef(false);
  const hasHandledPrefillRef = useRef(false);

  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_FORGOT_PASSWORD_ACTION_STATE,
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ForgotPasswordFormInput, unknown, ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { email: "" },
  });

  // callback에서 invalid_reset_link로 돌아온 경우 사용자에게 한 번만 안내한다.
  // searchParams 변경이나 리렌더링으로 같은 toast가 반복 출력되지 않도록 ref로 처리 여부를 기록한다.
  useEffect(() => {
    // query 기반 toast는 최초 1회만 처리한다.
    if (hasHandledQueryErrorRef.current) return;
    hasHandledQueryErrorRef.current = true;

    if (searchParams.get("error") === "invalid_reset_link") {
      showToast(FORGOT_PASSWORD_INVALID_RESET_LINK_MESSAGE);
    }
  }, [searchParams]);

  // reset link 실패 후 forgot-password로 돌아온 경우 이전 이메일을 한 번만 복원한다.
  // react-hook-form 상태와 validation 상태를 함께 갱신하기 위해 setValue를 사용한다.
  useEffect(() => {
    // prefill은 최초 렌더링 시점에만 소비하고 이후 재주입하지 않는다.
    if (hasHandledPrefillRef.current) return;
    hasHandledPrefillRef.current = true;

    const prefillEmail = consumeForgotPasswordPrefillEmail();
    if (!prefillEmail) return;

    const parsed = forgotPasswordFormSchema.safeParse({ email: prefillEmail });
    if (!parsed.success) return;

    setValue("email", parsed.data.email, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [setValue]);

  // Server Action 결과 상태에 따라 사용자 피드백을 출력한다.
  // 필드 validation은 react-hook-form이 담당하고, 서버 결과는 전역 toast로 처리한다.
  useEffect(() => {
    if (state.status === "completed") {
      showToast(FORGOT_PASSWORD_SUCCESS_MESSAGE);
    }
    if (state.status === "blocked") {
      showToast(RATE_LIMIT_TOAST_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-rate-limit",
      });
    }
    if (state.status === "internal_error") {
      showToast(FORGOT_PASSWORD_GLOBAL_ERROR_MESSAGE);
    }
  }, [state]);

  // react-hook-form 검증을 통과한 값만 Server Action에 전달한다.
  // native form action과 handleSubmit은 충돌할 수 있으므로 FormData를 직접 구성해 dispatch한다.
  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.set("email", data.email);

    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <div className="mx-auto my-0 max-w-md overflow-hidden rounded-none border-0 bg-white p-16 shadow-none md:my-8 md:max-w-2xl md:rounded-xl md:border md:border-outline-variant md:shadow-sm">
      <form
        onSubmit={onSubmit}
        className="space-y-3 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:gap-x-4 md:space-y-0"
        noValidate
      >
        <Label
          htmlFor="forgot-password-email"
          className="md:h-10 md:leading-10"
        >
          이메일
        </Label>

        <div className="space-y-2">
          <Input
            id="forgot-password-email"
            type="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? "forgot-password-email-error" : undefined
            }
            {...register("email")}
          />
          {errors.email ? (
            <p
              id="forgot-password-email-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="md:h-10 md:shrink-0"
        >
          {isPending ? "전송 중..." : "비밀번호 재설정 메일 받기"}
        </Button>
      </form>
    </div>
  );
}
