import {
  MISSING_EMAIL_OTP_ERROR_MESSAGE,
  type OtpPurpose,
} from "../constants/otp";
import { normalizeUnknownError } from "../lib/authLogger";
import { classifyAuthProviderError } from "../lib/classifyAuthProviderError";
import {
  createOtpIssueClient,
  issueOtp,
  type OtpIssueClient,
} from "../lib/issueOtp";
import { sendOtpEmail } from "./sendOtpEmail";

type IssueOtpAndSendEmailProps = {
  email: string;
  purpose: OtpPurpose;
};

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
 */
export type IssueOtpAndSendEmailResult =
  | { ok: true }
  | {
      ok: false;
      kind: IssueOtpAndSendEmailFailureKind;
      diagnostic: IssueOtpAndSendEmailDiagnostic;
    };

/**
 * Step 10 compatibility wrapper가 기존 throw semantics를
 * 보존하기 위해 사용하는 내부 실행 결과.
 *
 * compatibilityError는 typed result의 public contract에는 노출하지 않는다.
 */
type IssueOtpAndSendEmailExecutionResult =
  | { ok: true }
  | {
      ok: false;
      kind: IssueOtpAndSendEmailFailureKind;
      diagnostic: IssueOtpAndSendEmailDiagnostic;
      compatibilityError: unknown;
    };

/**
 * unknown 오류를 OTP Issue 로그에 전달할 수 있는
 * 최소 diagnostic 형태로 정규화한다.
 *
 * @param error 정규화할 오류 값
 * @returns 안전한 OTP Issue diagnostic
 */
function createIssueDiagnostic(
  error: unknown,
): IssueOtpAndSendEmailDiagnostic {
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
 * OTP를 발급하고 이메일을 전송한 뒤 결과를 구조화한다.
 *
 * 역할:
 * - Supabase OTP 발급
 * - Provider 오류 분류
 * - email_otp 존재 여부 검증
 * - OTP 이메일 발송
 * - Email delivery 실패 분류
 *
 * @param input OTP 발급에 사용할 이메일과 purpose
 * @param client Rate Limit 획득 전에 준비된 OTP Issue client
 * @returns OTP 발급 및 이메일 전송 내부 실행 결과
 */
async function executeOtpIssueAndSendEmail(
  { email, purpose }: IssueOtpAndSendEmailProps,
  client: OtpIssueClient,
): Promise<IssueOtpAndSendEmailExecutionResult> {
  let issueResult: Awaited<ReturnType<typeof issueOtp>>;

  try {
    issueResult = await issueOtp({
      email,
      purpose,
      client,
    });
  } catch (error) {
    // 예상하지 못한 Provider/network 예외도
    // fail-safe로 Provider 오류로 처리한다.
    return {
      ok: false,
      kind: "provider_error",
      diagnostic: createIssueDiagnostic(error),
      compatibilityError: error,
    };
  }

  const { otp, error } = issueResult;

  // Supabase가 반환한 structured AuthError는
  // 공통 Provider classifier를 통해 분류한다.
  if (error) {
    return {
      ok: false,
      kind: classifyAuthProviderError(error),
      diagnostic: createIssueDiagnostic(error),

      // 기존 caller는 Provider error message를 가진
      // 새로운 Error를 전달받아 왔으므로 해당 계약을 유지한다.
      compatibilityError: new Error(error.message),
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
      compatibilityError: missingEmailOtpError,
    };
  }

  try {
    await sendOtpEmail({
      email,
      purpose,
      otp: otp.email_otp,
    });
  } catch (error) {
    // Email provider/configuration/전송 계층의 실패는
    // OTP Provider 오류와 구분하여 delivery failure로 처리한다.
    return {
      ok: false,
      kind: "delivery_error",
      diagnostic: createIssueDiagnostic(error),
      compatibilityError: error,
    };
  }

  return {
    ok: true,
  };
}

/**
 * OTP 발급부터 이메일 전송까지의 typed result를 반환한다.
 *
 * Step 11에서 Signup / Recovery / Resend caller가
 * 이 결과를 직접 소비하도록 전환한다.
 *
 * @param input OTP 발급에 사용할 이메일과 purpose
 * @param client Rate Limit 획득 전에 준비된 OTP Issue client
 * @returns 구조화된 OTP 발급 및 이메일 전송 결과
 */
export async function issueOtpAndSendEmailWithResult(
  input: IssueOtpAndSendEmailProps,
  client: OtpIssueClient,
): Promise<IssueOtpAndSendEmailResult> {
  const result = await executeOtpIssueAndSendEmail(input, client);

  if (result.ok) {
    return result;
  }

  return {
    ok: false,
    kind: result.kind,
    diagnostic: result.diagnostic,
  };
}

/**
 * #401 Step 10 compatibility wrapper.
 *
 * 기존 Signup / Recovery / Resend caller가 의존하는
 * 실패 시 throw 계약을 Step 11 전환 전까지 보존한다.
 *
 * TODO(#401 Step 11):
 * Signup / Recovery / Resend가 IssueOtpAndSendEmailResult를
 * 직접 소비하도록 전환한 뒤 이 wrapper와 wrapper 전용 테스트를 제거한다.
 *
 * 이후 issueOtpAndSendEmail의 최종 public contract는
 * typed result 반환 방식으로 정리한다.
 *
 * @param input OTP 발급에 사용할 이메일과 purpose
 */
export async function issueOtpAndSendEmail(
  input: IssueOtpAndSendEmailProps,
): Promise<void> {
  const client = createOtpIssueClient();
  const result = await executeOtpIssueAndSendEmail(input, client);

  if (!result.ok) {
    throw result.compatibilityError;
  }
}
