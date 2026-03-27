import { z } from "zod";

import type { ValidationError } from "@/lib/api/response";
import { VALIDATION_REASON } from "@/lib/constants/validation";

import { ValidationReason } from "../validation.types";

function mapIssueToReason(issue: z.ZodIssue): ValidationReason {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.input === null) {
        return VALIDATION_REASON.REQUIRED;
      }
      return VALIDATION_REASON.INVALID_TYPE;

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
): ValidationError[] {
  return zodError.issues.map((issue) => ({
    field: String(issue.path[0] ?? "unknown"),
    reason: mapIssueToReason(issue),
  }));
}
