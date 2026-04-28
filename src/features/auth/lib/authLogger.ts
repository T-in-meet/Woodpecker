import {
  AuthFailureEvent,
  AuthNonFailureEvent,
  CallbackAuthEvent,
  RequestedAuthEvent,
} from "@/features/auth/constants/authEvents";
import { AuthLogReason } from "@/features/auth/constants/authLogReasons";
import { logError, logInfo, logWarn } from "@/lib/logger";

export type RequestedContext = {
  path: string;
  method: string;
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
  result: "invalid_input";
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
