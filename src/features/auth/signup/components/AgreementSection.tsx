"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { Control, FieldErrors, UseFormSetValue } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LegalDialogWrapper } from "@/features/auth/signup/components/LegalDialogWrapper";

import type { FormInput, FormValues } from "./SignupForm";

/**
 * 약관 Dialog를 연 사용자 행동 출처
 */
type ModalTrigger = "button" | "checkbox" | "error" | null;

/**
 * 약관 섹션 props
 */
type AgreementSectionProps = {
  control: Control<FormInput, unknown, FormValues>;
  errors: Pick<
    FieldErrors<FormInput>,
    "termsOfService" | "privacyPolicyAcknowledged" | "age14OrOlder"
  >;
  setValue: UseFormSetValue<FormInput>;
  submitButtonRef: RefObject<HTMLButtonElement | null>;
  loginLinkRef: RefObject<HTMLAnchorElement | null>;
};

/**
 * 약관 필드의 이전 에러 상태
 */
type PreviousAgreementErrors = {
  terms: boolean;
  privacy: boolean;
  age: boolean;
};

/**
 * 약관 체크박스로 포커스를 복원한다.
 */
function focusAgreementCheckbox(
  checkboxRef: RefObject<HTMLButtonElement | null>,
) {
  checkboxRef.current?.scrollIntoView({
    block: "center",
    behavior: "smooth",
  });
  checkboxRef.current?.focus();
}

/**
 * Dialog를 연 출처에 맞춰 포커스를 복원한다.
 */
function restoreFocusByTrigger(
  trigger: ModalTrigger,
  refs: {
    checkbox: RefObject<HTMLButtonElement | null>;
    button: RefObject<HTMLButtonElement | null>;
    error: RefObject<HTMLButtonElement | null>;
  },
) {
  if (trigger === "checkbox") refs.checkbox.current?.focus();
  else if (trigger === "button") refs.button.current?.focus();
  else if (trigger === "error") refs.error.current?.focus();
}

/**
 * 약관 동의와 법적 문서 Dialog를 관리한다.
 */
