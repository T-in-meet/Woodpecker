"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNKNOWN_ERROR_MESSAGE } from "@/features/auth/errors//unknownError";
import {
  GLOBAL_ERROR_MESSAGES,
  isGlobalError,
} from "@/features/auth/errors/globalError";
import {
  isRateLimitError,
  RATE_LIMIT_TOAST_MESSAGE,
} from "@/features/auth/errors/rateLimitError";
import { resolveFieldName } from "@/features/auth/lib/resolveFieldName";
import { LegalDialogWrapper } from "@/features/auth/signup/components/LegalDialogWrapper";
import { signupFormSchema } from "@/features/auth/signup/schema/signupFormSchema";
import { cn } from "@/lib/utils/cn";
import { showToast } from "@/lib/utils/showToast";
import { isServerValidationError } from "@/lib/validation/isServerValidationError";
import { mapReasonToMessage } from "@/lib/validation/mapReasonToMessage";

/**
 * 폼 입력 타입 (raw input 기준)
 * - nullable / optional 상태 포함
 */
export type FormInput = z.input<typeof signupFormSchema>;

/**
 * validation 이후 확정된 값 타입
 */
type FormValues = z.infer<typeof signupFormSchema>;

/**
 * API로 전달되는 payload
 * - confirmPassword는 서버로 보내지 않음
 */
type SubmitPayload = Omit<FormValues, "confirmPassword">;

/**
 * SignupForm Props
 * - onSubmit: 상위에서 API 호출 담당
 * - isPending: 요청 상태 (중복 제출 방지 / UI 제어)
 */
type SignupFormProps = {
  onSubmit: (values: SubmitPayload) => void | Promise<void>;
  isPending?: boolean;
};

/**
 * 회원가입 폼 컴포넌트
 *
 * 책임:
 * - 입력 UI
 * - validation (RHF + Zod)
 * - 에러 처리 (field / global)
 *
 * 비책임:
 * - API 호출
 * - 라우팅
 */
