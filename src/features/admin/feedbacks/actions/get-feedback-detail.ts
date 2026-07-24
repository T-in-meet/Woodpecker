"use server";

import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type {
  AdminFeedbackDetail,
  FeedbackSignedImage,
} from "../types/feedback-detail";
import type { FeedbackCategory, FeedbackStatus } from "../types/feedback-list";

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
 * 관리자 피드백 상세 화면에 필요한 원문, 작성자, 연결 노트, 관리자 답변을 조회합니다.
 *
 * private Storage 이미지는 클라이언트에서 바로 접근할 수 없으므로
 * 이 Server Action에서 service role로 서명 URL을 만들어 반환합니다.
 *
 * @param feedbackId 조회할 feedbacks.id
 * @returns 상세 화면에서 바로 렌더링할 수 있는 피드백 상세 데이터
 */
export async function getFeedbackDetail(
  feedbackId: string,
): Promise<AdminFeedbackDetail> {
  await assertAdmin();

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

  // 피드백 본문 조회 이후의 부가 데이터는 서로 독립적이므로 병렬로 조회한다.
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
      createSignedImages("feedbacks", feedbackRow.image_urls),
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
    ? await createSignedImages("feedback_replies", reply.image_paths)
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
 * 현재 로그인한 사용자가 관리자 권한을 가진 사용자임을 확인합니다.
 *
 * 관리자 상세 조회는 service role로 RLS를 우회하므로, action 진입점에서
 * 반드시 profiles.role을 확인해 권한 경계를 세웁니다.
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
 * private Storage object path 목록을 1시간짜리 signed URL 목록으로 변환합니다.
 *
 * @param bucket 이미지가 저장된 private bucket 이름
 * @param paths DB에 저장된 bucket 내부 object path 목록
 * @returns 원본 path와 브라우저 표시용 signed URL 쌍
 */
async function createSignedImages(
  bucket: "feedbacks" | "feedback_replies",
  paths: string[],
): Promise<FeedbackSignedImage[]> {
  const supabase = createAdminClient();

  return Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);

      if (error) {
        throw new Error(`Failed to create signed image URL: ${error.message}`);
      }

      return {
        path,
        signedUrl: data.signedUrl,
      };
    }),
  );
}
