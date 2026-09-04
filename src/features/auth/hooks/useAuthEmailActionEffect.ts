import { useEffect } from "react";
import { UseFormSetError } from "react-hook-form";

import { AUTH_GLOBAL_ERROR_MESSAGE } from "../constants/messages";
import { RATE_LIMIT_TOAST_MESSAGE } from "../errors/rateLimitError";
import { ForgotPasswordActionState } from "../forgot-password/actions/forgotPasswordActionState";
import { ResendEmailActionState } from "../resend-email/actions/resendEmailActionState";
import { AuthEmailFormInput } from "../schemas/authEmailFormSchema";

type AuthEmailActionState = ResendEmailActionState | ForgotPasswordActionState;

type UseAuthEmailActionEffectParams = {
  state: AuthEmailActionState;
  setError: UseFormSetError<AuthEmailFormInput>;
};

/**
 * 인증 이메일 form action 결과 처리 hook
 *
 * forgot-password / resend-email에서 공통으로 사용하는
 * action 결과를 UI 상태로 연결한다.
 *
 * 처리 정책:
 * - invalid_input → email field error 표시
 * - blocked → rate limit form 오류 표시
 * - internal_error → 공통 시스템 오류 form 오류 표시
 *
 * 제외:
 * - invalid_request → page 단계 redirect 대상
 * - completed → 성공 후 navigation 흐름에서 별도 처리
 */
export const useAuthEmailActionEffect = ({
  state,
  setError,
}: UseAuthEmailActionEffectParams) => {
  useEffect(() => {
    switch (state.status) {
      /**
       * 서버 입력 검증 실패
       *
       * action에서 반환한 field error를
       * react-hook-form field error로 연결한다.
       */
      case "invalid_input": {
        const emailError = state.fieldErrors.email?.[0];

        if (!emailError) return;

        setError("email", {
          type: "server",
          message: emailError,
        });

        return;
      }

      /**
       * rate limit 차단
       *
       * 사용자에게 재시도 안내를 제공한다.
       * 재시도가 필요한 오류라 사라지는 toast 대신 form 오류로 남긴다.
       */
      case "blocked":
        setError("root", {
          type: "server",
          message: RATE_LIMIT_TOAST_MESSAGE,
        });

        return;

      /**
       * 서버 내부 오류
       *
       * provider 장애, 이메일 발송 실패,
       * 시스템 오류 등을 공통 메시지로 안내한다.
       */
      case "internal_error":
        setError("root", {
          type: "server",
          message: AUTH_GLOBAL_ERROR_MESSAGE,
        });

        return;

      default:
        return;
    }
  }, [state, setError]);
};
