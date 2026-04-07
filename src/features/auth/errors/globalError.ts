// 전역적으로 처리할 수 있는 클라이언트 에러 타입 정의
// - 네트워크 오류, 서버 오류, 타임아웃 등 UI에서 공통 처리되는 에러를 표현
export type GlobalError =
  | { type: "network" }
  | { type: "server" }
  | { type: "timeout" };

// GlobalError 타입에 대응하는 사용자 표시용 메시지
// - 에러 type을 기준으로 UI에서 메시지를 매핑할 때 사용
export const GLOBAL_ERROR_MESSAGES = {
  network: "네트워크 연결을 확인해주세요",
  server: "잠시 후 다시 시도해주세요",
  timeout: "요청 시간이 초과되었습니다. 다시 시도해주세요",
} as const;

// unknown 에러를 GlobalError로 판별하는 타입 가드 함수
// - 외부 에러(fetch, throw 등)를 안전하게 좁히기 위해 사용
// - type 필드가 존재하고, 정의된 GlobalError 타입 중 하나인지 확인
export function isGlobalError(error: unknown): error is GlobalError {
  if (!error || typeof error !== "object" || !("type" in error)) return false;

  return (
    error.type === "network" ||
    error.type === "server" ||
    error.type === "timeout"
  );
}
