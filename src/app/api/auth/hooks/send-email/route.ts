import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { encryptTicket } from "@/features/auth/email/ticket";
import { failureResponse, successResponse } from "@/features/auth/lib/response";

export async function POST(request: NextRequest): Promise<Response> {
  const hookSecret = request.headers.get("x-hook-secret");
  const expectedSecret = process.env["SUPABASE_HOOK_SECRET"];

  if (!expectedSecret || hookSecret !== expectedSecret) {
    return failureResponse(AUTH_API_CODES.SEND_EMAIL_HOOK_UNAUTHORIZED);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failureResponse(AUTH_API_CODES.SEND_EMAIL_HOOK_INVALID_INPUT);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>)["user"] !== "object" ||
    (body as Record<string, unknown>)["user"] === null ||
    typeof (
      (body as Record<string, unknown>)["user"] as Record<string, unknown>
    )["email"] !== "string" ||
    typeof (body as Record<string, unknown>)["email_data"] !== "object" ||
    (body as Record<string, unknown>)["email_data"] === null ||
    typeof (
      (body as Record<string, unknown>)["email_data"] as Record<string, unknown>
    )["token_hash"] !== "string"
  ) {
    return failureResponse(AUTH_API_CODES.SEND_EMAIL_HOOK_INVALID_INPUT);
  }

  const rawEmail = (
    (body as Record<string, unknown>)["user"] as Record<string, unknown>
  )["email"] as string;
  const email = rawEmail.trim().toLowerCase();
  const tokenHash = (
    (body as Record<string, unknown>)["email_data"] as Record<string, unknown>
  )["token_hash"] as string;

  try {
    const ticket = encryptTicket(tokenHash);
    await sendAuthEmail(email, ticket, "verify-email");
  } catch {
    return failureResponse(AUTH_API_CODES.SEND_EMAIL_HOOK_INTERNAL_ERROR);
  }

  return successResponse(AUTH_API_CODES.SEND_EMAIL_HOOK_SUCCESS, null);
}
