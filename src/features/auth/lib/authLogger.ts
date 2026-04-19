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

export type BaseLogContext = {
  path: string;
  method: string;
  status: number;
  provider: string;
  result: "success" | "failure" | "blocked";
  // reasonCode는 failure/blocked 이벤트에만 적용되며 success(COMPLETED)에는 불필요
  reasonCode?: AuthLogReason;
  userId?: string;
  maskedEmail?: string;
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
  event: RequestedEvent,
  ctx: RequestedContext,
): void {
  const entry: LogEntry<RequestedEvent, RequestedContext> = { event, ...ctx };
  logInfo(entry);
}

export function logAuthEvent(event: BaseAuthEvent, ctx: BaseLogContext): void {
  const entry: LogEntry<BaseAuthEvent, BaseLogContext> = { event, ...ctx };
  if (ctx.result === "failure" || ctx.result === "blocked") {
    logWarn(entry);
  } else {
    logInfo(entry);
  }
}

export function logAuthError(event: BaseAuthEvent, ctx: BaseLogContext): void {
  const entry: LogEntry<BaseAuthEvent, BaseLogContext> = { event, ...ctx };
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
