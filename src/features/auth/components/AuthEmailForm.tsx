"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type AuthEmailFormState = ResendEmailActionState | ForgotPasswordActionState;

type AuthEmailFormProps<TState extends AuthEmailFormState> = {
  action: (
    prevState: Awaited<TState>,
    formData: FormData,
  ) => TState | Promise<TState>;
  initialState: Awaited<TState>;
  email: string | undefined;
  purpose: OtpPurpose;
};

export const AuthEmailForm = <TState extends AuthEmailFormState>({
  action,
  initialState,
  email,
  purpose,
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
   * action 결과(field error / toast)를 UI에 반영한다.
   */
  useAuthEmailActionEffect({ setError, state });

  /**
   * form 제출 처리
   *
   * 역할:
   * - react-hook-form 검증 통과 이후 실행된다.
   * - server action 전달 형식(FormData)으로 변환한다.
   * - 인증 목적과 이메일를 action으로 전달한다.
   *
   * 참고:
   * - redirect는 page 단계 bind로 전달되므로
   *   form에서는 purpose / email만 전달한다.
   */
  const onSubmit = handleSubmit((data: AuthEmailFormValues) => {
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
    <div className="mx-auto my-0 max-w-md overflow-hidden rounded-none border-0 bg-white p-16 shadow-none md:my-8 md:max-w-2xl md:rounded-xl md:border md:border-outline-variant md:shadow-sm">
      {/* 이메일 재전송 form */}
      <form
        onSubmit={onSubmit}
        className="space-y-3 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:gap-x-4 md:space-y-0"
        noValidate
      >
        {/* 이메일 입력 라벨 */}
        <Label
          htmlFor={
            purpose === "reset-password"
              ? "forgot-password-email"
              : "resend-email-email"
          }
          className="md:h-10 md:leading-10"
        >
          이메일
        </Label>

        {/* 이메일 입력 영역 */}
        <div className="space-y-2">
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
             * 접근성:
             * validation 에러 발생 시
             * 에러 메시지 영역과 연결
             */
            aria-describedby={
              errors.email
                ? purpose === "reset-password"
                  ? "forgot-password-email-error"
                  : "resend-email-email-error"
                : undefined
            }
            /**
             * react-hook-form register
             */
            {...register("email", {
              /**
               * 사용자가 이메일을 수정하면
               * 이전 제출 결과에서 발생한 form/server error를 모두 제거한다.
               */
              onChange: () => clearErrors(),
            })}
          />

          {/* 이메일 validation 에러 */}
          {errors.email ? (
            <p
              id={
                purpose === "reset-password"
                  ? "forgot-password-email-error"
                  : "resend-email-email-error"
              }
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.email.message}
            </p>
          ) : null}
        </div>

        {/* 이메일 전송 버튼 */}
        <Button
          type="submit"
          /**
           * 중복 제출 방지
           */
          disabled={isPending}
          className="md:h-10 md:shrink-0"
        >
          {isPending
            ? "전송 중..."
            : purpose === "reset-password"
              ? "비밀번호 재설정 인증 번호 받기"
              : "인증 번호 다시 받기"}
        </Button>
      </form>
    </div>
  );
};

export default AuthEmailForm;