export function SignupForm({ onSubmit, isPending = false }: SignupFormProps) {
  /**
   * react-hook-form 설정
   */
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      nickname: "",
      termsOfService: false,
      privacyPolicy: false,
    },
  });

  /**
   * UI 상호작용 상태 — RHF form field가 아니므로 useState로 관리
   * interactionEnabled: 모달을 한번이라도 열고 닫아야 true로 전환
   * 이유: HTML disabled 금지 스펙 — aria-disabled + 인터셉트 방식으로 대체
   */
  const [termsInteractionEnabled, setTermsInteractionEnabled] = useState(false);
  const [privacyInteractionEnabled, setPrivacyInteractionEnabled] =
    useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsOpenedByLabel, setTermsOpenedByLabel] = useState(false);
  const [privacyOpenedByLabel, setPrivacyOpenedByLabel] = useState(false);

  /**
   * focus fallback 대상 refs
   * Checkbox 컴포넌트가 forwardRef를 지원하므로
   * checkboxRef.current.focus()로 포커스 복원 가능
   */
  const termsCheckboxRef = useRef<HTMLButtonElement>(null);
  const privacyCheckboxRef = useRef<HTMLButtonElement>(null);

  /**
   * password / confirmPassword 분리
   * - onChange 커스터마이징 위해
   */
  const { onChange: onPasswordChange, ...passwordRegister } =
    register("password");
  const { onChange: onConfirmChange, ...confirmPasswordRegister } =
    register("confirmPassword");

  /**
   * 유효한 폼 제출 시 실행
   */
  const handleValidSubmit = async (data: FormValues) => {
    /**
     * confirmPassword 제거
     */
    const { confirmPassword: _, ...payload } = data;

    /**
     * 기존 에러 초기화
     */
    clearErrors();

    try {
      /**
       * 실제 API 호출은 상위에서 수행
       */
      await onSubmit(payload);
    } catch (e: unknown) {
      /**
       * 서버 validation 에러 처리
       */
      if (isServerValidationError(e)) {
        let hasUnknownField = false;

        for (const { field, reason } of e.data.errors) {
          const fieldName = resolveFieldName(field);
          const message = mapReasonToMessage(reason);

          if (fieldName !== null) {
            setError(fieldName, { message });
          } else {
            hasUnknownField = true;
          }
        }

        /**
         * 매핑 불가능한 필드 존재 시 root 에러
         */
        if (hasUnknownField) {
          setError("root", { message: "요청을 처리할 수 없습니다" });
        }

        return;
      }

      /**
       * rate limit 에러 처리
       *
       * 동작:
       * - 서버 failure response body의 `code`를 기반으로 rate limit 여부를 판별한다.
       * - rate limit에 해당하면 사용자에게 공통 토스트 메시지를 노출하고 흐름을 중단한다.
       *
       * 설계 의도:
       * - HTTP status(예: 429)에 의존하지 않고, response body contract(`code`) 기준으로 처리한다.
       * - validation / global error와 구분되는 "도메인 에러 계층"으로 취급한다.
       * - signup / resend 등 auth 전반에서 동일한 기준으로 처리하기 위한 공통 분기이다.
       *
       * 주의:
       * - 내부 정책(요청 횟수, window 등)은 외부에 노출하지 않는다.
       */
      if (isRateLimitError(e)) {
        showToast(RATE_LIMIT_TOAST_MESSAGE, "destructive");
        return;
      }

      /**
       * 글로벌 에러 처리 (network, timeout 등)
       *
       * 동작:
       * - 네트워크 실패, 타임아웃 등 transport/infra 계층의 에러를 처리한다.
       * - 해당 에러 타입에 맞는 메시지를 토스트로 노출하고 흐름을 종료한다.
       *
       * 설계 의도:
       * - 서버가 반환한 도메인 에러(response body 기반)와 구분한다.
       * - rate limit, validation 등은 이 분기에서 처리하지 않는다.
       *
       * 주의:
       * - 이 분기는 서버 응답 contract가 아닌, 클라이언트 환경/네트워크 문제를 다룬다.
       */
      if (isGlobalError(e)) {
        showToast(GLOBAL_ERROR_MESSAGES[e.type], "destructive");
        return;
      }

      /**
       * fallback 처리 (unknown error)
       *
       * 동작:
       * - 정의된 에러 타입으로 판별되지 않는 모든 예외를 처리한다.
       * - 사용자에게 일반적인 오류 메시지를 토스트로 노출한다.
       *
       * 설계 의도:
       * - 예상하지 못한 에러(contract 위반, 런타임 예외 등)에 대해
       *   최소한의 사용자 피드백을 보장한다.
       */
      showToast(UNKNOWN_ERROR_MESSAGE, "destructive");
    }
  };

  /**
   * password 변경 시 confirmPassword 재검증
   */
  const handlePasswordChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await onPasswordChange(e);

      if (getValues("confirmPassword")) {
        await trigger("confirmPassword");
      }
    },
    [getValues, onPasswordChange, trigger],
  );

  /**
   * confirmPassword 변경 시 즉시 검증
   */
  const handleConfirmPasswordChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await onConfirmChange(e);
      await trigger("confirmPassword");
    },
    [onConfirmChange, trigger],
  );

  /**
   * 모달이 닫힐 때에만 interactionEnabled 활성화
   * 이유: 콘텐츠 열람 의도 확인 이후부터 직접 조작 허용 (스펙 명시)
   * 향후: 스크롤 완료 후에만 활성화하는 정책으로 강화 가능 (scrollEnforced 플래그 추가 포인트)
   */
  const handleTermsOpenChange = (open: boolean) => {
    setTermsModalOpen(open);
    if (!open) {
      setTermsInteractionEnabled(true);
      // Label 경유 플래그는 닫힘 시 리셋하여 다음 오픈에서 stale 상태를 방지
      setTermsOpenedByLabel(false);
    }
  };

  const handlePrivacyOpenChange = (open: boolean) => {
    setPrivacyModalOpen(open);
    if (!open) {
      setPrivacyInteractionEnabled(true);
      // Label 경유 플래그는 닫힘 시 리셋하여 다음 오픈에서 stale 상태를 방지
      setPrivacyOpenedByLabel(false);
    }
  };

  /**
   * "동의하기" 클릭 시 체크박스 체크
   * 이유: onAgree에서 setValue("termsOfService", true)를 호출하기 때문
   */
  const handleTermsAgree = () => {
    setValue("termsOfService", true, { shouldValidate: true });
  };

  const handlePrivacyAgree = () => {
    setValue("privacyPolicy", true, { shouldValidate: true });
  };

  return (
    <form
      aria-label="회원가입"
      className="mx-auto max-w-4xl space-y-4 mt-16 px-4"
      onSubmit={handleSubmit(handleValidSubmit)}
    >
      {/* 이메일 */}
      <div className="space-y-4">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          className={cn(!errors.email && "mb-14")}
        />
        {errors.email && (
          <p role="alert" className="text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* 비밀번호 */}
      <div className="space-y-4">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          className={cn(!errors.password && "mb-14")}
          {...passwordRegister}
          onChange={handlePasswordChange}
        />
        {errors.password && (
          <p role="alert" className="text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* 비밀번호 확인 */}
      <div className="space-y-4">
        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
        <Input
          id="confirmPassword"
          type="password"
          className={cn(!errors.confirmPassword && "mb-14")}
          {...confirmPasswordRegister}
          onChange={handleConfirmPasswordChange}
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* 닉네임 */}
      <div className="space-y-4">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          type="text"
          className={cn(!errors.nickname && "mb-14")}
          {...register("nickname")}
        />
        {errors.nickname && (
          <p role="alert" className="text-red-500">
            {errors.nickname.message}
          </p>
        )}
      </div>

      {/* 프로필 이미지 */}
      <div className="space-y-4">
        <Label htmlFor="avatarFile">
          프로필 사진 <span>(선택)</span>
        </Label>
        <Input
          id="avatarFile"
          type="file"
          className={cn(!errors.avatarFile && "mb-14")}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;

            /**
             * RHF에 파일 수동 등록
             */
            setValue("avatarFile", file, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
      </div>

      {/* 약관 */}
      <div
        data-testid="agreements-container"
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <p className="md:col-span-2 text-sm text-muted-foreground">
          약관 확인 후 체크해주세요
        </p>

        {/* 이용약관 */}
        <div data-testid="terms-of-service-field" className="space-y-2">
          <div
            data-testid="tos-inner-row"
            className={cn(
              "flex flex-col lg:flex-row lg:items-center gap-2",
              !errors.termsOfService && "mb-8",
            )}
          >
            <LegalDialogWrapper
              agreementType="termsOfService"
              open={termsModalOpen}
              onOpenChange={handleTermsOpenChange}
              onAgree={handleTermsAgree}
              triggerLabel="이용약관 보기"
              dialogTitle="이용약관"
              checkboxRef={termsCheckboxRef}
              openedByLabel={termsOpenedByLabel}
            />

            <div
              data-testid="tos-text-checkbox-group"
              className="flex items-center gap-2"
            >
              <Label
                htmlFor="termsOfService"
                onClick={(e) => {
                  if (!termsInteractionEnabled) {
                    // htmlFor 연결로 인한 체크박스 자동 토글을 차단하고 모달 열기
                    // 이유: Label 클릭이 체크박스 토글을 유발하지 않도록 인터셉트
                    e.preventDefault();
                    setTermsOpenedByLabel(true);
                    setTermsModalOpen(true);
                  }
                }}
              >
                이용약관에 동의합니다
              </Label>

              <Controller
                name="termsOfService"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    ref={termsCheckboxRef}
                    id="termsOfService"
                    data-testid="terms-of-service-checkbox"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      // interactionEnabled=false이면 체크 변경을 막고 모달 열기
                      // 이유: HTML disabled 금지 스펙 준수 — 인터셉트로 동일 효과 구현
                      if (!termsInteractionEnabled) {
                        setTermsOpenedByLabel(false);
                        setTermsModalOpen(true);
                        return;
                      }
                      field.onChange(checked === true);
                    }}
                    onKeyDown={(e) => {
                      // Space/Enter 키보드 입력도 마우스 클릭과 동일하게 인터셉트
                      // 이유: 키보드로 aria-disabled 우회를 방지하고 접근성 일관성 보장
                      if (
                        !termsInteractionEnabled &&
                        (e.key === " " || e.key === "Enter")
                      ) {
                        e.preventDefault();
                        setTermsOpenedByLabel(false);
                        setTermsModalOpen(true);
                      }
                    }}
                    onBlur={field.onBlur}
                    aria-disabled={
                      !termsInteractionEnabled ? "true" : undefined
                    }
                    aria-label={
                      !termsInteractionEnabled
                        ? "약관을 먼저 확인해야 체크할 수 있습니다"
                        : undefined
                    }
                    aria-describedby={
                      errors.termsOfService
                        ? "terms-of-service-error"
                        : undefined
                    }
                  />
                )}
              />
            </div>
          </div>

          {errors.termsOfService && (
            <p
              id="terms-of-service-error"
              role="alert"
              className="text-red-500"
            >
              {errors.termsOfService.message}
            </p>
          )}
        </div>

        {/* 개인정보 */}
        <div data-testid="privacy-policy-field" className="space-y-2">
          <div
            className={cn(
              "flex flex-col lg:flex-row lg:items-center gap-2",
              !errors.privacyPolicy && "mb-8",
            )}
          >
            <LegalDialogWrapper
              agreementType="privacyPolicy"
              open={privacyModalOpen}
              onOpenChange={handlePrivacyOpenChange}
              onAgree={handlePrivacyAgree}
              triggerLabel="개인정보처리방침 보기"
              dialogTitle="개인정보처리방침"
              checkboxRef={privacyCheckboxRef}
              openedByLabel={privacyOpenedByLabel}
            />

            <div className="flex items-center gap-2">
              <Label
                htmlFor="privacyPolicy"
                onClick={(e) => {
                  if (!privacyInteractionEnabled) {
                    // htmlFor 연결로 인한 체크박스 자동 토글을 차단하고 모달 열기
                    // 이유: Label 클릭이 체크박스 토글을 유발하지 않도록 인터셉트
                    e.preventDefault();
                    setPrivacyOpenedByLabel(true);
                    setPrivacyModalOpen(true);
                  }
                }}
              >
                개인정보 처리방침에 동의합니다
              </Label>

              <Controller
                name="privacyPolicy"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    ref={privacyCheckboxRef}
                    id="privacyPolicy"
                    data-testid="privacy-policy-checkbox"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      // interactionEnabled=false이면 체크 변경을 막고 모달 열기
                      // 이유: HTML disabled 금지 스펙 준수 — 인터셉트로 동일 효과 구현
                      if (!privacyInteractionEnabled) {
                        setPrivacyOpenedByLabel(false);
                        setPrivacyModalOpen(true);
                        return;
                      }
                      field.onChange(checked === true);
                    }}
                    onKeyDown={(e) => {
                      // Space/Enter 키보드 입력도 마우스 클릭과 동일하게 인터셉트
                      // 이유: 키보드로 aria-disabled 우회를 방지하고 접근성 일관성 보장
                      if (
                        !privacyInteractionEnabled &&
                        (e.key === " " || e.key === "Enter")
                      ) {
                        e.preventDefault();
                        setPrivacyOpenedByLabel(false);
                        setPrivacyModalOpen(true);
                      }
                    }}
                    onBlur={field.onBlur}
                    aria-disabled={
                      !privacyInteractionEnabled ? "true" : undefined
                    }
                    aria-label={
                      !privacyInteractionEnabled
                        ? "약관을 먼저 확인해야 체크할 수 있습니다"
                        : undefined
                    }
                    aria-describedby={
                      errors.privacyPolicy ? "privacy-policy-error" : undefined
                    }
                  />
                )}
              />
            </div>
          </div>

          {errors.privacyPolicy && (
            <p id="privacy-policy-error" role="alert" className="text-red-500">
              {errors.privacyPolicy.message}
            </p>
          )}
        </div>
      </div>

      {/* root 에러 */}
      {errors.root && (
        <p role="alert" data-testid="form-error" className="text-red-500">
          {errors.root.message}
        </p>
      )}

      {/* 액션 영역 */}
      <div
        data-testid="form-action-area"
        className="flex flex-wrap justify-between gap-2"
      >
        <Link href="/login" className="text-blue-400 hover:text-blue-500">
          이미 가입하셨나요?
        </Link>

        <Button type="submit" disabled={isPending}>
          {isPending && <span role="status" aria-label="로딩 중" />}
          {isPending ? "가입 중..." : "회원가입"}
        </Button>
      </div>
    </form>
  );
}
