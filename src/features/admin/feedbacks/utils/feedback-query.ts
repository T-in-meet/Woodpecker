import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 목록 테이블에서 표시할 피드백 본문 미리보기 문자열을 생성합니다.
 *
 * 연속된 공백과 줄바꿈을 하나의 공백으로 정규화하고,
 * 최대 길이를 초과하면 말줄임표를 추가합니다.
 *
 * @param content 원본 피드백 본문
 * @returns 목록 화면에 표시할 정규화된 본문 미리보기
 */
export function createFeedbackContentPreview(content: string): string {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent.length <= 80) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 80)}...`;
}

/**
 * 관리자 피드백 목록 조회에 사용하는 기본 Supabase Query를 생성합니다.
 *
 * feedbacks 목록 조회에서 사용하는 QueryBuilder 타입을
 * filter/sort 유틸과 동일하게 유지하기 위해 공통으로 사용합니다.
 *
 * @param supabase 관리자 Supabase Client
 * @returns feedbacks 목록 조회 QueryBuilder
 */
export function createFeedbackListQuery(
  supabase: ReturnType<typeof createAdminClient>,
) {
  return supabase
    .from("feedbacks")
    .select(
      "id, user_id, note_id, category, area, title, content, image_urls, status, created_at, updated_at",
      { count: "exact" },
    );
}

/**
 * 관리자 피드백 목록 QueryBuilder 타입입니다.
 */
export type FeedbackListQueryBuilder = ReturnType<
  typeof createFeedbackListQuery
>;
