"use server";

import { ROUTES } from "@/lib/constants/routes";
import { getServerActionClientIp } from "@/lib/utils/getServerActionClientIp";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
import { otpSchema } from "@/lib/validation/otpSchema";

import { AUTH_EVENTS } from "../../constants/authEvents";
import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";
import { INVALID_OTP_ERROR_MESSAGE } from "../../constants/otp";
import { VERIFY_OTP_PATH } from "../../constants/routes";
import { applyMinimumActionDelay } from "../../lib/applyMinimumActionDelay";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "../../lib/authLogger";
import {
  checkRequestEligibility,
  mapBlockedByToReason,
} from "../../lib/checkRequestEligibility";
import { maskEmailForLogging } from "../../lib/maskEmailForLogging";
import { maskIpForLogging } from "../../lib/maskIpForLogging";
import { canonicalizeEmail } from "../../utils/canonicalizeEmail";
import { verifyOtp } from "../lib/verifyOtp";
import { verifyOtpContextSchema } from "../schemas/verifyOtpContextSchema";
import { VerifyOtpActionState } from "./verifyOtpActionState";

function blockedState(
  reasonCode:
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
    | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG,
): VerifyOtpActionState {
  return {
    status: "blocked",
    reasonCode,
    fieldErrors: null,
  };
}

function internalErrorState(): VerifyOtpActionState {
  return {
    status: "internal_error",
    reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
    fieldErrors: null,
  };
}

/**
 * OTP 인증 입력을 처리하는 Server Action.
 *
 * redirectPath는 formData가 아니라 페이지/컴포넌트에서 bind로 주입되는 값이다.
 * prevState는 useActionState 계약을 맞추기 위한 이전 action state이며,
 * 현재 로직에서는 직접 사용하지 않기 때문에 _prevState로 표시한다.
 */
