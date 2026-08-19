import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_SQLSTATE } from "../constants/execution";

/**
 * Supabase RPC에서 반환된 오류가
 * Note Chat 일일 실행 제한 초과 오류인지 확인합니다.
 */
export function isNoteChatDailyExecutionLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code ===
      NOTE_CHAT_DAILY_EXECUTION_LIMIT_SQLSTATE
  );
}
