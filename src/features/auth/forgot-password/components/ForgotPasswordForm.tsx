"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forgotPasswordAction,
  type ForgotPasswordActionState,
  INITIAL_FORGOT_PASSWORD_ACTION_STATE,
} from "@/features/auth/forgot-password/actions/forgotPasswordAction";
import { consumeForgotPasswordPrefillEmail } from "@/features/auth/forgot-password/lib/forgotPasswordPrefillMemory";
import { forgotPasswordFormSchema } from "@/features/auth/forgot-password/schemas/forgotPasswordFormSchema";
import { useDebouncedCallback } from "@/features/auth/hooks/useDebouncedCallback";
import { showToast } from "@/lib/utils/showToast";

const DEBOUNCE_DELAY_MS = 300;

const SUCCESS_MESSAGE =
  "가입된 이메일이라면 비밀번호 재설정 메일을 받을 수 있습니다.";
const GLOBAL_ERROR_MESSAGE =
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
const INVALID_RESET_LINK_MESSAGE =
  "비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요.";

// schema 결과를 UI가 바로 사용할 수 있는 단일 에러 메시지 형태로 정규화한다.
function validateEmail(
  email: string,
): { ok: true } | { ok: false; message: string } {
  const parsed = forgotPasswordFormSchema.safeParse({ email });
  if (parsed.success) {
    return { ok: true };
  }

  const message =
    parsed.error.flatten().fieldErrors.email?.[0] ?? GLOBAL_ERROR_MESSAGE;
  return { ok: false, message };
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isClientValid, setIsClientValid] = useState(false);
  const emailRef = useRef("");

  const searchParams = useSearchParams();
  const hasHandledQueryErrorRef = useRef(false);
  const hasHandledPrefillRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    ForgotPasswordActionState,
    FormData
  >(
    forgotPasswordAction.bind(null, null),
    INITIAL_FORGOT_PASSWORD_ACTION_STATE,
  );

  useEffect(() => {
    // query 기반 toast는 최초 1회만 처리한다.
    if (hasHandledQueryErrorRef.current) return;
    hasHandledQueryErrorRef.current = true;

    if (searchParams.get("error") === "invalid_reset_link") {
      showToast(INVALID_RESET_LINK_MESSAGE);
    }
  }, [searchParams]);

  useEffect(() => {
    // prefill은 최초 렌더링 시점에만 소비하고 이후 재주입하지 않는다.
    if (hasHandledPrefillRef.current) return;
    hasHandledPrefillRef.current = true;

    const prefillEmail = consumeForgotPasswordPrefillEmail();
    if (!prefillEmail) return;

    const result = validateEmail(prefillEmail);
    if (result.ok) {
      emailRef.current = prefillEmail;
      setEmail(prefillEmail);
      setError(null);
      setIsClientValid(true);
    }
  }, []);

  useEffect(() => {
    if (state.status === "success") {
      showToast(SUCCESS_MESSAGE);
    }
    if (state.status === "global_error") {
      showToast(GLOBAL_ERROR_MESSAGE);
    }
  }, [state]);

  const { schedule, cancel } = useDebouncedCallback(() => {
    // debounce 시점에는 최신 입력값(ref)을 기준으로 검증한다.
    const result = validateEmail(emailRef.current);
    if (result.ok) {
      setError(null);
      setIsClientValid(true);
    } else {
      setError(result.message);
      setIsClientValid(false);
    }
  }, DEBOUNCE_DELAY_MS);

  const onChangeEmail = (value: string) => {
    emailRef.current = value;
    setEmail(value);
    setIsClientValid(value.trim().length > 0);
    schedule();
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    cancel();

    const trimmedEmail = email.trim();
    const result = validateEmail(trimmedEmail);

    if (!result.ok) {
      event.preventDefault();
      setError(result.message);
      setIsClientValid(false);
      return;
    }

    const emailInput = event.currentTarget.elements.namedItem("email");
    if (emailInput instanceof HTMLInputElement) {
      emailInput.value = trimmedEmail;
    }

    emailRef.current = trimmedEmail;
    setEmail(trimmedEmail);
    setError(null);
    setIsClientValid(true);
  };

  const onEmailKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    formRef.current?.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      className="space-y-3"
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="forgot-password-email">이메일</Label>
        <Input
          id="forgot-password-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => onChangeEmail(event.target.value)}
          onKeyDown={onEmailKeyDown}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "forgot-password-email-error" : undefined}
        />
        {error ? (
          <p
            id="forgot-password-email-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isPending || !isClientValid}>
        {isPending ? "전송 중..." : "비밀번호 재설정 메일 받기"}
      </Button>
    </form>
  );
}
