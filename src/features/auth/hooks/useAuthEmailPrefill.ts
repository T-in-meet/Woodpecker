import { useEffect, useRef } from "react";
import { UseFormSetValue } from "react-hook-form";

import { consumeAuthEmailPrefillEmail } from "../lib/authEmailPrefillMemory";
import {
  AuthEmailFormInput,
  authEmailFormSchema,
} from "../schemas/authEmailFormSchema";

type UseAuthEmailPrefillParams = {
  /**
   * react-hook-form setValue
   *
   * prefill 이메일을 form 상태에 주입하기 위해 사용한다.
   */
  setValue: UseFormSetValue<AuthEmailFormInput>;
};

/**
 * 이메일 prefill 처리 hook
 *
 * 목적:
 * - 이전 인증 흐름에서 저장한 이메일을 form 초기값으로 복구한다.
 * - prefill 값은 최초 렌더링 시점에 한 번만 소비한다.
 * - 소비한 값은 schema 검증 이후에만 form 상태에 반영한다.
 *
 * 정책:
 * - invalid email은 무시한다.
 * - React Strict Mode 환경에서도 중복 주입되지 않는다.
 * - validation / dirty / touched 상태를 함께 갱신한다.
 */
export const useAuthEmailPrefill = ({
  setValue,
}: UseAuthEmailPrefillParams) => {
  /**
   * prefill 소비 여부
   *
   * Strict Mode 및 리렌더링 상황에서
   * 동일한 값을 다시 주입하지 않기 위한 보호 장치
   */
  const hasHandledPrefillRef = useRef(false);

  useEffect(() => {
    /**
     * prefill은 최초 렌더링 시점에만 소비한다.
     */
    if (hasHandledPrefillRef.current) return;

    hasHandledPrefillRef.current = true;

    /**
     * 이전 흐름에서 저장한 이메일 조회
     */
    const prefillEmail = consumeAuthEmailPrefillEmail();

    /**
     * 저장된 이메일이 없으면 종료
     */
    if (!prefillEmail) return;

    /**
     * 저장된 이메일를 현재 form schema 기준으로 재검증
     *
     * localStorage 등 외부 저장소 값은
     * 항상 신뢰하지 않고 다시 검증한다.
     */
    const parsed = authEmailFormSchema.safeParse({
      email: prefillEmail,
    });

    /**
     * 유효하지 않은 값이면 주입하지 않는다.
     */
    if (!parsed.success) return;

    /**
     * form 상태에 이메일 주입
     *
     * shouldValidate:
     * - validation 즉시 반영
     *
     * shouldDirty:
     * - 사용자가 변경한 값으로 간주
     *
     * shouldTouch:
     * - interaction 상태 반영
     */
    setValue("email", parsed.data.email, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  }, [setValue]);
};
