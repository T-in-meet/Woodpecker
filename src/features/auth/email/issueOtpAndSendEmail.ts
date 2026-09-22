import {
  MISSING_EMAIL_OTP_ERROR_MESSAGE,
  MISSING_SIGNUP_USER_ID_ERROR_MESSAGE,
} from "../constants/otp";
import { normalizeUnknownError } from "../lib/authLogger";
import { classifyAuthProviderError } from "../lib/classifyAuthProviderError";
import {
  type ExistingUserSignupOtpIssueRequest,
  issueOtp,
  type NewUserSignupOtpIssueRequest,
  type OtpIssueClient,
  type ResetPasswordOtpIssueRequest,
} from "../lib/issueOtp";
import { sendOtpEmail } from "./sendOtpEmail";

type NewUserSignupBeforeDelivery = (context: {
  userId: string;
}) => Promise<void>;

type OtherBeforeDelivery = () => Promise<void>;

/**
 * OTP 발급과 Email delivery 사이에 caller-specific operation을 연결할 수 있는 입력.
 *
 * 신규 Signup은 Provider가 생성한 userId를 약관 저장에 사용한다.
 * 기존 사용자 / Recovery는 caller가 이미 가진 context를 closure로 사용할 수 있다.
 */
export type IssueOtpAndSendEmailInput =
  | (NewUserSignupOtpIssueRequest & {
      beforeDelivery?: NewUserSignupBeforeDelivery;
    })
  | (ExistingUserSignupOtpIssueRequest & {
      beforeDelivery?: OtherBeforeDelivery;
    })
  | (ResetPasswordOtpIssueRequest & {
      beforeDelivery?: OtherBeforeDelivery;
    });

/**
 * OTP 발급 및 이메일 발송 과정에서 발생할 수 있는 실패 종류.
 *
 * Provider Rate Limit, Provider/System 오류,
 * 비정상 Provider 응답, Email delivery 오류를 구분한다.
 */
export type IssueOtpAndSendEmailFailureKind =
  | "provider_rate_limit"
  | "provider_error"
  | "invalid_provider_response"
  | "delivery_error";

/**
 * OTP Issue 실패의 내부 관측성에 사용하는 안전한 진단 정보.
 *
 * raw Error 객체나 Provider 전체 응답은 노출하지 않는다.
 */
export type IssueOtpAndSendEmailDiagnostic = {
  errorMessage: string;
  errorName: string;
  errorCode?: string;
};

/**
 * OTP 발급부터 이메일 전송까지의 전체 결과.
 *
 * issueOtp()의 generateLink 결과만을 의미하지 않으며,
 * email_otp 검증과 실제 이메일 delivery까지 포함한
 * OTP Issue operation 전체의 결과 계약이다.
 *
 * beforeDelivery 같은 caller-specific operation failure는
 * 이 typed result로 변환하지 않고 Promise rejection으로 상위에 전달한다.
 */
export type IssueOtpAndSendEmailResult =
  | { ok: true }
  | {
      ok: false;
      kind: IssueOtpAndSendEmailFailureKind;
      diagnostic: IssueOtpAndSendEmailDiagnostic;
    };

/**
 * unknown 오류를 OTP Issue 로그에 전달할 수 있는
 * 최소 diagnostic 형태로 정규화한다.
 *
 * @param error 정규화할 오류 값
 * @returns 안전한 OTP Issue diagnostic
 */
function createIssueDiagnostic(error: unknown): IssueOtpAndSendEmailDiagnostic {
  const normalized = normalizeUnknownError(error);

  if (typeof error !== "object" || error === null) {
    return normalized;
  }

  const errorRecord = error as Record<string, unknown>;
  const errorMessage =
    typeof errorRecord["message"] === "string"
      ? errorRecord["message"]
      : normalized.errorMessage;
  const errorName =
    typeof errorRecord["name"] === "string"
      ? errorRecord["name"]
      : normalized.errorName;
  const errorCode = errorRecord["code"];

  if (typeof errorCode === "string") {
    return {
      errorMessage,
      errorName,
      errorCode,
    };
  }

  return {
    errorMessage,
    errorName,
  };
}

/**
 * caller 입력을 준비된 client와 함께 issueOtp() 입력으로 변환한다.
 *
 * @param input OTP Issue 요청
 * @param client Rate Limit 획득 전에 준비된 OTP Issue client
 * @returns issueOtp() 입력
 */
