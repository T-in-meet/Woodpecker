"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { OAuthButtons } from "@/features/auth/components/OAuthButtons";
import {
  GLOBAL_ERROR_MESSAGES,
  isGlobalError,
} from "@/features/auth/errors/globalError";
import {
  isRateLimitError,
  RATE_LIMIT_TOAST_MESSAGE,
} from "@/features/auth/errors/rateLimitError";
import { UNKNOWN_ERROR_MESSAGE } from "@/features/auth/errors/unknownError";
import {
  resolveFieldName,
  SIGNUP_FIELD_NAMES,
} from "@/features/auth/lib/resolveFieldName";
import { AgreementSection } from "@/features/auth/signup/components/AgreementSection";
import { EmailSignupFields } from "@/features/auth/signup/components/EmailSignupFields";
import { SignupActions } from "@/features/auth/signup/components/SignupActions";
import { signupFormSchema } from "@/features/auth/signup/schema/signupFormSchema";
import { cn } from "@/lib/utils/cn";
import { showToast } from "@/lib/utils/showToast";
import { isServerValidationError } from "@/lib/validation/isServerValidationError";
import { mapReasonToMessage } from "@/lib/validation/mapReasonToMessage";

/**
 * signup 폼에서 처리 가능한 필드 이름 집합
 * resolveFieldName에 주입하여 서버 field → 폼 필드 매핑에 사용한다
 */
const SIGNUP_FIELD_NAME_SET = new Set(SIGNUP_FIELD_NAMES);

/**
 * 회원가입 방식 값 목록
 */
const SIGNUP_METHODS = {
  email: "email",
  google: "google",
} as const;

/**
 * 사용자가 선택할 수 있는 회원가입 방식
 */
type SignupMethod = (typeof SIGNUP_METHODS)[keyof typeof SIGNUP_METHODS];

/**
 * signup 폼 입력 타입 (raw input 기준)
 */
export type FormInput = z.input<typeof signupFormSchema>;

/**
 * validation 이후 확정된 값 타입
 */
export type FormValues = z.infer<typeof signupFormSchema>;

/**
 * API로 전달되는 payload
 */
type SubmitPayload = Omit<FormValues, "confirmPassword">;

/**
 * SignupForm Props
 */
export type SignupFormProps = {
  onSubmit: (values: SubmitPayload) => void | Promise<void>;
  isPending?: boolean;
  initialSignupMethod?: SignupMethod;
  signupNotice?: string;
};

/**
 * unknown 값을 문자열로 정규화한다.
 */
function normalizeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

/**
 * unknown 값을 체크 여부로 정규화한다.
 */
function normalizeChecked(value: unknown) {
  return value === true;
}

/**
 * 회원가입 폼 컴포넌트
 */
