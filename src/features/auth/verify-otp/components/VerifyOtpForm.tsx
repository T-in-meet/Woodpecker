"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/features/auth/components/AuthCard";
import AuthFormError from "@/features/auth/components/AuthFormError";
import AuthFormFieldError from "@/features/auth/components/AuthFormFieldError";
import { AuthFormHeader } from "@/features/auth/components/AuthFormHeader";
import { AUTH_GLOBAL_ERROR_MESSAGE } from "@/features/auth/constants/messages";
import { OtpPurpose } from "@/features/auth/constants/otp";
import {
  AUTH_ROOT_ERROR_TYPE,
  shouldClearRootOnInputChange,
} from "@/features/auth/errors/authRootError";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import {
  INITIAL_VERIFY_OTP_ACTION_STATE,
  VerifyOtpActionState,
} from "@/features/auth/verify-otp/actions/verifyOtpActionState";
import {
  verifyOtpFormSchema,
  type VerifyOtpFormValues,
} from "@/features/auth/verify-otp/schemas/verifyOtpFormSchema";
import { ROUTES } from "@/lib/constants/routes";

type VerifyOtpFormProps = {
  action: (
    prevState: VerifyOtpActionState,
    formData: FormData,
  ) => Promise<VerifyOtpActionState>;
  email: string;
  purpose: OtpPurpose;
  redirect?: string | null;
};

