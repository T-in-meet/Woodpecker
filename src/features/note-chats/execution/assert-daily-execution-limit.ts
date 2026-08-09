import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT } from "../constants/execution";

/**
 * 현재 한국 날짜의 시작 시각과 다음 날 시작 시각을 UTC ISO 문자열로 반환합니다.
 *
 * Note Chat의 일일 사용량은 Asia/Seoul 기준 00:00부터 다음 날 00:00 전까지
 * 생성된 Run을 기준으로 계산합니다.
 *
 * @returns 오늘의 시작 시각과 다음 날 시작 시각
 */
function getNoteChatDailyExecutionRange(): {
  startAt: string;
  endAt: string;
} {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const startAt = new Date(`${today}T00:00:00+09:00`);
  const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

/**
 * 사용자의 오늘 Note Chat AI 실행 횟수가 일일 제한을 초과하지 않았는지 검증합니다.
 *
 * 새 질문, 질문 수정, 오류 재시도처럼 실제 Run을 생성하는 모든 실행을
 * 하루 사용량에 포함합니다.
 *
 * Run에는 사용자 ID가 직접 저장되지 않으므로
 * User Message와 Conversation을 따라가 소유 사용자를 확인합니다.
 *
 * @param userId 실행을 요청한 사용자 ID
 * @throws 오늘 생성된 Run이 일일 실행 제한 이상이면 오류
 */
export async function assertNoteChatDailyExecutionLimit(
  userId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { startAt, endAt } = getNoteChatDailyExecutionRange();

  const { count, error } = await supabase
    .from("note_chat_runs")
    .select(
      `
      id,
      note_chat_messages!note_chat_runs_user_message_id_fkey!inner(
        note_chat_conversations!inner(
          user_id
        )
      )
    `,
      {
        count: "exact",
        head: true,
      },
    )
    .eq("note_chat_messages.note_chat_conversations.user_id", userId)
    .gte("created_at", startAt)
    .lt("created_at", endAt);

  if (error) {
    console.error("Failed to get note chat daily execution count", error);

    throw new Error(
      `Failed to get note chat daily execution count: ${error.message}`,
    );
  }

  if ((count ?? 0) >= NOTE_CHAT_DAILY_EXECUTION_LIMIT) {
    throw new Error("NOTE_CHAT_DAILY_EXECUTION_LIMIT_EXCEEDED");
  }
}
