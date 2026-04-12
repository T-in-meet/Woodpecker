import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const REVIEW_COMPLETION_TOKEN_PURPOSE = "review-completion.v1";

const reviewCompletionTokenPayloadSchema = z.object({
  noteId: z.string().uuid(),
  reviewLogId: z.string().uuid(),
  userId: z.string().min(1),
});

type ReviewCompletionTokenPayload = z.infer<
  typeof reviewCompletionTokenPayloadSchema
>;

function getReviewCompletionTokenSecret() {
  const secret =
    process.env.REVIEW_COMPLETION_TOKEN_SECRET ??
    process.env.EMAIL_TICKET_SECRET;

  if (!secret) {
    throw new Error("Review completion token secret is not configured.");
  }

  return secret;
}

function signReviewCompletionTokenPayload(encodedPayload: string) {
  return createHmac("sha256", getReviewCompletionTokenSecret())
    .update(`${REVIEW_COMPLETION_TOKEN_PURPOSE}:${encodedPayload}`)
    .digest();
}

export function createReviewCompletionToken(
  payload: ReviewCompletionTokenPayload,
) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
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

  return (
    parsedPayload.data.noteId === expectedPayload.noteId &&
    parsedPayload.data.reviewLogId === expectedPayload.reviewLogId &&
    parsedPayload.data.userId === expectedPayload.userId
  );
}
