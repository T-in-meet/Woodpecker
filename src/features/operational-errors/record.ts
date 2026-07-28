import { createHash } from "node:crypto";

import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import {
  OPERATIONAL_ERROR_SEVERITY,
  OPERATIONAL_ERROR_STATUS,
  type OperationalErrorSeverityType,
} from "./constants";

/** 운영 오류 Context에 저장할 수 있는 최대 객체 중첩 깊이 */
const MAX_CONTEXT_DEPTH = 4;

/** 운영 오류 Context의 객체별 최대 속성 개수 */
const MAX_CONTEXT_KEYS = 40;

/** 운영 오류 Context의 배열별 최대 요소 개수 */
const MAX_ARRAY_LENGTH = 20;

/** 운영 오류 Context에 저장할 일반 문자열의 최대 길이 */
const MAX_STRING_LENGTH = 1000;

/** 운영 오류에 저장할 Stack Trace의 최대 길이 */
const MAX_STACK_LENGTH = 4000;

/**
 * 운영 오류 Context에서 제거할 민감 정보의 키 패턴입니다.
 *
 * 인증 정보, 비밀번호, Push 구독 키, SMTP 및 서비스 키처럼
 * 로그나 데이터베이스에 평문으로 저장되면 안 되는 값을 대상으로 합니다.
 */
const SENSITIVE_KEY_PATTERN =
  /auth|authorization|cookie|endpoint|key|otp|p256dh|pass|password|secret|service_role|smtp|token|vapid/i;

/** Supabase JSON 컬럼에 저장할 객체 형태 */
type JsonObject = Record<string, Json>;

/**
 * 운영 오류 기록에 필요한 Supabase Client의 최소 인터페이스입니다.
 *
 * 테스트에서 실제 Admin Client 대신 Stub Client를 주입할 수 있도록
 * `from` 메서드만 추출해 사용합니다.
 */
type OperationalErrorClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from"
>;

/**
 * 운영 오류 기록에 필요한 입력값입니다.
 */
export type RecordOperationalErrorInput = {
  /** 오류가 발생한 작업을 수행한 사용자 또는 관리자 ID */
  actorUserId?: string | null;

  /** 오류 분석에 필요한 추가 실행 정보 */
  context?: JsonObject;

  /** 원본 Error 또는 외부 라이브러리에서 반환된 오류 값 */
  error?: unknown;

  /** 오류 종류를 식별하는 애플리케이션 오류 코드 */
  errorCode: string;

  /** 오류가 발생한 기능 영역 */
  feature: string;

  /**
   * 동일 오류의 집계 범위를 세분화할 추가 값입니다.
   *
   * 사용자 ID처럼 값의 종류가 지나치게 많은 정보는 포함하지 않는 것이 좋습니다.
   */
  fingerprintParts?: readonly string[];

  /** 관리자 화면에 표시할 오류 설명 */
  message: string;

  /** 오류가 발생한 작업 */
  operation: string;

  /** 오류의 심각도 */
  severity?: OperationalErrorSeverityType;

  /** 작업 내부에서 오류가 발생한 세부 단계 */
  stage: string;

  /** 오류의 영향을 받은 사용자 ID */
  userId?: string | null;
};

/**
 * 운영 오류 기록 결과입니다.
 *
 * 기록 성공 시 신규 오류 생성 여부 또는 기존 오류 집계 여부를 반환하며,
 * 기록 자체가 실패한 경우 원본 오류를 반환합니다.
 */
export type RecordOperationalErrorResult =
  | {
      id: string | null;
      ok: true;
      recorded: "aggregated" | "created";
    }
  | {
      error: unknown;
      ok: false;
    };

/**
 * 문자열이 최대 길이를 초과하면 잘라내고 생략 표시를 추가합니다.
 */
function truncateString(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

/**
 * 알 수 없는 값을 Supabase JSON 컬럼에 안전하게 저장할 수 있는 값으로 변환합니다.
 *
 * 객체 깊이, 속성 개수, 배열 길이와 문자열 길이를 제한하고,
 * 민감 정보로 판단되는 키의 값은 저장하지 않습니다.
 */
function sanitizeJsonValue(value: unknown, depth = 0): Json {
  if (depth >= MAX_CONTEXT_DEPTH) {
    return "[Max depth reached]";
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return typeof value === "string"
      ? truncateString(value, MAX_STRING_LENGTH)
      : value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeJsonValue(item, depth + 1));
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(
    0,
    MAX_CONTEXT_KEYS,
  );
  const sanitized: JsonObject = {};

  for (const [key, nestedValue] of entries) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[Redacted]"
      : sanitizeJsonValue(nestedValue, depth + 1);
  }

  return sanitized;
}

/**
 * 원본 오류를 운영 오류 Context에 저장할 수 있는 형태로 변환합니다.
 *
 * 표준 Error 객체는 이름, 메시지와 Stack Trace를 저장하고,
 * 그 외의 오류 값은 일반 JSON 값으로 정제해 저장합니다.
 */
function createErrorContext(error: unknown): JsonObject | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    const context: JsonObject = {
      message: truncateString(error.message, MAX_STRING_LENGTH),
      name: error.name,
    };

    if (error.stack) {
      context.stack = truncateString(error.stack, MAX_STACK_LENGTH);
    }

    return context;
  }

  return {
    value: sanitizeJsonValue(error),
  };
}

/**
 * 동일한 운영 오류를 식별하기 위한 SHA-256 Fingerprint를 생성합니다.
 *
 * 기능, 작업, 단계와 오류 코드를 기본 식별값으로 사용하며,
 * 필요한 경우 fingerprintParts로 집계 범위를 세분화할 수 있습니다.
 */
