type ServerValidationError = {
  success: false;
  code: string;
  data: {
    errors: Array<{ field: string; reason: string }>;
  };
};

export function isServerValidationError(
  e: unknown,
): e is ServerValidationError {
  if (typeof e !== "object" || e === null) return false;
  const obj = e as Record<string, unknown>;
  if (obj["success"] !== false) return false;
  if (obj["code"] !== "AUTH_INVALID_INPUT") return false;
  if (typeof obj["data"] !== "object" || obj["data"] === null) return false;
  const data = obj["data"] as Record<string, unknown>;
  return (
    Array.isArray(data["errors"]) &&
    (data["errors"] as unknown[]).every(
      (err) =>
        typeof err === "object" &&
        err !== null &&
        typeof (err as Record<string, unknown>)["field"] === "string" &&
        typeof (err as Record<string, unknown>)["reason"] === "string",
    )
  );
}
