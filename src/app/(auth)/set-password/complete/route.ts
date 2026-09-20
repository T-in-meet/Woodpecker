import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import {
  AUTH_LOG_REASONS,
  type AuthLogReason,
} from "@/features/auth/constants/authLogReasons";
import {
  SET_PASSWORD_COMPLETE_PATH,
  SET_PASSWORD_INTENT_CLEANUP_PATH,
} from "@/features/auth/constants/routes";
import {
  logAuthError,
  logAuthEvent,
  logRequested,
  normalizeUnknownError,
} from "@/features/auth/lib/authLogger";
import { getHasPasswordLogin } from "@/features/auth/lib/getHasPasswordLogin";
import {
  clearSetPasswordIntent,
  readSetPasswordIntent,
  verifySetPasswordIntent,
} from "@/features/auth/lib/setPasswordIntent";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

function logRejected(
  reasonCode: (typeof AUTH_LOG_REASONS)[keyof typeof AUTH_LOG_REASONS],
) {
  logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_REJECTED, {
    path: SET_PASSWORD_COMPLETE_PATH,
    method: "GET",
    status: 303,
    provider: "password",
    result: "rejected",
    reasonCode,
  });
}

function logFailed(
  error: unknown,
  reasonCode: AuthLogReason = AUTH_LOG_REASONS.INTERNAL_ERROR,
) {
  const normalized = normalizeUnknownError(error);

  logAuthError(AUTH_EVENTS.AUTH_SET_PASSWORD_FAILED, {
    path: SET_PASSWORD_COMPLETE_PATH,
    method: "GET",
    status: 500,
    provider: "password",
    result: "failure",
    reasonCode,
    ...normalized,
  });
}

export async function GET(request: Request) {
  logRequested(AUTH_EVENTS.AUTH_SET_PASSWORD_REQUESTED, {
    path: SET_PASSWORD_COMPLETE_PATH,
    method: "GET",
    provider: "password",
  });

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user: Awaited<
    ReturnType<(typeof supabase)["auth"]["getUser"]>
  >["data"]["user"];

  try {
    supabase = await createClient();

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      if (isAuthSessionMissingError(userError)) {
        logRejected(AUTH_LOG_REASONS.INVALID_CREDENTIALS);
        return redirectTo(request, SET_PASSWORD_INTENT_CLEANUP_PATH);
      }

      throw userError;
    }

    if (!currentUser) {
      logRejected(AUTH_LOG_REASONS.INVALID_CREDENTIALS);
      return redirectTo(request, SET_PASSWORD_INTENT_CLEANUP_PATH);
    }

    user = currentUser;
  } catch (error) {
    logFailed(error);
    throw error;
  }

  let rawIntent: string | null;

  try {
    rawIntent = await readSetPasswordIntent();
  } catch (error) {
    logFailed(error);
    throw error;
  }

  if (rawIntent === null) {
    logRejected(AUTH_LOG_REASONS.INVALID_CREDENTIALS);
    return redirectTo(request, SET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  let verifiedIntent;

  try {
    verifiedIntent = verifySetPasswordIntent({
      token: rawIntent,
      expectedUserId: user.id,
    });
  } catch (error) {
    logFailed(error);
    throw error;
  }

  if (!verifiedIntent) {
    logRejected(AUTH_LOG_REASONS.INVALID_CREDENTIALS);
    return redirectTo(request, SET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  const finalRedirectPath = validateRedirectPath(verifiedIntent.redirectPath);

  let hasPasswordLogin: boolean;

  try {
    hasPasswordLogin = await getHasPasswordLogin(user.id);
  } catch (error) {
    logFailed(error);
    throw error;
  }

  if (!hasPasswordLogin) {
    logRejected(AUTH_LOG_REASONS.SET_PASSWORD_INCOMPLETE);
    return redirectTo(request, ROUTES.SET_PASSWORD);
  }

  try {
    await clearSetPasswordIntent();
  } catch (error) {
    logFailed(error, AUTH_LOG_REASONS.PASSWORD_INTENT_CLEANUP_FAILED);
    throw error;
  }

  logAuthEvent(AUTH_EVENTS.AUTH_SET_PASSWORD_COMPLETED, {
    path: SET_PASSWORD_COMPLETE_PATH,
    method: "GET",
    status: 303,
    provider: "password",
    result: "success",
  });

  return redirectTo(request, finalRedirectPath);
}
