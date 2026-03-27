import {
  type ApiCode,
  type ApiResult,
  RESULT_HTTP_STATUS_MAP,
} from "@/lib/constants/apiCodes";

import { ValidationReason } from "../validation/validation.types";

interface SuccessResponse<T> {
  success: true;
  code: ApiCode;
  data: T;
  message?: string;
}

interface FailureResponse {
  success: false;
  code: ApiCode;
  data: null | { errors: ValidationError[] };
  message?: string;
}

export interface ValidationError {
  field: string;
  reason: ValidationReason;
}

function getResultFromCode(code: string): ApiResult | undefined {
  const results = Object.keys(RESULT_HTTP_STATUS_MAP) as ApiResult[];
  return results.find((result) => code.endsWith(`_${result}`));
}

function getStatusFromCode(code: ApiCode, override?: number): number {
  if (override !== undefined) return override;
  const result = getResultFromCode(code);
  return result ? (RESULT_HTTP_STATUS_MAP[result] ?? 500) : 500;
}

export function successResponse<T>(
  code: ApiCode,
  data: T,
  options?: { status?: number; message?: string },
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    code,
    data,
    ...(options?.message ? { message: options.message } : {}),
  };

  return Response.json(body, {
    status: options?.status ?? getStatusFromCode(code),
  });
}

export function failureResponse(
  code: ApiCode,
  options?: {
    errors?: ValidationError[];
    status?: number;
    message?: string;
  },
): Response {
  const body: FailureResponse = {
    success: false,
    code,
    data: options?.errors ? { errors: options.errors } : null,
    ...(options?.message ? { message: options.message } : {}),
  };

  return Response.json(body, {
    status: options?.status ?? getStatusFromCode(code),
  });
}
