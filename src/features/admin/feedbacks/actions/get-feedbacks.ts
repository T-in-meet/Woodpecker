"use server";

import type { AdminAppliedFilter } from "@/features/admin/types/filter";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type {
  AdminFeedbackListItem,
  AdminFeedbackListQuery,
  AdminFeedbackListResult,
  FeedbackCategory,
  FeedbackFilterField,
  FeedbackStatus,
} from "../types/feedback-list";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FeedbackRow = {
  id: string;
  user_id: string;
  note_id: string | null;
  category: string;
  title: string;
  content: string;
  image_urls: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  nickname: string;
  canonical_email: string | null;
};

type NoteRow = {
  id: string;
  title: string;
};

/**
 * 관리자 피드백 목록 화면의 검색, 필터, 페이지네이션 조건에 맞는 피드백을 조회합니다.
 *
 * 일반 사용자 RLS 정책과 별도로 관리자 목록은 service role 조회가 필요하므로
 * action 시작 시 관리자 권한을 먼저 확인합니다.
 *
 * @param query 목록 toolbar와 pagination에서 전달한 조회 조건
 * @returns 현재 페이지의 피드백 목록과 페이지네이션 메타데이터
 */
export async function getFeedbacks(
  query: AdminFeedbackListQuery,
): Promise<AdminFeedbackListResult> {
  await assertAdmin();

  const supabase = createAdminClient();
  const page = Math.max(1, query.page);
  const pageSize = query.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const userIds = await getUserIdsForSearch(query);

  // 사용자 검색에서 매칭된 프로필이 없으면 feedbacks 조회 없이 빈 결과를 반환한다.
  if (userIds && userIds.length === 0) {
    return createEmptyResult(page, pageSize);
  }

  let feedbackQuery = supabase
    .from("feedbacks")
    .select(
      "id, user_id, note_id, category, title, content, image_urls, status, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  const normalizedSearchQuery = query.search.query.trim();
  if (normalizedSearchQuery.length > 0) {
    const pattern = `%${escapeLikePattern(normalizedSearchQuery)}%`;

    if (query.search.field === "title") {
      feedbackQuery = feedbackQuery.ilike("title", pattern);
    }

    if (query.search.field === "content") {
      feedbackQuery = feedbackQuery.ilike("content", pattern);
    }
  }

  if (userIds) {
    feedbackQuery = feedbackQuery.in("user_id", userIds);
  }

  // 공통 toolbar의 판별 유니온 필터를 Supabase query 조건으로 변환한다.
  for (const filter of getAppliedFilters(query.filters)) {
    feedbackQuery = applyFeedbackFilter(feedbackQuery, filter);
  }

  const { data, error, count } = await feedbackQuery.range(from, to);

  if (error) {
    throw new Error(`Failed to load feedbacks: ${error.message}`);
  }

  const rows = (data ?? []) as FeedbackRow[];
  const items = await mapFeedbackRows(rows);
  const total = count ?? 0;

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 현재 로그인한 사용자가 관리자 목록을 조회할 수 있는지 확인합니다.
 */
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

/**
 * 사용자 검색어를 feedbacks.user_id 필터에 사용할 ID 목록으로 변환합니다.
 *
 * @param query 목록 조회 조건
 * @returns 사용자 검색이 아니면 null, 사용자 검색이면 매칭 user id 목록
 */
async function getUserIdsForSearch({
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
  const pattern = `%${escapeLikePattern(normalizedQuery)}%`;

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

/**
 * 공통 관리자 필터 값을 feedbacks 조회 조건으로 적용합니다.
 */
function applyFeedbackFilter(
  feedbackQuery: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  filter: AdminAppliedFilter<FeedbackFilterField>,
) {
  switch (filter.field) {
    case "category":
      if (filter.type === "multi-select") {
        return feedbackQuery.in("category", filter.value);
      }
      return feedbackQuery;

    case "status":
      if (filter.type === "multi-select") {
        return feedbackQuery.in("status", filter.value);
      }
      return feedbackQuery;

    case "createdAt": {
      if (filter.type !== "date-range") {
        return feedbackQuery;
      }

      const { from, to } = filter.value;

      if (from) {
        feedbackQuery = feedbackQuery.gte(
          "created_at",
          startOfDayIsoString(from),
        );
      }

      if (to) {
        feedbackQuery = feedbackQuery.lt("created_at", nextDayIsoString(to));
      }

      return feedbackQuery;
    }

    case "hasImages":
      if (filter.type === "select" && filter.value === "yes") {
        return feedbackQuery.not("image_urls", "eq", "{}");
      }

      if (filter.type === "select" && filter.value === "no") {
        return feedbackQuery.eq("image_urls", "{}");
      }

      return feedbackQuery;

    case "noteLinked":
      if (filter.type === "select" && filter.value === "yes") {
        return feedbackQuery.not("note_id", "is", null);
      }

      if (filter.type === "select" && filter.value === "no") {
        return feedbackQuery.is("note_id", null);
      }

      return feedbackQuery;

    default:
      return feedbackQuery;
  }
}

/**
 * toolbar 필터 객체에서 실제 적용된 필터만 배열로 추출합니다.
 */
function getAppliedFilters(
  filters: AdminFeedbackListQuery["filters"],
): AdminAppliedFilter<FeedbackFilterField>[] {
  return Object.values(filters).filter(
    (filter): filter is AdminAppliedFilter<FeedbackFilterField> =>
      filter !== undefined,
  );
}

/**
 * feedbacks row에 현재 페이지에서 필요한 사용자/노트 표시 정보를 병합합니다.
 */
async function mapFeedbackRows(
  rows: FeedbackRow[],
): Promise<AdminFeedbackListItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const noteIds = Array.from(
    new Set(rows.flatMap((row) => (row.note_id ? [row.note_id] : []))),
  );

  // 현재 페이지에 표시되는 row의 참조 데이터만 조회해 목록 응답 크기를 제한한다.
  const [profilesResult, notesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, canonical_email")
      .in("id", userIds),
    noteIds.length > 0
      ? supabase.from("notes").select("id, title").in("id", noteIds)
      : Promise.resolve({ data: [] as NoteRow[], error: null }),
  ]);

  if (profilesResult.error) {
    throw new Error(
      `Failed to load feedback users: ${profilesResult.error.message}`,
    );
  }

  if (notesResult.error) {
    throw new Error(
      `Failed to load feedback notes: ${notesResult.error.message}`,
    );
  }

  const profilesById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const notesById = new Map(
    ((notesResult.data ?? []) as NoteRow[]).map((note) => [note.id, note]),
  );

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    const note = row.note_id ? notesById.get(row.note_id) : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      userLabel: profile?.nickname ?? shortId(row.user_id),
      userEmail: profile?.canonical_email ?? null,
      noteId: row.note_id,
      noteTitle: note?.title ?? null,
      category: row.category as FeedbackCategory,
      status: row.status as FeedbackStatus,
      title: row.title,
      contentPreview: createContentPreview(row.content),
      imageCount: row.image_urls.length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * 검색 결과가 없을 때 목록 응답 형태를 유지하는 빈 페이지를 생성합니다.
 */
function createEmptyResult(
  page: number,
  pageSize: number,
): AdminFeedbackListResult {
  return {
    items: [],
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };
}

/**
 * 목록 테이블에서 표시할 본문 미리보기 문자열을 생성합니다.
 */
function createContentPreview(content: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent.length <= 80) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 80)}...`;
}

/**
 * PostgREST ilike 패턴에서 와일드카드로 해석되는 문자를 이스케이프합니다.
 */
function escapeLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

/**
 * 날짜 범위 필터의 시작일을 해당 일자의 00:00 ISO 문자열로 변환합니다.
 */
function startOfDayIsoString(value: Date | string) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

/**
 * 날짜 범위 필터의 종료일을 다음 날 00:00 미만 조건용 ISO 문자열로 변환합니다.
 */
function nextDayIsoString(value: Date | string) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);

  return date.toISOString();
}

/**
 * 프로필 정보를 찾지 못했을 때 목록에서 보여줄 짧은 사용자 식별자를 만듭니다.
 */
function shortId(id: string) {
  return id.slice(0, 8);
}
