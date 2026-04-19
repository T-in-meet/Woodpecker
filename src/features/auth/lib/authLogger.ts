import {
  BaseAuthEvent,
  CallbackAuthEvent,
  RequestedEvent,
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
};

type SuccessLogContext = CommonLogFields & {
  result: "success";
  reasonCode?: never;
};

type BlockedLogContext = CommonLogFields & {
  result: "blocked";
  reasonCode: AuthLogReason;
};

export type AuthEventContext = SuccessLogContext | BlockedLogContext;

export type AuthErrorContext = CommonLogFields & {
  result: "failure";
  reasonCode: AuthLogReason;
  errorMessage?: string;
  errorName?: string;
  errorCode?: string;
};

export type AuthFailureEvent =
  | "AUTH_SIGNUP_FAILED"
  | "AUTH_RESEND_FAILED"
  | "AUTH_CALLBACK_FAILED";

export type AuthNonFailureEvent = Exclude<BaseAuthEvent, AuthFailureEvent>;

export type CallbackContext = {
  path: string;
  method: string;
  status: number;
  provider: string;
};

type LogEntry<E extends string, C extends object> = { event: E } & C;

export function logRequested(
  event: RequestedEvent,
  ctx: RequestedContext,
): void {
  const entry: LogEntry<RequestedEvent, RequestedContext> = { event, ...ctx };
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

  if (ctx.result === "blocked") {
    logWarn(entry);
    return;
  }

  logInfo(entry);
}

export function logAuthError(
  event: AuthFailureEvent,
  ctx: AuthErrorContext,
): void {
  const entry: LogEntry<AuthFailureEvent, AuthErrorContext> = { event, ...ctx };
  logError(entry);
}

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
