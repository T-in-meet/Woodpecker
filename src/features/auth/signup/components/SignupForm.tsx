"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GLOBAL_ERROR_MESSAGES,
  isGlobalError,
} from "@/features/auth/errors/globalError";
import {
  isRateLimitError,
  RATE_LIMIT_TOAST_MESSAGE,
} from "@/features/auth/errors/rateLimitError";
import { UNKNOWN_ERROR_MESSAGE } from "@/features/auth/errors/unknownError";
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
type ModalTrigger = "button" | "checkbox" | "error" | null;

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
    watch,
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
  const [termsModalTrigger, setTermsModalTrigger] =
    useState<ModalTrigger>(null);
  const [privacyModalTrigger, setPrivacyModalTrigger] =
    useState<ModalTrigger>(null);

  /**
   * focus fallback 대상 refs
   * Checkbox 컴포넌트가 forwardRef를 지원하므로
   * checkboxRef.current.focus()로 포커스 복원 가능
   */
  const termsCheckboxRef = useRef<HTMLButtonElement>(null);
  const privacyCheckboxRef = useRef<HTMLButtonElement>(null);
  const termsTriggerButtonRef = useRef<HTMLButtonElement>(null);
  const privacyTriggerButtonRef = useRef<HTMLButtonElement>(null);
  const termsErrorButtonRef = useRef<HTMLButtonElement>(null);
  const privacyErrorButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const loginLinkRef = useRef<HTMLAnchorElement>(null);
  const termsErrorContainerRef = useRef<HTMLParagraphElement>(null);
  const privacyErrorContainerRef = useRef<HTMLParagraphElement>(null);
  const termsAgreeIntentRef = useRef(false);
  const privacyAgreeIntentRef = useRef(false);
  const prevAgreementErrorsRef = useRef({
    terms: false,
    privacy: false,
  });

  /**
   * password / confirmPassword 분리
   * - onChange 커스터마이징 위해
   */
  const { onChange: onPasswordChange, ...passwordRegister } =
    register("password");
  const { onChange: onConfirmChange, ...confirmPasswordRegister } =
    register("confirmPassword");

  const normalizeText = (value: unknown) =>
    typeof value === "string" ? value : "";
  const normalizeChecked = (value: unknown) => value === true;

  const watchedEmail = normalizeText(watch("email"));
  const watchedPassword = normalizeText(watch("password"));
  const watchedConfirmPassword = normalizeText(watch("confirmPassword"));
  const watchedNickname = normalizeText(watch("nickname"));
  const watchedTermsOfService = normalizeChecked(watch("termsOfService"));
  const watchedPrivacyPolicy = normalizeChecked(watch("privacyPolicy"));

  const isSubmitVisuallyReady =
    watchedEmail.trim().length > 0 &&
    watchedPassword.trim().length > 0 &&
    watchedConfirmPassword.trim().length > 0 &&
    watchedNickname.trim().length > 0 &&
    watchedTermsOfService &&
    watchedPrivacyPolicy;

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

  const focusAgreementCheckbox = useCallback(
    (checkboxRef: React.RefObject<HTMLButtonElement | null>) => {
      requestAnimationFrame(() => {
        checkboxRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        checkboxRef.current?.focus();
      });
    },
    [],
  );

  const focusNextAction = useCallback(() => {
    requestAnimationFrame(() => {
      if (submitButtonRef.current && !submitButtonRef.current.disabled) {
        submitButtonRef.current.focus();
        return;
      }
      loginLinkRef.current?.focus();
    });
  }, []);

  const restoreFocusByTrigger = useCallback(
    (
      trigger: ModalTrigger,
      refs: {
        checkbox: React.RefObject<HTMLButtonElement | null>;
        button: React.RefObject<HTMLButtonElement | null>;
        error: React.RefObject<HTMLButtonElement | null>;
      },
    ) => {
      requestAnimationFrame(() => {
        if (trigger === "checkbox") {
          refs.checkbox.current?.focus();
          return;
        }
        if (trigger === "error") {
          refs.error.current?.focus();
          return;
        }
        if (trigger === "button") {
          refs.button.current?.focus();
        }
      });
    },
    [],
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
      if (termsAgreeIntentRef.current) {
        termsAgreeIntentRef.current = false;
        focusAgreementCheckbox(privacyCheckboxRef);
      } else {
        restoreFocusByTrigger(termsModalTrigger, {
          checkbox: termsCheckboxRef,
          button: termsTriggerButtonRef,
          error: termsErrorButtonRef,
        });
      }
      setTermsModalTrigger(null);
    }
  };

  const handlePrivacyOpenChange = (open: boolean) => {
    setPrivacyModalOpen(open);
    if (!open) {
      setPrivacyInteractionEnabled(true);
      if (privacyAgreeIntentRef.current) {
        privacyAgreeIntentRef.current = false;
        focusNextAction();
      } else {
        restoreFocusByTrigger(privacyModalTrigger, {
          checkbox: privacyCheckboxRef,
          button: privacyTriggerButtonRef,
          error: privacyErrorButtonRef,
        });
      }
      setPrivacyModalTrigger(null);
    }
  };

  /**
   * "동의하기" 클릭 시 체크박스 체크
   * 이유: onAgree에서 setValue("termsOfService", true)를 호출하기 때문
   */
  const handleTermsAgree = () => {
    termsAgreeIntentRef.current = true;
    setValue("termsOfService", true, { shouldValidate: true });
  };

  const handlePrivacyAgree = () => {
    privacyAgreeIntentRef.current = true;
    setValue("privacyPolicy", true, { shouldValidate: true });
  };

  useEffect(() => {
    if (termsModalOpen || privacyModalOpen) {
      return;
    }

    const hasTermsError = Boolean(errors.termsOfService);
    const hasPrivacyError = Boolean(errors.privacyPolicy);
    const hadTermsError = prevAgreementErrorsRef.current.terms;
    const hadPrivacyError = prevAgreementErrorsRef.current.privacy;

    const termsNewlyAppeared = hasTermsError && !hadTermsError;
    const privacyNewlyAppeared = hasPrivacyError && !hadPrivacyError;

    if (termsNewlyAppeared || privacyNewlyAppeared) {
      requestAnimationFrame(() => {
        if (termsNewlyAppeared) {
          if (termsErrorButtonRef.current) {
            termsErrorButtonRef.current.focus();
          } else {
            termsErrorContainerRef.current?.focus();
          }
          return;
        }

        if (privacyErrorButtonRef.current) {
          privacyErrorButtonRef.current.focus();
        } else {
          privacyErrorContainerRef.current?.focus();
        }
      });
    }

    prevAgreementErrorsRef.current = {
      terms: hasTermsError,
      privacy: hasPrivacyError,
    };
  }, [
    errors.termsOfService,
    errors.privacyPolicy,
    termsModalOpen,
    privacyModalOpen,
  ]);

  return (
    <div className="my-0 md:my-4 mx-auto max-w-2xl bg-white border-0 md:border md:border-outline-variant md:rounded-xl rounded-none md:shadow-sm shadow-none overflow-hidden">
      <form
        aria-label="회원가입"
        className="mx-auto max-w-4xl space-y-2 py-7 px-4 md:px-8"
        onSubmit={handleSubmit(handleValidSubmit)}
      >
        {/* 타이틀 */}
        <h1 className="text-2xl font-bold text-primary tracking-tight mb-8">
          계정 만들기
        </h1>
        {/* 닉네임 */}
        <div>
          <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex items-center">
              <Label htmlFor="nickname" className="shrink-0 min-w-25">
                닉네임
              </Label>
            </div>
            <Input
              id="nickname"
              type="text"
              placeholder="닉네임을 입력하세요"
              {...register("nickname")}
            />
            <div />
            {/* 에러 영역을 항상 고정 높이로 유지 — 에러 표시 여부에 따른 레이아웃 흔들림 방지 */}
            <div className="min-h-5 mt-2">
              {errors.nickname && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.nickname.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 이메일 */}
        <div>
          <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex items-center">
              <Label htmlFor="email" className="shrink-0 min-w-25">
                이메일
              </Label>
            </div>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              {...register("email")}
            />
            <div />
            {/* 에러 영역을 항상 고정 높이로 유지 — 에러 표시 여부에 따른 레이아웃 흔들림 방지 */}
            <div className="min-h-5 mt-2">
              {errors.email && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 비밀번호 */}
        <div>
          <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex items-center">
              <Label htmlFor="password" className="shrink-0 min-w-25">
                비밀번호
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="8자 이상 입력하세요"
              {...passwordRegister}
              onChange={handlePasswordChange}
            />
            <div />
            {/* 에러 영역을 항상 고정 높이로 유지 — 에러 표시 여부에 따른 레이아웃 흔들림 방지 */}
            <div className="min-h-5 mt-2">
              {errors.password && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 비밀번호 확인 */}
        <div>
          <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex items-center">
              <Label htmlFor="confirmPassword" className="shrink-0 min-w-25">
                비밀번호 확인
              </Label>
            </div>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              {...confirmPasswordRegister}
              onChange={handleConfirmPasswordChange}
            />
            <div />
            {/* 에러 영역을 항상 고정 높이로 유지 — 에러 표시 여부에 따른 레이아웃 흔들림 방지 */}
            <div className="min-h-5 mt-2">
              {errors.confirmPassword && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 약관 */}
        <div
          data-testid="agreements-container"
          className="flex flex-col border rounded-lg p-4 shadow-sm"
        >
          <p className="md:col-span-2 text-sm text-muted-foreground mb-2">
            약관 확인 후 체크해주세요
          </p>

          {/* 이용약관 */}
          <div data-testid="terms-of-service-field" className="">
            <div
              data-testid="tos-inner-row"
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div
                data-testid="tos-text-checkbox-group"
                className="flex items-center gap-2"
              >
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
                          setTermsModalTrigger("checkbox");
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
                          setTermsModalTrigger("checkbox");
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
                <Label
                  htmlFor="termsOfService"
                  onClick={(e) => {
                    if (!termsInteractionEnabled) {
                      // htmlFor 연결로 인한 체크박스 자동 토글을 차단하고 모달 열기
                      // 이유: Label 클릭이 체크박스 토글을 유발하지 않도록 인터셉트
                      e.preventDefault();
                      setTermsModalTrigger("checkbox");
                      setTermsModalOpen(true);
                    }
                  }}
                >
                  이용약관에 동의합니다
                </Label>
              </div>
              <LegalDialogWrapper
                agreementType="termsOfService"
                open={termsModalOpen}
                onOpenChange={handleTermsOpenChange}
                onAgree={handleTermsAgree}
                triggerLabel="이용약관 보기"
                dialogTitle="이용약관"
                triggerButtonRef={termsTriggerButtonRef}
                onTriggerClick={() => setTermsModalTrigger("button")}
              />
            </div>

            {/* 에러 영역을 항상 고정 높이로 유지 — 에러 표시 여부에 따른 약관 간 간격 흔들림 방지 */}
            <div className="min-h-5">
              {errors.termsOfService && (
                <p
                  id="terms-of-service-error"
                  role="alert"
                  ref={termsErrorContainerRef}
                  tabIndex={-1}
                  className="text-sm text-destructive"
                >
                  {/* 에러 메시지를 클릭 가능하게 처리 — 사용자가 에러 원인을 즉시 해소할 수 있도록
                    스펙: error_click_should_open_modal_if_possible */}
                  <button
                    ref={termsErrorButtonRef}
                    type="button"
                    className="cursor-pointer underline hover:no-underline"
                    onClick={() => {
                      setTermsModalTrigger("error");
                      setTermsModalOpen(true);
                    }}
                  >
                    {errors.termsOfService.message}
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* 개인정보 */}
          <div data-testid="privacy-policy-field" className="">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
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
                          setPrivacyModalTrigger("checkbox");
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
                          setPrivacyModalTrigger("checkbox");
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
                        errors.privacyPolicy
                          ? "privacy-policy-error"
                          : undefined
                      }
                    />
                  )}
                />
                <Label
                  htmlFor="privacyPolicy"
                  onClick={(e) => {
                    if (!privacyInteractionEnabled) {
                      // htmlFor 연결로 인한 체크박스 자동 토글을 차단하고 모달 열기
                      // 이유: Label 클릭이 체크박스 토글을 유발하지 않도록 인터셉트
                      e.preventDefault();
                      setPrivacyModalTrigger("checkbox");
                      setPrivacyModalOpen(true);
                    }
                  }}
                >
                  개인정보 처리방침에 동의합니다
                </Label>
              </div>
              <LegalDialogWrapper
                agreementType="privacyPolicy"
                open={privacyModalOpen}
                onOpenChange={handlePrivacyOpenChange}
                onAgree={handlePrivacyAgree}
                triggerLabel="개인정보처리방침 보기"
                dialogTitle="개인정보처리방침"
                triggerButtonRef={privacyTriggerButtonRef}
                onTriggerClick={() => setPrivacyModalTrigger("button")}
              />
            </div>

            {/* 에러 영역을 항상 고정 높이로 유지 — 에러 표시 여부에 따른 레이아웃 흔들림 방지 */}
            <div className="min-h-5">
              {errors.privacyPolicy && (
                <p
                  id="privacy-policy-error"
                  role="alert"
                  ref={privacyErrorContainerRef}
                  tabIndex={-1}
                  className="text-sm text-destructive"
                >
                  {/* 에러 메시지를 클릭 가능하게 처리 — 이용약관과 동일한 단일 행동 경로 제공
                    스펙: error_click_should_open_modal_if_possible */}
                  <button
                    ref={privacyErrorButtonRef}
                    type="button"
                    className="cursor-pointer underline hover:no-underline"
                    onClick={() => {
                      setPrivacyModalTrigger("error");
                      setPrivacyModalOpen(true);
                    }}
                  >
                    {errors.privacyPolicy.message}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* root 에러 */}
        {errors.root && (
          <p
            role="alert"
            data-testid="form-error"
            className="text-sm text-destructive"
          >
            {errors.root.message}
          </p>
        )}

        {/* 액션 영역 */}
        <div
          data-testid="form-action-area"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-6"
        >
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

          <Button
            ref={submitButtonRef}
            type="submit"
            disabled={isPending}
            className={cn(
              "w-full sm:w-auto transition-colors duration-200",
              isSubmitVisuallyReady
                ? "hover:bg-primary"
                : "bg-primary/45 text-primary-foreground/85 hover:bg-primary/55",
            )}
          >
            {/* 시각적 스피너 추가 — 400ms 이상의 서버 응답 대기 동안 처리 중임을 명확히 전달 */}
            {isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {isPending ? "가입 중..." : "회원가입"}
          </Button>
        </div>
      </form>
    </div>
  );
}