export function AgreementSection({
  control,
  errors,
  setValue,
  submitButtonRef,
  loginLinkRef,
}: AgreementSectionProps) {
  const [termsInteractionEnabled, setTermsInteractionEnabled] = useState(false);
  const [privacyInteractionEnabled, setPrivacyInteractionEnabled] =
    useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalTrigger, setTermsModalTrigger] =
    useState<ModalTrigger>(null);
  const [privacyModalTrigger, setPrivacyModalTrigger] =
    useState<ModalTrigger>(null);

  const termsCheckboxRef = useRef<HTMLButtonElement>(null);
  const privacyCheckboxRef = useRef<HTMLButtonElement>(null);
  const ageCheckboxRef = useRef<HTMLButtonElement>(null);
  const termsTriggerButtonRef = useRef<HTMLButtonElement>(null);
  const privacyTriggerButtonRef = useRef<HTMLButtonElement>(null);
  const termsErrorButtonRef = useRef<HTMLButtonElement>(null);
  const privacyErrorButtonRef = useRef<HTMLButtonElement>(null);
  const termsAgreeIntentRef = useRef(false);
  const privacyAgreeIntentRef = useRef(false);
  const pendingTermsFocusRef = useRef<(() => void) | null>(null);
  const pendingPrivacyFocusRef = useRef<(() => void) | null>(null);
  const prevAgreementErrorsRef = useRef<PreviousAgreementErrors>({
    terms: false,
    privacy: false,
    age: false,
  });

  /**
   * 다음 액션으로 포커스를 이동한다.
   */
  const focusNextAction = () => {
    if (submitButtonRef.current && !submitButtonRef.current.disabled) {
      submitButtonRef.current.focus();
      return;
    }
    loginLinkRef.current?.focus();
  };

  /**
   * 이용약관 Dialog open 상태 변경을 처리한다.
   */
  const handleTermsOpenChange = (open: boolean) => {
    setTermsModalOpen(open);
    if (!open) {
      setTermsInteractionEnabled(true);

      const trigger = termsModalTrigger;
      if (termsAgreeIntentRef.current) {
        termsAgreeIntentRef.current = false;
        pendingTermsFocusRef.current = () =>
          focusAgreementCheckbox(privacyCheckboxRef);
      } else {
        pendingTermsFocusRef.current = () =>
          restoreFocusByTrigger(trigger, {
            checkbox: termsCheckboxRef,
            button: termsTriggerButtonRef,
            error: termsErrorButtonRef,
          });
      }

      setTermsModalTrigger(null);
    }
  };

  /**
   * 개인정보 Dialog open 상태 변경을 처리한다.
   */
  const handlePrivacyOpenChange = (open: boolean) => {
    setPrivacyModalOpen(open);
    if (!open) {
      setPrivacyInteractionEnabled(true);

      const trigger = privacyModalTrigger;
      if (privacyAgreeIntentRef.current) {
        privacyAgreeIntentRef.current = false;
        pendingPrivacyFocusRef.current = () =>
          focusAgreementCheckbox(ageCheckboxRef);
      } else {
        pendingPrivacyFocusRef.current = () =>
          restoreFocusByTrigger(trigger, {
            checkbox: privacyCheckboxRef,
            button: privacyTriggerButtonRef,
            error: privacyErrorButtonRef,
          });
      }

      setPrivacyModalTrigger(null);
    }
  };

  /**
   * 이용약관 동의 버튼 클릭을 RHF 값에 반영한다.
   */
  const handleTermsAgree = () => {
    termsAgreeIntentRef.current = true;
    setValue("termsOfService", true, { shouldValidate: true });
  };

  /**
   * 개인정보 동의 버튼 클릭을 RHF 값에 반영한다.
   */
  const handlePrivacyAgree = () => {
    privacyAgreeIntentRef.current = true;
    setValue("privacyPolicyAcknowledged", true, { shouldValidate: true });
  };

  useEffect(() => {
    if (termsModalOpen || privacyModalOpen) {
      return;
    }

    const hasTermsError = Boolean(errors.termsOfService);
    const hasPrivacyError = Boolean(errors.privacyPolicyAcknowledged);
    const hasAgeError = Boolean(errors.age14OrOlder);
    const hadTermsError = prevAgreementErrorsRef.current.terms;
    const hadPrivacyError = prevAgreementErrorsRef.current.privacy;
    const hadAgeError = prevAgreementErrorsRef.current.age;

    const termsNewlyAppeared = hasTermsError && !hadTermsError;
    const privacyNewlyAppeared = hasPrivacyError && !hadPrivacyError;
    const ageNewlyAppeared = hasAgeError && !hadAgeError;

    if (termsNewlyAppeared || privacyNewlyAppeared || ageNewlyAppeared) {
      if (termsNewlyAppeared) {
        termsErrorButtonRef.current?.focus();
        return;
      }
      if (privacyNewlyAppeared) {
        privacyErrorButtonRef.current?.focus();
        return;
      }
      focusAgreementCheckbox(ageCheckboxRef);
    }

    prevAgreementErrorsRef.current = {
      terms: hasTermsError,
      privacy: hasPrivacyError,
      age: hasAgeError,
    };
  }, [
    errors.termsOfService,
    errors.privacyPolicyAcknowledged,
    errors.age14OrOlder,
    termsModalOpen,
    privacyModalOpen,
  ]);

  return (
    <div
      data-testid="agreements-container"
      className="flex flex-col border rounded-lg p-4 shadow-sm"
    >
      <p className="md:col-span-2 text-sm text-muted-foreground mb-2">
        약관 확인 후 체크해주세요
      </p>

      {/* 이용약관 */}
      <div data-testid="terms-of-service-field">
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
                    if (!termsInteractionEnabled) {
                      setTermsModalTrigger("checkbox");
                      setTermsModalOpen(true);
                      return;
                    }
                    field.onChange(checked === true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== " " && e.key !== "Enter") {
                      return;
                    }

                    e.preventDefault();

                    if (!termsInteractionEnabled) {
                      setTermsModalTrigger("checkbox");
                      setTermsModalOpen(true);
                      return;
                    }

                    field.onChange(!field.value);
                  }}
                  onBlur={field.onBlur}
                  aria-disabled={!termsInteractionEnabled ? "true" : undefined}
                  aria-label={
                    !termsInteractionEnabled
                      ? "약관을 먼저 확인해야 체크할 수 있습니다"
                      : undefined
                  }
                  aria-describedby={
                    errors.termsOfService ? "terms-of-service-error" : undefined
                  }
                />
              )}
            />
            <Label
              htmlFor="termsOfService"
              onClick={(e) => {
                if (!termsInteractionEnabled) {
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
            onCloseComplete={() => {
              const fn = pendingTermsFocusRef.current;
              pendingTermsFocusRef.current = null;
              fn?.();
            }}
          />
        </div>

        <div className="min-h-5">
          {errors.termsOfService && (
            <p
              id="terms-of-service-error"
              role="alert"
              tabIndex={-1}
              className="text-sm text-destructive"
            >
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
      <div data-testid="privacy-policy-field">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Controller
              name="privacyPolicyAcknowledged"
              control={control}
              render={({ field }) => (
                <Checkbox
                  ref={privacyCheckboxRef}
                  id="privacyPolicyAcknowledged"
                  data-testid="privacy-policy-checkbox"
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    if (!privacyInteractionEnabled) {
                      setPrivacyModalTrigger("checkbox");
                      setPrivacyModalOpen(true);
                      return;
                    }
                    field.onChange(checked === true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== " " && e.key !== "Enter") {
                      return;
                    }

                    e.preventDefault();

                    if (!privacyInteractionEnabled) {
                      setPrivacyModalTrigger("checkbox");
                      setPrivacyModalOpen(true);
                      return;
                    }

                    field.onChange(!field.value);
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
                    errors.privacyPolicyAcknowledged
                      ? "privacy-policy-error"
                      : undefined
                  }
                />
              )}
            />
            <Label
              htmlFor="privacyPolicyAcknowledged"
              onClick={(e) => {
                if (!privacyInteractionEnabled) {
                  e.preventDefault();
                  setPrivacyModalTrigger("checkbox");
                  setPrivacyModalOpen(true);
                }
              }}
            >
              개인정보 처리방침을 확인했습니다
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
            onCloseComplete={() => {
              const fn = pendingPrivacyFocusRef.current;
              pendingPrivacyFocusRef.current = null;
              fn?.();
            }}
          />
        </div>

        <div className="min-h-5">
          {errors.privacyPolicyAcknowledged && (
            <p
              id="privacy-policy-error"
              role="alert"
              tabIndex={-1}
              className="text-sm text-destructive"
            >
              <button
                ref={privacyErrorButtonRef}
                type="button"
                className="cursor-pointer underline hover:no-underline"
                onClick={() => {
                  setPrivacyModalTrigger("error");
                  setPrivacyModalOpen(true);
                }}
              >
                {errors.privacyPolicyAcknowledged.message}
              </button>
            </p>
          )}
        </div>
      </div>

      <div data-testid="age-14-field">
        <div className="flex items-center gap-2">
          <Controller
            name="age14OrOlder"
            control={control}
            render={({ field }) => (
              <Checkbox
                ref={ageCheckboxRef}
                id="age14OrOlder"
                data-testid="age-14-checkbox"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  field.onChange(isChecked);
                  if (isChecked) focusNextAction();
                }}
                onBlur={field.onBlur}
                aria-describedby={
                  errors.age14OrOlder ? "age-14-error" : undefined
                }
              />
            )}
          />
          <Label htmlFor="age14OrOlder">만 14세 이상임을 확인합니다</Label>
        </div>
        <div className="min-h-5">
          {errors.age14OrOlder && (
            <p
              id="age-14-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.age14OrOlder.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
