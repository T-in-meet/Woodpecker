"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { OtpPurpose } from "../constants/otp";
import { ForgotPasswordActionState } from "../forgot-password/actions/forgotPasswordActionState";
import { useAuthEmailActionEffect } from "../hooks/useAuthEmailActionEffect";
import { useAuthEmailPrefill } from "../hooks/useAuthEmailPrefill";
import { ResendEmailActionState } from "../resend-email/actions/resendEmailActionState";
import {
  AuthEmailFormInput,
  authEmailFormSchema,
  AuthEmailFormValues,
} from "../schemas/authEmailFormSchema";
import { AuthCard } from "./AuthCard";
import AuthFormError from "./AuthFormError";
import { AuthFormField } from "./AuthFormField";
import { AuthFormHeader } from "./AuthFormHeader";

type AuthEmailFormState = ResendEmailActionState | ForgotPasswordActionState;

type AuthEmailFormProps<TState extends AuthEmailFormState> = {
  action: (
    prevState: Awaited<TState>,
    formData: FormData,
  ) => TState | Promise<TState>;
  initialState: Awaited<TState>;
  email: string | undefined;
  purpose: OtpPurpose;
  title: string;
  backLink: {
    href: string;
    label: string;
  };
};

export const AuthEmailForm = <TState extends AuthEmailFormState>({
  action,
  initialState,
  email,
  purpose,
  title,
  backLink,
}: AuthEmailFormProps<TState>) => {
  const [state, formAction, isPending] = useActionState<TState, FormData>(
    action,
    initialState,
  );

  /**
   * react-hook-form 설정
   *
   * 제네릭 타입 구성:
   *
   * AuthEmailFormInput
   * - 사용자가 입력한 원본 form 값 타입
   * - resolver 실행 전 단계 타입
   * - schema transform / preprocess 적용 전 타입
   *
   * unknown
   * - react-hook-form context 타입
   * - 현재 context를 사용하지 않으므로 unknown 사용
   *
   * AuthEmailFormValues
   * - zod schema 검증 이후 최종 데이터 타입
   * - handleSubmit 콜백에서 전달받는 안전한 값 타입
   *
   * 검증 정책:
   * - 최초 검증: 입력 필드를 터치(onTouched)했을 때 수행
   * - 재검증: 입력 변경(onChange) 시 수행
   *
   * 기본값 정책:
   * - query email이 존재하면 초기값 사용
   * - 없으면 빈 문자열로 controlled input 유지
   */
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setValue,
    clearErrors,
  } = useForm<AuthEmailFormInput, unknown, AuthEmailFormValues>({
    resolver: zodResolver(authEmailFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      email: email ?? "",
    },
  });

  /**
   * 이전 인증 흐름 이메일 prefill
   */
  useAuthEmailPrefill({ setValue });

  /**
   * action 결과(field error / root error)를 UI에 반영한다.
   */
  useAuthEmailActionEffect({ setError, state });

  /**
   * form 제출 처리
   *
   * 역할:
   * - react-hook-form 검증 통과 이후 실행된다.
   * - 실제 요청을 시작하기 전에 이전 root error를 제거한다.
   * - server action 전달 형식(FormData)으로 변환한다.
   * - 인증 목적과 이메일를 action으로 전달한다.
   *
   * 참고:
   * - redirect는 page 단계 bind로 전달되므로
   *   form에서는 purpose / email만 전달한다.
   */
  const onSubmit = handleSubmit((data: AuthEmailFormValues) => {
    /**
     * 클라이언트 검증을 통과해 실제 요청을 시작하므로
     * 이전 요청에서 발생한 root error를 제거한다.
     */
    clearErrors("root");

    /**
     * server action 전달용 FormData 생성
     */
    const formData = new FormData();

    /**
     * 인증 목적 전달
     *
     * signup / reset-password 구분에 사용한다.
     */
    formData.set("purpose", purpose);

    /**
     * 검증 완료된 이메일 전달
     */
    formData.set("email", data.email);

    /**
     * transition 내부에서 action 실행
     *
     * UI 응답성을 유지하면서
     * server action을 호출한다.
     */
    startTransition(() => {
      formAction(formData);
    });
  });

  return (
    <AuthCard variant="compact">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <AuthFormHeader title={title} />

        <AuthFormField
          label="이메일"
          htmlFor={
            purpose === "reset-password"
              ? "forgot-password-email"
              : "resend-email-email"
          }
          error={errors.email?.message}
        >
          <Input
            id={
              purpose === "reset-password"
                ? "forgot-password-email"
                : "resend-email-email"
            }
            type="email"
            /**
             * 접근성:
             * validation 실패 시 screen reader가
             * invalid 상태를 인식할 수 있도록 설정
             */
            aria-invalid={Boolean(errors.email)}
            /**
             * react-hook-form register
             */
            {...register("email", {
              /**
               * 사용자가 이메일을 수정하면
               * 이전 email field error만 제거한다.
               *
               * rate limit / server 같은 SYSTEM root error는
               * 입력 수정으로 해결되지 않으므로 유지한다.
               */
              onChange: () => clearErrors("email"),
            })}
          />
        </AuthFormField>

        {/* 이메일 전송 버튼 */}
        <Button
          type="submit"
          /**
           * 중복 제출 방지
           */
          disabled={isPending}
          className="w-full"
        >
          {isPending
            ? "전송 중..."
            : purpose === "reset-password"
              ? "비밀번호 재설정 인증 번호 받기"
              : "인증 번호 다시 받기"}
        </Button>

        {/* rate limit·서버 오류를 폼 안에 유지한다. */}
        <AuthFormError error={errors.root?.message} />

        {/* 현재 인증 흐름에서 나갈 수 있는 이동 링크 */}
        <Link
          href={backLink.href}
          className="block text-sm text-muted-foreground underline hover:text-foreground"
        >
          {backLink.label}
        </Link>
      </form>
    </AuthCard>
  );
};

export default AuthEmailForm;
