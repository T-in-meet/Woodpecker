"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  initialResetPasswordActionState,
  type ResetPasswordActionState,
} from "@/features/auth/reset-password/actions/resetPasswordAction";
import { resetPasswordFormSchema } from "@/features/auth/reset-password/schemas/resetPasswordFormSchema";

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

const DEBOUNCE_DELAY_MS = 300;
const GLOBAL_ERROR_MESSAGE =
  "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.";

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
    initialResetPasswordActionState,
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

  const visibleFieldErrors = useMemo(() => {
    if (hasClientErrors(clientErrors)) {
      return clientErrors;
    }
    if (state.status === "field_error") {
      return state.fieldErrors;
    }
    return {};
  }, [clientErrors, state]);

  const showGlobalError =
    state.status === "global_error" && !hasClientErrors(clientErrors);

  const scheduleValidation = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setTimeout(() => {
      const formElement = formRef.current;
      if (!formElement) {
        return;
      }

      const errors = toClientErrors(new FormData(formElement));
      setClientErrors(errors);
      timerRef.current = null;
    }, DEBOUNCE_DELAY_MS);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const errors = toClientErrors(new FormData(event.currentTarget));
    setClientErrors(errors);
    if (hasClientErrors(errors)) {
      event.preventDefault();
    }
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} ref={formRef}>
      <label htmlFor="password">비밀번호</label>
      <input
        id="password"
        name="password"
        type="password"
        onChange={scheduleValidation}
      />
      {visibleFieldErrors.password?.map((error) => (
        <p key={`password-${error}`}>{error}</p>
      ))}

      <label htmlFor="confirmPassword">비밀번호 확인</label>
      <input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        onChange={scheduleValidation}
      />
      {visibleFieldErrors.confirmPassword?.map((error) => (
        <p key={`confirmPassword-${error}`}>{error}</p>
      ))}

      {showGlobalError ? <p>{state.message || GLOBAL_ERROR_MESSAGE}</p> : null}

      <button
        disabled={isPending || hasClientErrors(clientErrors)}
        type="submit"
      >
        {isPending ? "변경 중..." : "비밀번호 변경하기"}
      </button>
    </form>
  );
}
