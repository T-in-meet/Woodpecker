export type GlobalError =
  | { type: "network" }
  | { type: "server" }
  | { type: "timeout" };

export const GLOBAL_ERROR_MESSAGES = {
  network: "네트워크 연결을 확인해주세요",
  server: "잠시 후 다시 시도해주세요",
  timeout: "요청 시간이 초과되었습니다. 다시 시도해주세요",
} as const;

export function isGlobalError(error: unknown): error is GlobalError {
  if (!error || typeof error !== "object" || !("type" in error)) return false;

  return (
    error.type === "network" ||
    error.type === "server" ||
    error.type === "timeout"
  );
}
