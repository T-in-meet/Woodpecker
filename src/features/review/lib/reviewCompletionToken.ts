import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const REVIEW_COMPLETION_TOKEN_PURPOSE = "review-completion.v1";
export const REVIEW_COMPLETION_TOKEN_TTL_SECONDS = 10 * 60;

const reviewCompletionTokenBasePayloadSchema = z.object({
  noteId: z.string().uuid(),
  reviewLogId: z.string().uuid(),
  userId: z.string().min(1),
});

const reviewCompletionTokenPayloadSchema =
  reviewCompletionTokenBasePayloadSchema
    .extend({
      issuedAt: z.number().int().nonnegative(),
      expiresAt: z.number().int().positive(),
    })
    .refine((payload) => payload.expiresAt > payload.issuedAt, {
      message: "Review completion token expiration must be after issuance.",
      path: ["expiresAt"],
    });

type ReviewCompletionTokenPayload = z.infer<
  typeof reviewCompletionTokenBasePayloadSchema
>;

function getReviewCompletionTokenSecret() {
  const secret = process.env.REVIEW_COMPLETION_TOKEN_SECRET;

  if (!secret) {
    throw new Error("Review completion token secret is not configured.");
  }

  return secret;
}

function getCurrentUnixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function signReviewCompletionTokenPayload(encodedPayload: string) {
  return createHmac("sha256", getReviewCompletionTokenSecret())
    .update(`${REVIEW_COMPLETION_TOKEN_PURPOSE}:${encodedPayload}`)
    .digest();
}

export function createReviewCompletionToken(
  payload: ReviewCompletionTokenPayload,
) {
  const issuedAt = getCurrentUnixTimestamp();
  const encodedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      issuedAt,
      expiresAt: issuedAt + REVIEW_COMPLETION_TOKEN_TTL_SECONDS,
    }),
  ).toString("base64url");
  const signature =
    signReviewCompletionTokenPayload(encodedPayload).toString("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyReviewCompletionToken(
  token: string,
  expectedPayload: ReviewCompletionTokenPayload,
) {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, encodedSignature] = parts;

  if (!encodedPayload || !encodedSignature) {
    return false;
  }

  let providedSignature: Buffer;

  try {
    providedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return false;
  }

  const expectedSignature = signReviewCompletionTokenPayload(encodedPayload);

  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return false;
  }

  let rawPayload: unknown;

  try {
    rawPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return false;
  }

  const parsedPayload =
    reviewCompletionTokenPayloadSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    return false;
  }

  if (parsedPayload.data.expiresAt <= getCurrentUnixTimestamp()) {
    return false;
  }

  return (
    parsedPayload.data.noteId === expectedPayload.noteId &&
    parsedPayload.data.reviewLogId === expectedPayload.reviewLogId &&
    parsedPayload.data.userId === expectedPayload.userId
  );
}
