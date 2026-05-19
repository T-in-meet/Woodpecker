import {
  AuthFailureEvent,
  AuthNonFailureEvent,
  CallbackAuthEvent,
  RequestedAuthEvent,
} from "@/features/auth/constants/authEvents";
import { AuthLogReason } from "@/features/auth/constants/authLogReasons";
import { logError, logInfo, logWarn } from "@/lib/logger";

import { OtpPurpose } from "../constants/otp";

/**
 * 인증 요청이 시작되었음을 기록하기 위한 공통 로그 컨텍스트.
 *
 * 사용 목적:
 * - 어떤 인증 경로(path)로 요청이 들어왔는지 추적
 * - 어떤 HTTP method로 요청되었는지 확인
 * - 어떤 인증 방식(provider)인지 구분
 *
 * 주로 REQUEST 단계 로그에서 사용되며,
 * 실제 인증 성공/실패 이전의 "진입 정보"를 기록하는 역할이다.
 *
 * 예시:
 * {
 *   path: "/verify-otp",
 *   method: "POST",
 *   provider: "otp",
 * }
 */
export type RequestedContext = {
  /**
   * 인증 요청이 들어온 경로.
   *
   * 예:
   * - /login
   * - /signup
   * - /verify-otp
   */
  path: string;

  /**
   * 요청에 사용된 HTTP method.
   *
   * 예:
   * - GET
   * - POST
   */
  method: string;

  /**
   * 인증 방식 또는 provider 식별값.
   *
   * 예:
   * - otp
   * - oauth-google
   * - password
   * - recovery
   */
  provider: string;
};

type CommonLogFields = {
  path: string;
  method: string;
  status: number;
  provider: string;
  userId?: string;
  maskedEmail?: string;
  maskedIp?: string;
  purpose?: OtpPurpose;
};

type SuccessLogContext = CommonLogFields & {
  result: "success";
  reasonCode?: never;
};

type BlockedLogContext = CommonLogFields & {
  result: "blocked";
  reasonCode: AuthLogReason;
};

type RejectedLogContext = CommonLogFields & {
  result: "rejected";
  reasonCode: AuthLogReason;
};

type InvalidInputLogContext = CommonLogFields & {
  result: "failure";
  reasonCode: AuthLogReason;
};

export type AuthEventContext =
  | SuccessLogContext
  | BlockedLogContext
  | RejectedLogContext
  | InvalidInputLogContext;

export type AuthErrorContext = CommonLogFields & {
  result: "failure";
  reasonCode: AuthLogReason;
  errorMessage?: string;
  errorName?: string;
  errorCode?: string;
};

export type CallbackContext = {
  path: string;
  method: string;
  status: number;
  provider: string;
};

type LogEntry<E extends string, C extends object> = { event: E } & C;

export function logRequested(
  event: RequestedAuthEvent,
  ctx: RequestedContext,
): void {
  const entry: LogEntry<RequestedAuthEvent, RequestedContext> = {
    event,
    ...ctx,
  };
  logInfo(entry);
}

export function logAuthEvent(
  event: AuthNonFailureEvent,
  ctx: AuthEventContext,
): void {
  const entry: LogEntry<AuthNonFailureEvent, AuthEventContext> = {
    event,
    ...ctx,
  };

  if (ctx.result === "success") {
    logInfo(entry);
    return;
  }

  if (ctx.result === "blocked") {
    logWarn(entry);
    return;
  }

  if (ctx.result === "rejected") {
    logWarn(entry);
    return;
  }

  logWarn(entry);
}

export function logAuthError(
  event: AuthFailureEvent,
  ctx: AuthErrorContext,
): void {
  const entry: LogEntry<AuthFailureEvent, AuthErrorContext> = { event, ...ctx };
  logError(entry);
}

/**
 * Callback 전용 로깅 (특수 케이스)
 *
 * 중요:
 * - callback 흐름은 다른 auth 흐름과 다르게 처리된다.
 * - AUTH_CALLBACK_REJECTED는 시스템 에러를 의미하지 않는다.
 *   (잘못된 링크, 만료된 토큰 등 "예상 가능한 분기"를 의미한다)
 *
 * 설계 의도:
 * - callback 실패는 외부 동작을 동일하게 맞추기 위해 하나의 흐름으로 정규화된다.
 * - 따라서 ERROR가 아니라 INFO로 기록한다.
 *
 * 금지:
 * - AUTH_CALLBACK_REJECTED를 예외/장애 로그로 취급하지 말 것
 * - logError로 보내지 말 것
 */
export function logCallback(
  event: CallbackAuthEvent,
  ctx: CallbackContext,
): void {
  const entry: LogEntry<CallbackAuthEvent, CallbackContext> = { event, ...ctx };
  logInfo(entry);
}

export function normalizeUnknownError(error: unknown): {
  errorMessage: string;
  errorName: string;
} {
  if (error instanceof Error) {
    return { errorMessage: error.message, errorName: error.name };
  }
  return { errorMessage: String(error), errorName: "UnknownError" };
}
