import type { ZodError } from "zod";

import type { ValidationError } from "@/lib/api/response";
import { VALIDATION_REASON } from "@/lib/constants/validation";

import type { ValidationReason } from "../validation.types";

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
  issue: ZodError["issues"][number],
  input: unknown,
): ValidationReason {
  switch (issue.code) {
    case "invalid_type": {
      const fieldValue = getFieldValue(input, issue.path);
      if (fieldValue === null || fieldValue === undefined) {
        return VALIDATION_REASON.REQUIRED;
      }
      return VALIDATION_REASON.INVALID_TYPE;
    }

    case "too_small": {
      const fieldValue = getFieldValue(input, issue.path);
      if (
        fieldValue === null ||
        fieldValue === undefined ||
        (typeof fieldValue === "string" && fieldValue.trim() === "")
      ) {
        return VALIDATION_REASON.REQUIRED;
      }
      return VALIDATION_REASON.TOO_SHORT;
    }

    case "too_big":
      return VALIDATION_REASON.TOO_LONG;

    case "invalid_format":
      return VALIDATION_REASON.INVALID_FORMAT;

    default:
      return VALIDATION_REASON.INVALID_TYPE;
  }
}

export function mapSignupValidationErrors(
  zodError: ZodError,
  input: unknown,
): ValidationError[] {
  return zodError.issues.map((issue) => ({
    field: String(issue.path[0] ?? "unknown"),
    reason: mapIssueToReason(issue, input),
  }));
}
