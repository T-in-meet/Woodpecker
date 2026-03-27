import { z } from "zod";

import type { ValidationError } from "@/lib/api/response";
import { VALIDATION_REASON } from "@/lib/constants/validation";

import { ValidationReason } from "../validation.types";

function getFieldValue(
  input: unknown,
  path: (string | number | symbol)[],
): unknown {
  return path.reduce<unknown>(
    (obj, key) =>
      obj !== null && typeof obj === "object"
        ? (obj as Record<string | number, unknown>)[key as string | number]
        : obj,
    input,
  );
}

function mapIssueToReason(
  issue: z.ZodError["issues"][number],
  input: unknown,
): ValidationReason {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type: {
      const fieldValue = getFieldValue(input, issue.path);
      if (fieldValue === null || fieldValue === undefined) {
        return VALIDATION_REASON.REQUIRED;
      }
      return VALIDATION_REASON.INVALID_TYPE;
    }

    case z.ZodIssueCode.too_small:
      return VALIDATION_REASON.REQUIRED;

    case z.ZodIssueCode.too_big:
      return VALIDATION_REASON.TOO_LONG;

    case z.ZodIssueCode.invalid_format:
      return VALIDATION_REASON.INVALID_FORMAT;

    default:
      return VALIDATION_REASON.INVALID_TYPE;
  }
}

export function mapSignupValidationErrors(
  zodError: z.ZodError,
  input: unknown,
): ValidationError[] {
  return zodError.issues.map((issue) => ({
    field: String(issue.path[0] ?? "unknown"),
    reason: mapIssueToReason(issue, input),
  }));
}