export function SignupForm({
  onSubmit,
  isPending = false,
  initialSignupMethod,
  signupNotice,
}: SignupFormProps) {
  const [signupMethod, setSignupMethod] = useState<SignupMethod | null>(
    initialSignupMethod ?? null,
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    getValues,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      nickname: "",
      termsOfService: false,
      privacyPolicyAcknowledged: false,
      age14OrOlder: false,
    },
  });

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const loginLinkRef = useRef<HTMLAnchorElement>(null);

  const { onChange: onPasswordChange, ...passwordRegister } =
    register("password");
  const { onChange: onConfirmChange, ...confirmPasswordRegister } =
    register("confirmPassword");

  const [
    rawEmail,
    rawPassword,
    rawConfirmPassword,
    rawNickname,
    rawTermsOfService,
    rawPrivacyPolicyAcknowledged,
    rawAge14OrOlder,
  ] = watch([
    "email",
    "password",
    "confirmPassword",
    "nickname",
    "termsOfService",
    "privacyPolicyAcknowledged",
    "age14OrOlder",
  ]);

  const watchedEmail = normalizeText(rawEmail);
  const watchedPassword = normalizeText(rawPassword);
  const watchedConfirmPassword = normalizeText(rawConfirmPassword);
  const watchedNickname = normalizeText(rawNickname);
  const watchedTermsOfService = normalizeChecked(rawTermsOfService);
  const watchedPrivacyPolicyAcknowledged = normalizeChecked(
    rawPrivacyPolicyAcknowledged,
  );
  const watchedAge14OrOlder = normalizeChecked(rawAge14OrOlder);

  const isSubmitButtonVisuallyEnabled =
    watchedEmail.trim().length > 0 &&
    watchedPassword.trim().length > 0 &&
    watchedConfirmPassword.trim().length > 0 &&
    watchedNickname.trim().length > 0 &&
    watchedTermsOfService &&
    watchedPrivacyPolicyAcknowledged &&
    watchedAge14OrOlder;

  /**
   * 유효한 폼 제출 시 상위 submit handler를 호출한다.
   */
  const handleValidSubmit = async (data: FormValues) => {
    const { confirmPassword: _, ...payload } = data;

    clearErrors();

    try {
      await onSubmit(payload);
    } catch (e: unknown) {
      if (isServerValidationError(e)) {
        let hasUnknownField = false;

        for (const { field, reason } of e.data.errors) {
          const fieldName = resolveFieldName(field, SIGNUP_FIELD_NAME_SET);
          const message = mapReasonToMessage(reason);

          if (fieldName !== null) {
            setError(fieldName, { message });
          } else {
            hasUnknownField = true;
          }
        }

        if (hasUnknownField) {
          setError("root", { message: "요청을 처리할 수 없습니다" });
        }

        return;
      }

      if (isRateLimitError(e)) {
        showToast(RATE_LIMIT_TOAST_MESSAGE, {
          variant: "destructive",
          dedupeKey: "auth-rate-limit",
        });
        return;
      }

      if (isGlobalError(e)) {
        showToast(GLOBAL_ERROR_MESSAGES[e.type], {
          variant: "destructive",
          dedupeKey: `auth-global-${e.type}`,
        });
        return;
      }

      showToast(UNKNOWN_ERROR_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-unknown-error",
      });
    }
  };

  /**
   * password 변경 시 confirmPassword를 재검증한다.
   */
  const handlePasswordChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      await onPasswordChange(e);

      if (getValues("confirmPassword")) {
        await trigger("confirmPassword");
      }
    },
    [getValues, onPasswordChange, trigger],
  );

  /**
   * confirmPassword 변경 시 비밀번호 일치 여부를 재검증한다.
   */
  const handleConfirmPasswordChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      await onConfirmChange(e);
      await trigger("confirmPassword");
    },
    [onConfirmChange, trigger],
  );

  /**
   * OAuth 회원가입 전 공통 필수 약관 동의 intent를 저장한다.
   */
  const handleOAuthBeforeSignIn = async () => {
    if (
      watchedTermsOfService &&
      watchedPrivacyPolicyAcknowledged &&
      watchedAge14OrOlder
    ) {
      try {
        const response = await fetch("/api/auth/oauth/agreement-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agreements: {
              termsOfService: true,
              privacyPolicyAcknowledged: true,
              age14OrOlder: true,
            },
          }),
        });

        if (response.ok) {
          return true;
        }
      } catch {
        // 아래 공통 toast로 OAuth 시작 실패를 안내한다.
      }

      showToast(
        "소셜 회원가입을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.",
        {
          variant: "destructive",
          dedupeKey: "auth-oauth-agreement-intent",
        },
      );
      return false;
    }

    showToast(
      "이용약관 동의, 개인정보 처리방침 확인, 만 14세 이상 확인이 필요합니다.",
      {
        variant: "destructive",
        dedupeKey: "auth-signup-agreements-required",
      },
    );
    return false;
  };

  return (
    <div className="my-0 md:my-4 mx-auto max-w-2xl bg-white border-0 md:border md:border-outline-variant md:rounded-xl rounded-none md:shadow-sm shadow-none overflow-hidden">
      <form
        aria-label="회원가입"
        className="mx-auto max-w-4xl space-y-6 py-7 px-4 md:px-8"
        onSubmit={handleSubmit(handleValidSubmit)}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            계정 만들기
          </h1>
          <p className="text-sm text-muted-foreground">
            가입 방식을 선택하고 필수 약관에 동의해주세요.
          </p>
        </div>

        {signupNotice ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <p>{signupNotice}</p>
          </div>
        ) : null}

        <section aria-labelledby="signup-method-heading" className="space-y-3">
          <h2
            id="signup-method-heading"
            className="text-sm font-semibold text-foreground"
          >
            가입 방식
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={signupMethod === SIGNUP_METHODS.email}
              className={cn(
                "h-auto justify-start px-4 py-3 text-left",
                signupMethod === SIGNUP_METHODS.email &&
                  "border-primary bg-primary/5 text-primary",
              )}
              onClick={() => setSignupMethod(SIGNUP_METHODS.email)}
            >
              이메일로 가입
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={signupMethod === SIGNUP_METHODS.google}
              className={cn(
                "h-auto justify-start px-4 py-3 text-left",
                signupMethod === SIGNUP_METHODS.google &&
                  "border-primary bg-primary/5 text-primary",
              )}
              onClick={() => setSignupMethod(SIGNUP_METHODS.google)}
            >
              Google로 가입
            </Button>
          </div>
        </section>

        {signupMethod === SIGNUP_METHODS.email && (
          <EmailSignupFields
            errors={errors}
            nicknameRegister={register("nickname")}
            emailRegister={register("email")}
            passwordRegister={passwordRegister}
            confirmPasswordRegister={confirmPasswordRegister}
            onPasswordChange={handlePasswordChange}
            onConfirmPasswordChange={handleConfirmPasswordChange}
          />
        )}

        {signupMethod === SIGNUP_METHODS.google && (
          <p className="text-sm text-muted-foreground">
            Google 계정으로 가입합니다. 계속하기 전에 아래 필수 약관 동의가
            필요합니다.
          </p>
        )}

        {signupMethod && (
          <AgreementSection
            control={control}
            errors={errors}
            setValue={setValue}
            submitButtonRef={submitButtonRef}
            loginLinkRef={loginLinkRef}
          />
        )}

        {signupMethod === SIGNUP_METHODS.google && (
          <OAuthButtons
            intent="signup"
            beforeSignIn={handleOAuthBeforeSignIn}
            showSeparator={false}
          />
        )}

        {signupMethod === SIGNUP_METHODS.email && (
          <SignupActions
            rootError={errors.root}
            isPending={isPending}
            isSubmitButtonVisuallyEnabled={isSubmitButtonVisuallyEnabled}
            submitButtonRef={submitButtonRef}
          />
        )}

        <p className="text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link
            ref={loginLinkRef}
            href="/login"
            className="text-muted-foreground underline hover:text-foreground"
          >
            로그인
          </Link>
        </p>
      </form>
    </div>
  );
}
