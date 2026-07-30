import type { Json } from "@/types/database.types";

/**
 * 운영 오류 context에 저장할 수 있는 JSON 객체 타입입니다.
 */
export type OperationalErrorContext = {
  [key: string]: Json | undefined;
};

/**
 * 전달된 값이 null이 아닌 객체인지 확인합니다.
 *
 * @param value 확인할 값
 * @returns null이 아닌 객체이면 true
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 오류 객체의 속성이 비어 있지 않은 문자열이면 반환합니다.
 *
 * @param error 오류 객체
 * @param key 조회할 속성 이름
 * @returns 문자열 속성값 또는 undefined
 */
function getStringProperty(
  error: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = error[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * 알 수 없는 오류 값에서 운영 오류 context에 저장할 정보를 추출합니다.
 *
 * JavaScript Error 인스턴스와 message, code, details, hint, name 속성을
 * 가진 일반 오류 객체를 JSON으로 저장 가능한 형태로 변환합니다.
 *
 * @param error 확인할 오류 값
 * @param fallbackMessage 오류 메시지를 확인할 수 없을 때 사용할 값
 * @returns JSON으로 저장할 수 있는 오류 정보
 */
export function getOperationalErrorContext(
  error: unknown,
  fallbackMessage = "Unknown operational error",
): OperationalErrorContext {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  if (isObject(error)) {
    const message = getStringProperty(error, "message");
    const code = getStringProperty(error, "code");
    const details = getStringProperty(error, "details");
    const hint = getStringProperty(error, "hint");
    const name = getStringProperty(error, "name");

    return {
      message: message ?? fallbackMessage,
      ...(name !== undefined ? { name } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(hint !== undefined ? { hint } : {}),
    };
  }

  if (typeof error === "string" && error.length > 0) {
    return {
      message: error,
    };
  }

  return {
    message: fallbackMessage,
  };
}