const VerifyOtpForm = ({
  action,
  email,
  purpose,
  redirect,
}: VerifyOtpFormProps) => {
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_VERIFY_OTP_ACTION_STATE,
  );

  /**
   * react-form-hook
   *
   * OTP는 입력값이 올바른 경우에만 인증 버튼을 활성화하기 위해
   * 입력이 변경될 때마다 schema validation을 수행한다.
   */
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setError,
    clearErrors,
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { otp: "" },
  });

  /**
   * 현재 root error가 입력 수정으로 해결 가능한 ATTEMPT 오류일 때만 제거한다.
   *
   * Verify OTP에서는 otp가 인증 시도에 직접 관련된 유일한 입력값이다.
   */
  const clearAttemptRootError = () => {
    if (shouldClearRootOnInputChange(errors.root?.type)) {
      clearErrors("root");
    }
  };

  /**
   * Server Action에서 반환한 상태를
   * React Hook Form의 error 구조로 연결한다.
   *
   * 에러는 크게 네 종류로 구분한다.
   *
   * 1. invalid_input
   *    사용자가 OTP 입력값을 직접 수정해서 해결할 수 있는 오류다.
   *    예: OTP 길이가 부족하거나 숫자 형식이 아닌 경우.
   *
   *    → errors.otp에 저장
   *    → OTP 입력창 아래 AuthFormFieldError에서 표시
   *
   * 2. invalid_otp
   *    현재 OTP 인증 시도에 대한 실패다.
   *
   *    → ATTEMPT root error
   *    → OTP 입력 수정 시 제거
   *
   * 3. blocked / internal_error
   *    입력 수정으로 해결되지 않는 요청 전체의 오류다.
   *
   *    → SYSTEM root error
   *    → 입력 수정으로 유지
   *    → 다음 실제 요청 시작 시 제거
   *
   * 4. invalid_request
   *    OTP 값의 문제가 아니라 인증 흐름 자체에 필요한
   *    email / purpose / redirect 등의 요청 정보가 유효하지 않은 상태다.
   *
   *    사용자가 OTP 입력값을 수정해도 해결할 수 없기 때문에
   *    현재 화면에 에러 메시지만 표시하지 않고
   *    resend-email 페이지로 이동하여 인증 흐름을 다시 복구한다.
   */
  useEffect(() => {
    switch (state.status) {
      case "invalid_request": {
        /**
         * 현재 OTP 인증 요청의 context가 잘못된 상태다.
         *
         * 잘못된 email / redirect 값을 다시 전달하지 않고,
         * page에서 이미 검증되어 props로 전달된 purpose만 유지한다.
         *
         * resend-email에서 이메일을 다시 입력한 후
         * 새로운 OTP 인증 흐름을 시작할 수 있다.
         */
        const params = new URLSearchParams({
          purpose,
        });

        router.replace(`${ROUTES.RESEND_EMAIL}?${params.toString()}`);
        return;
      }

      case "invalid_input": {
        /**
         * OTP 입력 형식 오류.
         *
         * 사용자가 OTP 입력값을 수정해서 해결할 수 있으므로
         * field error로 처리한다.
         */
        const otpError = state.fieldErrors.otp;
        if (!otpError) return;

        setError("otp", {
          type: "server",
          message: otpError,
        });
        return;
      }

      case "invalid_otp":
        /**
         * OTP 형식은 올바르지만 실제 인증에 실패한 경우.
         *
         * OTP 불일치 / 만료 / 재발급으로 인한 무효화 등을
         * 구체적으로 구분하지 않고 안전한 공통 메시지를 표시한다.
         *
         * 현재 인증 시도에 대한 실패이므로
         * ATTEMPT root error로 처리한다.
         */
        setError("root", {
          type: AUTH_ROOT_ERROR_TYPE.ATTEMPT,
          message: state.formError,
        });
        return;

      case "blocked":
        /**
         * Rate Limit에 의해 요청이 차단된 경우.
         *
         * 사용자의 OTP 입력값을 수정해도 해결되지 않으므로
         * SYSTEM root error로 표시한다.
         */
        setError("root", {
          type: AUTH_ROOT_ERROR_TYPE.SYSTEM,
          message: RATE_LIMIT_TOAST_MESSAGE,
        });
        return;

      case "internal_error":
        /**
         * 네트워크 / Supabase / 예상하지 못한 서버 오류 등
         * 사용자가 입력값을 수정해서 해결할 수 없는 시스템 오류다.
         *
         * 내부 오류 원문은 사용자에게 노출하지 않고
         * 안전한 공통 메시지를 SYSTEM root error로 표시한다.
         */
        setError("root", {
          type: AUTH_ROOT_ERROR_TYPE.SYSTEM,
          message: AUTH_GLOBAL_ERROR_MESSAGE,
        });
        return;

      default:
        return;
    }
  }, [state, setError, router, purpose]);

  /**
   * 클라이언트 유효성 검증 통과 후 OTP 인증 action 실행
   *
   * 처리 흐름:
   * - react-hook-form + zodResolver를 통해 OTP 형식을 먼저 검증한다.
   * - 검증 통과 시 이전 요청의 root error를 제거한다.
   * - 서버 action에 전달할 FormData를 생성한다.
   * - email / purpose는 page에서 이미 검증된 query 값을 props로 전달받아 사용한다.
   * - 서버에서는 verifyOtpContextSchema와 otpSchema를 통해
   *   요청 context와 OTP 입력값을 다시 검증한다.
   *
   * 검증 책임:
   * - form schema: 사용자 입력값(otp) UI 검증
   * - context schema: email / purpose / redirect 서버 검증
   * - otp schema: OTP 입력값 서버 재검증
   */
  const handleValidSubmit = (values: VerifyOtpFormValues) => {
    /**
     * 클라이언트 검증을 통과해 실제 인증 요청을 시작하므로
     * 이전 root error를 종류와 관계없이 제거한다.
     */
    clearErrors("root");

    const formData = new FormData();

    formData.set("email", email);
    formData.set("purpose", purpose);
    formData.set("otp", values.otp);

    startTransition(() => {
      formAction(formData);
    });
  };

  const query = new URLSearchParams({
    purpose,
    email,
  });

  if (redirect) {
    query.set("redirect", redirect);
  }

  /**
   * resend-email에서 현재 OTP 인증 단계로 돌아올 수 있도록
   * 현재 verify-otp 경로를 returnTo로 전달한다.
   *
   * returnTo에는 현재 인증 흐름에 필요한
   * purpose / email / redirect를 그대로 보존한다.
   */
  const returnTo = `${ROUTES.VERIFY_OTP}?${query.toString()}`;

  query.set("returnTo", returnTo);

  return (
    <AuthCard variant="compact">
      <form
        aria-label="인증번호 입력"
        className="space-y-4"
        onSubmit={handleSubmit(handleValidSubmit)}
        noValidate
      >
        <AuthFormHeader title="인증 번호 확인" />

        <p className="text-sm text-muted-foreground">
          이메일로 받은 인증번호를 입력하세요.
        </p>

        <div>
          <Input
            id="verify-otp"
            type="text"
            autoComplete="one-time-code" // 사용자를 인증할 때 사용하는 1회성 코드.
            inputMode="numeric" // inputMode: 어떤 키보드를 보여줄지에 대한 힌트: 숫자형 키보드를 제공
            placeholder="예: 123456"
            {...register("otp", {
              /**
               * OTP를 수정하면 field error를 제거하고,
               * 이전 root error가 ATTEMPT인 경우에만 함께 제거한다.
               *
               * SYSTEM root error는 입력 수정으로 해결되지 않으므로 유지한다.
               */
              onChange: () => {
                clearErrors("otp");
                clearAttemptRootError();
              },
            })}
            autoFocus
          />
          <AuthFormFieldError error={errors.otp?.message} />
        </div>

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            인증번호가 오지 않으면 수신함과 스팸함을 확인하거나 다시
            요청해주세요.
          </p>
          <Link
            href={`${ROUTES.RESEND_EMAIL}?${query.toString()}`}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            인증번호 재전송
          </Link>
        </div>

        <Button
          className="w-full"
          type="submit"
          disabled={isPending || !isValid}
        >
          {isPending ? "인증 중..." : "인증하기"}
        </Button>

        <AuthFormError error={errors.root?.message} />
      </form>
    </AuthCard>
  );
};

export default VerifyOtpForm;