function createFingerprint(input: RecordOperationalErrorInput) {
  const parts = [
    input.feature,
    input.operation,
    input.stage,
    input.errorCode,
    ...(input.fingerprintParts ?? []),
  ];
  const source = parts.map((part) => part.trim()).join("|");

  return createHash("sha256").update(source).digest("hex");
}

/**
 * 호출자가 전달한 Context와 원본 오류 정보를 하나의 Context로 구성합니다.
 */
function createOperationalErrorContext(
  input: RecordOperationalErrorInput,
): JsonObject {
  const context = sanitizeJsonValue(input.context ?? {}) as JsonObject;
  const errorContext = createErrorContext(input.error);

  if (errorContext) {
    context.error = errorContext;
  }

  return context;
}

/**
 * 새로운 운영 오류를 OPEN 상태로 저장합니다.
 */
async function insertOperationalError(
  client: OperationalErrorClient,
  input: RecordOperationalErrorInput,
  fingerprint: string,
  context: JsonObject,
) {
  return await client
    .from("operational_errors")
    .insert({
      actor_user_id: input.actorUserId ?? null,
      context,
      error_code: input.errorCode,
      feature: input.feature,
      fingerprint,
      message: input.message,
      operation: input.operation,
      severity: input.severity ?? OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: input.stage,
      status: OPERATIONAL_ERROR_STATUS.OPEN,
      user_id: input.userId ?? null,
    })
    .select("id")
    .maybeSingle();
}

/**
 * 동일한 Fingerprint를 가진 OPEN 오류에 최근 발생 정보를 반영합니다.
 *
 * 발생 횟수를 증가시키고, 마지막 발생 시각과 최신 Context 및 메시지로
 * 기존 운영 오류 레코드를 갱신합니다.
 */
async function aggregateOperationalError(
  client: OperationalErrorClient,
  existingError: { id: string; occurrence_count: number },
  input: RecordOperationalErrorInput,
  context: JsonObject,
) {
  return await client
    .from("operational_errors")
    .update({
      actor_user_id: input.actorUserId ?? null,
      context,
      last_seen_at: new Date().toISOString(),
      message: input.message,
      occurrence_count: existingError.occurrence_count + 1,
      severity: input.severity ?? OPERATIONAL_ERROR_SEVERITY.ERROR,
      user_id: input.userId ?? null,
    })
    .eq("id", existingError.id)
    .select("id")
    .maybeSingle();
}

/**
 * PostgreSQL Unique Constraint 위반 오류인지 확인합니다.
 */
function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

/**
 * 운영 오류 기록 자체가 실패한 경우 애플리케이션 Logger에 남깁니다.
 *
 * 운영 오류를 다시 operational_errors에 기록하면 재귀적인 실패가 발생할 수 있으므로
 * 별도의 Logger만 사용합니다.
 */
function logRecordFailure(error: unknown, input: RecordOperationalErrorInput) {
  logError({
    error,
    event: "operationalErrors.record.failed",
    fallback: {
      errorCode: input.errorCode,
      feature: input.feature,
      operation: input.operation,
      stage: input.stage,
    },
  });
}

/**
 * 기능 실행 중 발생한 오류를 운영 오류 테이블에 기록합니다.
 *
 * 동일한 Fingerprint를 가진 OPEN 오류가 있으면 새 레코드를 만들지 않고
 * 발생 횟수와 최근 발생 정보를 갱신합니다.
 *
 * 조회와 삽입 사이에 동일 오류가 동시에 생성되어 Unique Constraint가 발생하면
 * 다시 조회하여 기존 오류에 집계합니다.
 *
 * 운영 오류 기록 실패가 원래 기능의 실패로 전파되지 않도록 예외를 던지지 않고
 * 성공 또는 실패 결과 객체를 반환합니다.
 *
 * @param input 기록할 운영 오류 정보
 * @param options 테스트 또는 특수한 실행 환경에서 사용할 Supabase Client
 * @returns 운영 오류 생성 또는 집계 결과
 */
export async function recordOperationalError(
  input: RecordOperationalErrorInput,
  options: { supabase?: OperationalErrorClient } = {},
): Promise<RecordOperationalErrorResult> {
  try {
    const supabase = options.supabase ?? createAdminClient();
    const fingerprint = createFingerprint(input);
    const context = createOperationalErrorContext(input);

    const { data: existingError, error: existingErrorLookupError } =
      await supabase
        .from("operational_errors")
        .select("id, occurrence_count")
        .eq("fingerprint", fingerprint)
        .eq("status", OPERATIONAL_ERROR_STATUS.OPEN)
        .maybeSingle();

    if (existingErrorLookupError) {
      throw existingErrorLookupError;
    }

    if (existingError) {
      const { data, error } = await aggregateOperationalError(
        supabase,
        existingError,
        input,
        context,
      );

      if (error) {
        throw error;
      }

      return {
        id: data?.id ?? existingError.id,
        ok: true,
        recorded: "aggregated",
      };
    }

    const { data, error } = await insertOperationalError(
      supabase,
      input,
      fingerprint,
      context,
    );

    if (error) {
      if (isUniqueViolation(error)) {
        return recordOperationalError(input, options);
      }

      throw error;
    }

    return {
      id: data?.id ?? null,
      ok: true,
      recorded: "created",
    };
  } catch (error) {
    logRecordFailure(error, input);

    return {
      error,
      ok: false,
    };
  }
}
