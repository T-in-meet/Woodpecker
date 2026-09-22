/**
 * verifyOtp server action의 UI 상태 계약
 *
 * OTP 인증 요청 결과를 클라이언트에 전달하기 위한 상태 타입이다.
 *
 * 상태는 다음 기준으로 구분된다:
 *
 * - idle:
 *   아직 인증 요청이 수행되지 않은 초기 상태
 *
 * - blocked:
 *   rate limit 정책에 의해 요청이 차단된 상태
 *
 * - internal_error:
 *   사용자가 직접 해결할 수 없는 서버 내부 오류 상태
 *
 * - invalid_input:
 *   사용자가 수정 가능한 입력값 유효성 검증 실패 상태
 */
export type VerifyOtpActionState =
  /**
   * 초기 상태
   *
   * action 실행 전 기본 상태.
   * 아직 OTP 검증 요청이 수행되지 않은 상태를 의미한다.
   */
  | {
      status: "idle";
      fieldErrors: null;
    }

  /**
   * 잘못된 요청 상태
   *
   * 사용자가 OTP 입력창에서 직접 수정할 수 없는
   * 요청 컨텍스트가 누락되었거나 유효하지 않은 상태를 의미한다.
   *
   * 예:
   * - email 누락
   * - purpose 누락
   * - purpose 변조
   * - redirect 값 검증 실패
   */
  | {
      status: "invalid_request";
      fieldErrors: null;
    }

  /**
   * Rate Limit 차단 상태
   *
   * Local Rate Limit 또는 Provider Rate Limit에 의해
   * 인증 요청이 차단된 상태를 의미한다.
   *
   * 상세 차단 원인은 외부 상태에 노출하지 않고 structured log에서 구분한다.
   */
  | {
      status: "blocked";
      fieldErrors: null;
    }

  /**
   * 서버 내부 에러 상태
   *
   * 사용자가 직접 해결할 수 없는
   * 시스템 수준의 예외를 의미한다.
   *
   * 예:
   * - session 처리 실패
   * - Supabase API 예외
   * - 예상하지 못한 서버 예외
   */
  | {
      status: "internal_error";
      fieldErrors: null;
    }

  /**
   * 사용자 입력값 유효성 검증 실패
   *
   * 사용자가 수정 가능한 입력 문제를 의미한다.
   *
   * 예:
   * - OTP 길이 오류
   * - 숫자 형식 오류
   * - schema validation 실패
   */
  | {
      status: "invalid_input";
      fieldErrors: {
        otp?: string;
      };
    }
  /**
   * OTP 인증 실패 상태
   *
   * OTP 형식 자체는 올바르지만
   * 실제 인증에 실패한 상태를 의미한다.
   *
   * 사용자가 OTP를 다시 입력하거나
   * 재전송을 통해 해결할 수 있는 문제이다.
   *
   * 예:
   * - OTP 불일치
   * - 만료된 OTP
   * - 재발급으로 인해 무효화된 OTP
   */
  | {
      status: "invalid_otp";
      formError: string;
    };

/**
 * VerifyOtp action 초기 상태
 */
export const INITIAL_VERIFY_OTP_ACTION_STATE: VerifyOtpActionState = {
  status: "idle",
  fieldErrors: null,
};
