"use server";

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";
import type { AdminFeedbackDetail } from "./types/feedback-detail";
import type {
  AdminFeedbackListQuery,
  AdminFeedbackListResult,
  FeedbackCategory,
  FeedbackStatus,
} from "./types/feedback-list";
import { escapePostgrestLikePattern } from "./utils/feedback-query";
import { applyFeedbackFilters } from "./utils/feedback-query-filter";
import {
  FeedbackListRow,
  mapFeedbackRows,
} from "./utils/feedback-query-mapper";
import { createFeedbackSignedImages } from "./utils/feedback-reply-image";
import { getUserIdsForSearch } from "./utils/feedback-user-search";

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
  avatar_url: string | null;
};

type NoteRow = {
  id: string;
  title: string;
};

type ReplyRow = {
  id: string;
  feedback_id: string;
  title: string;
  content: string;
  image_paths: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * 관리자 피드백 상세 화면에 필요한 원문, 작성자,
 * 연결 노트와 관리자 답변을 조회합니다.
 *
 * private Storage 이미지는 클라이언트에서 직접 접근할 수 없으므로
 * service role을 사용해 signed URL로 변환합니다.
 *
 * @param feedbackId 조회할 피드백 ID
 * @returns 관리자 피드백 상세 화면에 표시할 데이터
 */
export async function getFeedbackDetail(
  feedbackId: string,
): Promise<AdminFeedbackDetail> {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: feedback, error } = await supabase
    .from("feedbacks")
    .select(
      "id, user_id, note_id, category, title, content, image_urls, status, created_at, updated_at",
    )
    .eq("id", feedbackId)
    .single();

  if (error || !feedback) {
    notFound();
  }

  const feedbackRow = feedback as FeedbackRow;

  const [profileResult, noteResult, replyResult, feedbackImages] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nickname, canonical_email, avatar_url")
        .eq("id", feedbackRow.user_id)
        .single(),
      feedbackRow.note_id
        ? supabase
            .from("notes")
            .select("id, title")
            .eq("id", feedbackRow.note_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("feedback_replies")
        .select(
          "id, feedback_id, title, content, image_paths, created_by, created_at, updated_at",
        )
        .eq("feedback_id", feedbackId)
        .maybeSingle(),
      createFeedbackSignedImages("feedbacks", feedbackRow.image_urls),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("Failed to load feedback user.");
  }

  if (noteResult.error) {
    throw new Error("Failed to load feedback note.");
  }

  if (replyResult.error) {
    throw new Error("Failed to load feedback reply.");
  }

  const profile = profileResult.data as ProfileRow;
  const note = noteResult.data as NoteRow | null;
  const reply = replyResult.data as ReplyRow | null;
  const replyImages = reply
    ? await createFeedbackSignedImages("feedback_replies", reply.image_paths)
    : [];

  return {
    id: feedbackRow.id,
    user: {
      id: profile.id,
      name: profile.nickname,
      email: profile.canonical_email,
      avatarUrl: profile.avatar_url,
    },
    note: note ? { id: note.id, title: note.title } : null,
    category: feedbackRow.category as FeedbackCategory,
    status: feedbackRow.status as FeedbackStatus,
    title: feedbackRow.title,
    content: feedbackRow.content,
    images: feedbackImages,
    createdAt: feedbackRow.created_at,
    updatedAt: feedbackRow.updated_at,
    reply: reply
      ? {
          id: reply.id,
          title: reply.title,
          content: reply.content,
          imagePaths: reply.image_paths,
          images: replyImages,
          createdBy: reply.created_by,
          createdAt: reply.created_at,
          updatedAt: reply.updated_at,
        }
      : null,
  };
}

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
  await requireAdmin();

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
    const pattern = `%${escapePostgrestLikePattern(normalizedSearchQuery)}%`;

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
  feedbackQuery = applyFeedbackFilters(feedbackQuery, query.filters);

  const { data, error, count } = await feedbackQuery.range(from, to);

  if (error) {
    throw new Error(`Failed to load feedbacks: ${error.message}`);
  }

  const rows = (data ?? []) as FeedbackListRow[];
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
