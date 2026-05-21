"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthenticationError from "@/features/auth/components/AuthenticationError";
import AuthFormFieldError from "@/features/auth/components/AuthFormFieldError";
import { AUTH_GLOBAL_ERROR_MESSAGE } from "@/features/auth/constants/messages";
import { OtpPurpose } from "@/features/auth/constants/otp";
import { RATE_LIMIT_TOAST_MESSAGE } from "@/features/auth/errors/rateLimitError";
import {
  INITIAL_VERIFY_OTP_ACTION_STATE,
  VerifyOtpActionState,
} from "@/features/auth/verify-otp/actions/verifyOtpActionState";
import {
  verifyOtpFormSchema,
  type VerifyOtpFormValues,
} from "@/features/auth/verify-otp/schemas/verifyOtpFormSchema";
import { showToast } from "@/lib/utils/showToast";

type VerifyOtpFormProps = {
  action: (
    prevState: VerifyOtpActionState,
    formData: FormData,
  ) => Promise<VerifyOtpActionState>;
  email: string;
  purpose: OtpPurpose;
};

const VerifyOtpForm = ({ action, email, purpose }: VerifyOtpFormProps) => {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_VERIFY_OTP_ACTION_STATE,
  );

  /**
   * react-form-hook
   */
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { otp: "" },
  });

  /**
   * server action 상태를 RHF 및 UI 상태와 동기화한다.
   *
   * 처리 목적:
   * - 서버에서 반환한 action state를 기반으로
   *   사용자 입력 에러 및 전역 UI 상태를 반영한다.
   *
   * 상태별 처리:
   *
   * - completed:
   *   OTP 인증이 완료된 상태.
   *   action에서 반환한 redirectTo 경로로 이동한다.
   *
   * - invalid_input:
   *   OTP 형식/유효성 검증 실패.
   *   RHF field error로 동기화한다.
   *
   * - invalid_otp:
   *   OTP 인증 실패 상태.
   *   form-level 인증 에러로 표시한다.
   *
   * - blocked:
   *   rate limit 정책에 의해 요청이 차단된 상태.
   *   destructive toast로 안내한다.
   *
   * - internal_error:
   *   사용자가 직접 해결할 수 없는 시스템 오류 상태.
   *   일반화된 글로벌 에러 메시지를 toast로 표시한다.
   */
  useEffect(() => {
    console.log("VerifyOtpForm effect", state);
    switch (state.status) {
      case "invalid_input": {
        const otpError = state.fieldErrors.otp;
        if (!otpError) return;

        setError("otp", {
          type: "server",
          message: otpError,
        });
        return;
      }

      case "invalid_otp":
        setError("root", {
          type: "server",
          message: state.formError,
        });
        return;

      case "blocked":
        showToast(RATE_LIMIT_TOAST_MESSAGE, {
          variant: "destructive",
          dedupeKey: "auth-rate-limit",
        });
        return;

      case "internal_error":
        showToast(AUTH_GLOBAL_ERROR_MESSAGE, {
          variant: "destructive",
          dedupeKey: "auth-global-error",
        });
        return;

      default:
        return;
    }
  }, [state, router, setError]);

  /**
   * 클라이언트 유효성 검증 통과 후 OTP 인증 action 실행
   *
   * 처리 흐름:
   * - react-hook-form + zodResolver를 통해 OTP 형식을 먼저 검증한다.
   * - 검증 통과 시 서버 action에 전달할 FormData를 생성한다.
   * - email / purpose는 page에서 이미 검증된 query 값을 props로 전달받아 사용한다.
   * - 최종 인증 및 보안 검증은 verifyOtpActionSchema에서 다시 수행한다.
   *
   * 검증 책임:
   * - form schema: 사용자 입력값(otp) UI 검증
   * - action schema: 서버 입력 전체(email, purpose, otp) 최종 검증
   */
  const handleValidSubmit = (values: VerifyOtpFormValues) => {
    const formData = new FormData();

    formData.set("email", email);
    formData.set("purpose", purpose);
    formData.set("otp", values.otp);

    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    /**
     * OTP 입력 카드
     *
     * 모바일에서는 화면 전체에 자연스럽게 붙고,
     * md 이상에서는 카드 형태로 중앙 정렬된다.
     */
    <div className="mx-auto my-0 max-w-md overflow-hidden rounded-none border-0 bg-white shadow-none md:my-8 md:rounded-xl md:border md:border-outline-variant md:shadow-sm">
      {/* 인증 안내 영역 */}
      <div className="mx-auto max-w-4xl space-y-4 px-4 pt-8 pb-2 md:px-12">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-primary">
          인증 번호 확인
        </h1>
        <p className="text-gray-500">
          입력하신 이메일로 인증 번호가 전송되었습니다.
          <br />
          인증 번호를 입력하세요
        </p>
      </div>
      {/*  OTP 입력 폼 */}
      <form
        aria-label="인증번호 입력"
        className="space-y-4 mx-auto max-w-4xl pt-2 pb-2 px-4 md:px-12"
        onSubmit={handleSubmit(handleValidSubmit)}
        noValidate
      >
        <div>
          <Input
            id="verify-otp"
            type="text"
            autoComplete="one-time-code" // 사용자를 인증할 때 사용하는 1회성 코드.
            inputMode="numeric" // inputMode: 어떤 키보드를 보여줄지에 대한 힌트: 숫자형 키보드를 제공
            placeholder="예: 123456"
            {...register("otp", {
              onChange: () => clearErrors(),
            })}
            autoFocus
          />
          {/* 유효성 에러 */}
          <AuthFormFieldError error={errors.otp} />
        </div>
        <div className="mx-auto max-w-4xl">
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? "인증 중..." : "인증하기"}
          </Button>
        </div>
        {/* 인증 실패 */}
        <AuthenticationError error={errors.root} />
      </form>
    </div>
  );
};

export default VerifyOtpForm;