export async function verifyOtpAction(
  redirectPath: string | null,
  _prevState: VerifyOtpActionState,
  formData: FormData,
): Promise<VerifyOtpActionState> {
  // applyMinimumDelay를 위한 시작 시간
  const start = Date.now();

  // 요청 시작 로그
  logRequested(AUTH_EVENTS.AUTH_VERIFY_OTP_REQUESTED, {
    path: VERIFY_OTP_PATH,
    method: "POST",
    provider: "password",
  });

  try {
    /**
     * 요청 컨텍스트 검증
     *
     * email, purpose, redirect는 사용자가 OTP 입력창에서 직접 수정하는 값이 아니라
     * verify-otp 요청을 처리하기 위해 필요한 hidden/context 값이다.
     *
     * 이 값들이 누락되었거나 변조된 경우에는
     * OTP 검증 자체를 진행할 수 없으므로 invalid_input이 아니라
     * invalid_request 상태로 처리한다.
     *
     * invalid_request 상태를 받은 클라이언트는 현재 OTP 화면에 머무르지 않고
     * router.back() 또는 resend-email fallback 처리를 수행해야 한다.
     */
    const contextParsed = verifyOtpContextSchema.safeParse({
      email: formData.get("email"),
      purpose: formData.get("purpose"),
      redirect: redirectPath || undefined,
    });

    if (!contextParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_INVALID_REQUEST, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 400,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      return {
        status: "invalid_request",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
        fieldErrors: null,
      };
    }

    const { email, purpose, redirect } = contextParsed.data;

    /**
     * 사용자 입력 검증
     *
     * OTP는 사용자가 직접 입력하고 수정할 수 있는 값이므로
     * 형식 검증 실패 시 invalid_input 상태로 처리한다.
     *
     * 검증 실패 시에는 현재 OTP 입력 화면을 유지하며
     * fieldErrors를 통해 사용자에게 입력 오류를 표시한다.
     *
     * 검증 대상:
     * - OTP 길이
     * - 숫자 형식 여부
     */
    const otpParsed = otpSchema.safeParse(formData.get("otp"));

    if (!otpParsed.success) {
      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_INVALID_INPUT, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 422,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED,
      });

      return {
        status: "invalid_input",
        fieldErrors: {
          otp:
            otpParsed.error.flatten().formErrors[0] ??
            VALIDATION_MESSAGES.otpInvalid,
        },
      };
    }

    /**
     * Rate limit 검증
     *
     * 요청 컨텍스트 검증을 통과한 email을 canonicalEmail로 정규화한 뒤,
     * IP와 email 기준으로 verify-otp 요청 가능 여부를 확인한다.
     *
     * canonicalEmail은 rate limit key로 사용하고,
     * maskedEmail / maskedIp는 로그에만 사용한다.
     *
     * 요청 제한에 걸린 경우에는 Supabase verifyOtp를 호출하지 않고
     * blocked 상태를 반환한다.
     */
    const canonicalEmail = canonicalizeEmail(email);
    const clientIp = await getServerActionClientIp();
    const maskedEmail = maskEmailForLogging(canonicalEmail);
    const maskedIp = maskIpForLogging(clientIp);

    const eligibility = checkRequestEligibility(
      "verify-otp",
      clientIp,
      canonicalEmail,
    );

    if (!eligibility.allowed) {
      const reasonCode = mapBlockedByToReason(eligibility.blockedBy);

      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_RATE_LIMITED, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 429,
        provider: "password",
        result: "blocked",
        reasonCode,
        maskedEmail,
        maskedIp,
      });

      return blockedState(reasonCode);
    }

    /**
     * Supabase OTP 인증 검증 수행
     *
     * 검증된 요청 컨텍스트(email, purpose)와
     * 사용자 입력 OTP를 기반으로
     * Supabase verifyOtp를 호출한다.
     *
     * 주의:
     * - verifyOtp는 throw 대신 error 객체를 반환할 수 있으므로
     *   반드시 반환 결과의 error 여부를 확인해야 한다.
     * - OTP 불일치, 만료 등의 인증 실패도 error로 반환된다.
     */
    const { error } = await verifyOtp({
      email,
      purpose,
      otp: otpParsed.data,
    });

    /**
     * OTP 인증 실패 처리
     *
     * Supabase verifyOtp의 error는 throw가 아니라
     * 반환값으로 전달될 수 있다.
     *
     * 이 error는 주로 OTP 불일치, 만료, 재발급으로 인한 이전 OTP 무효화 등
     * 사용자가 다시 입력하거나 재전송으로 해결할 수 있는 인증 실패를 의미한다.
     *
     * 따라서 서버 내부 오류로 처리하지 않고
     * invalid_input 상태로 반환해 현재 OTP 입력 화면에서 안내한다.
     */
    if (error) {
      logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_INVALID_OTP, {
        path: VERIFY_OTP_PATH,
        method: "POST",
        status: 401,
        provider: "password",
        result: "failure",
        reasonCode: AUTH_LOG_REASONS.INVALID_OTP,
        maskedEmail,
        maskedIp,
        purpose,
      });

      return {
        status: "invalid_otp",
        formError: INVALID_OTP_ERROR_MESSAGE,
      };
    }

    /**
     * OTP 인증 완료 로그
     *
     * Supabase verifyOtp가 성공적으로 완료된 상태를 기록한다.
     *
     * purpose는 어떤 OTP 인증 흐름이 성공했는지
     * 운영 로그에서 구분하기 위해 함께 기록한다.
     *
     * OTP 자체는 민감 정보이므로 로그에 남기지 않는다.
     */
    logAuthEvent(AUTH_EVENTS.AUTH_VERIFY_OTP_COMPLETED, {
      path: VERIFY_OTP_PATH,
      method: "POST",
      status: 200,
      provider: "password",
      result: "success",
      purpose,
      maskedEmail,
      maskedIp,
    });

    /**
     * OTP 인증 성공 후 이동 경로 결정
     *
     * redirect가 있으면 해당 경로로 이동하고,
     * redirect가 없으면 기본 인증 완료 목적지로 이동한다.
     *
     * 인증이 완료된 이후에는 email / purpose 컨텍스트를
     * 다음 페이지로 넘길 필요가 없으므로 query parameter를 생성하지 않는다.
     */
    const nextPath = redirect ?? ROUTES.MYPAGE;

    return {
      status: "completed",
      redirectTo: nextPath,
      fieldErrors: null,
    };
  } catch (error) {
    /**
     * 예상하지 못한 시스템 예외 처리
     *
     * verifyOtp의 인증 실패(OTP 불일치/만료)는
     * 반환값(error)으로 처리한다.
     *
     * 이 catch는:
     * - Supabase client 생성 실패
     * - 네트워크 오류
     * - 런타임 예외
     * - 예상하지 못한 throw
     *
     * 등 시스템 레벨 예외만 처리한다.
     */
    const normalized = normalizeUnknownError(error);
    logAuthError(AUTH_EVENTS.AUTH_VERIFY_OTP_FAILED, {
      path: VERIFY_OTP_PATH,
      method: "POST",
      status: 500,
      provider: "password",
      result: "failure",
      reasonCode: AUTH_LOG_REASONS.INTERNAL_ERROR,
      ...normalized,
    });
    return internalErrorState();
  } finally {
    await applyMinimumActionDelay(start);
  }
}
