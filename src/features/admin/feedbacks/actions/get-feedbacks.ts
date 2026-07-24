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

function getAppliedFilters(
  filters: AdminFeedbackListQuery["filters"],
): AdminAppliedFilter<FeedbackFilterField>[] {
  return Object.values(filters).filter(
    (filter): filter is AdminAppliedFilter<FeedbackFilterField> =>
      filter !== undefined,
  );
}

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

function createContentPreview(content: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (normalizedContent.length <= 80) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 80)}...`;
}

function escapeLikePattern(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function startOfDayIsoString(value: Date | string) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

function nextDayIsoString(value: Date | string) {
  const date = new Date(value);

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);

  return date.toISOString();
}

function shortId(id: string) {
  return id.slice(0, 8);
}