function runIssueOtp(input: IssueOtpAndSendEmailInput, client: OtpIssueClient) {
  if (input.purpose === "reset-password") {
    return issueOtp({
      email: input.email,
      purpose: "reset-password",
      client,
    });
  }

  if (input.signupMode === "new-user") {
    return issueOtp({
      email: input.email,
      purpose: "signup",
      signupMode: "new-user",
      password: input.password,
      metadata: input.metadata,
      client,
    });
  }

  return issueOtp({
    email: input.email,
    purpose: "signup",
    signupMode: "existing-user",
    client,
  });
}

/**
 * OTP를 발급하고 이메일을 전송한 뒤 결과를 구조화한다.
 *
 * 역할:
 * - Supabase OTP 발급
 * - Provider 오류 분류
 * - email_otp 존재 여부 검증
 * - 신규 Signup userId 존재 여부 검증
 * - caller-specific beforeDelivery 실행
 * - OTP 이메일 발송
 * - Email delivery 실패 분류
 *
 * beforeDelivery는 Email delivery try/catch 밖에서 실행한다.
 * 따라서 해당 hook의 실패는 delivery_error로 오염되지 않고 상위 caller로 reject된다.
 *
 * @param input OTP 발급 입력과 선택적 beforeDelivery hook
 * @param client Rate Limit 획득 전에 준비된 OTP Issue client
 * @returns 구조화된 OTP 발급 및 이메일 전송 결과
 */
async function executeOtpIssueAndSendEmail(
  input: IssueOtpAndSendEmailInput,
  client: OtpIssueClient,
): Promise<IssueOtpAndSendEmailResult> {
  let issueResult: Awaited<ReturnType<typeof issueOtp>>;

  try {
    issueResult = await runIssueOtp(input, client);
  } catch (error) {
    // 예상하지 못한 Provider/network 예외도
    // fail-safe로 Provider 오류로 처리한다.
    return {
      ok: false,
      kind: "provider_error",
      diagnostic: createIssueDiagnostic(error),
    };
  }

  const { otp, userId, error } = issueResult;

  // Supabase가 반환한 structured AuthError는
  // 공통 Provider classifier를 통해 분류한다.
  if (error) {
    return {
      ok: false,
      kind: classifyAuthProviderError(error),
      diagnostic: createIssueDiagnostic(error),
    };
  }

  // generateLink가 오류 없이 종료됐더라도 email_otp가 없으면
  // 정상적인 OTP 발급 성공으로 확정하지 않는다.
  if (!otp?.email_otp) {
    const missingEmailOtpError = new Error(MISSING_EMAIL_OTP_ERROR_MESSAGE);

    return {
      ok: false,
      kind: "invalid_provider_response",
      diagnostic: createIssueDiagnostic(missingEmailOtpError),
    };
  }

  if (input.purpose === "signup" && input.signupMode === "new-user") {
    // 신규 Signup은 generateLink가 사용자 생성도 담당하므로
    // 약관 저장에 필요한 userId가 없으면 정상 응답으로 확정하지 않는다.
    if (!userId) {
      const missingUserIdError = new Error(
        MISSING_SIGNUP_USER_ID_ERROR_MESSAGE,
      );

      return {
        ok: false,
        kind: "invalid_provider_response",
        diagnostic: createIssueDiagnostic(missingUserIdError),
      };
    }

    if (input.beforeDelivery) {
      await input.beforeDelivery({ userId });
    }
  } else if (input.beforeDelivery) {
    await input.beforeDelivery();
  }

  try {
    await sendOtpEmail({
      email: input.email,
      purpose: input.purpose,
      otp: otp.email_otp,
    });
  } catch (error) {
    // Email provider/configuration/전송 계층의 실패는
    // OTP Provider 오류와 구분하여 delivery failure로 처리한다.
    return {
      ok: false,
      kind: "delivery_error",
      diagnostic: createIssueDiagnostic(error),
    };
  }

  return {
    ok: true,
  };
}

/**
 * OTP 발급부터 이메일 전송까지의 typed result를 반환한다.
 *
 * Signup / Recovery / Resend caller가 이 결과를 직접 소비한다.
 *
 * @param input OTP 발급 입력과 선택적 beforeDelivery hook
 * @param client Rate Limit 획득 전에 준비된 OTP Issue client
 * @returns 구조화된 OTP 발급 및 이메일 전송 결과
 */
export async function issueOtpAndSendEmailWithResult(
  input: IssueOtpAndSendEmailInput,
  client: OtpIssueClient,
): Promise<IssueOtpAndSendEmailResult> {
  return executeOtpIssueAndSendEmail(input, client);
}
