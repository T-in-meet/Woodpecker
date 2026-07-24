import { createAdminClient } from "@/lib/supabase/admin";

import { AdminFeedbackListQuery } from "../types/feedback-list";
import { escapePostgrestLikePattern } from "./feedback-query";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 사용자 검색어를 feedbacks.user_id 필터에 사용할 ID 목록으로 변환합니다.
 *
 * @param query 목록 조회 조건
 * @returns 사용자 검색이 아니면 null, 사용자 검색이면 매칭 user id 목록
 */
export async function getUserIdsForSearch({
  search,
}: AdminFeedbackListQuery): Promise<string[] | null> {
  const normalizedQuery = search.query.trim();

  if (search.field !== "user" || normalizedQuery.length === 0) {
    return null;
  }

  if (UUID_PATTERN.test(normalizedQuery)) {
    return [normalizedQuery];
  }

  const supabase = createAdminClient();
  const pattern = `%${escapePostgrestLikePattern(normalizedQuery)}%`;

  const [nicknameResult, emailResult] = await Promise.all([
    supabase.from("profiles").select("id").ilike("nickname", pattern),
    supabase.from("profiles").select("id").ilike("canonical_email", pattern),
  ]);

  if (nicknameResult.error) {
    throw new Error(`Failed to search users: ${nicknameResult.error.message}`);
  }

  if (emailResult.error) {
    throw new Error(`Failed to search users: ${emailResult.error.message}`);
  }

  return Array.from(
    new Set([
      ...(nicknameResult.data ?? []).map((profile) => profile.id),
      ...(emailResult.data ?? []).map((profile) => profile.id),
    ]),
  );
}
