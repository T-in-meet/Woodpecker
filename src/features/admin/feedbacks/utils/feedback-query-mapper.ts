import { createAdminClient } from "@/lib/supabase/admin";

import {
  AdminFeedbackListItem,
  FeedbackArea,
  FeedbackCategory,
  FeedbackStatus,
} from "../types/feedback-list";
import { createFeedbackContentPreview } from "./feedback-query";

export type FeedbackListRow = {
  id: string;
  user_id: string;
  note_id: string | null;
  category: string;
  area: string;
  title: string;
  content: string;
  image_urls: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

type FeedbackListProfileRow = {
  id: string;
  nickname: string;
  canonical_email: string | null;
};

type FeedbackListReplyRow = {
  feedback_id: string;
  created_by: string;
};

type FeedbackListNoteRow = {
  id: string;
  title: string;
};

/**
 * feedbacks row에 현재 페이지에서 필요한 사용자/노트 표시 정보를 병합합니다.
 */
export async function mapFeedbackRows(
  rows: FeedbackListRow[],
): Promise<AdminFeedbackListItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const feedbackIds = rows.map((row) => row.id);
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const noteIds = Array.from(
    new Set(rows.flatMap((row) => (row.note_id ? [row.note_id] : []))),
  );

  // 현재 페이지에 표시되는 row의 참조 데이터만 조회해 목록 응답 크기를 제한한다.
  const [repliesResult, notesResult] = await Promise.all([
    supabase
      .from("feedback_replies")
      .select("feedback_id, created_by")
      .in("feedback_id", feedbackIds),
    noteIds.length > 0
      ? supabase.from("notes").select("id, title").in("id", noteIds)
      : Promise.resolve({ data: [] as FeedbackListNoteRow[], error: null }),
  ]);

  if (repliesResult.error) {
    throw new Error(
      `Failed to load feedback replies: ${repliesResult.error.message}`,
    );
  }

  const replies = (repliesResult.data ?? []) as FeedbackListReplyRow[];
  const replyAuthorIds = replies.map((reply) => reply.created_by);
  const profileIds = Array.from(new Set([...userIds, ...replyAuthorIds]));

  const profilesResult = await supabase
    .from("profiles")
    .select("id, nickname, canonical_email")
    .in("id", profileIds);

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
    ((profilesResult.data ?? []) as FeedbackListProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const notesById = new Map(
    ((notesResult.data ?? []) as FeedbackListNoteRow[]).map((note) => [
      note.id,
      note,
    ]),
  );
  const repliesByFeedbackId = new Map(
    replies.map((reply) => [reply.feedback_id, reply]),
  );

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    const reply = repliesByFeedbackId.get(row.id);
    const replyAuthor = reply ? profilesById.get(reply.created_by) : undefined;
    const note = row.note_id ? notesById.get(row.note_id) : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      userLabel: profile?.nickname ?? shortId(row.user_id),
      userEmail: profile?.canonical_email ?? null,
      replyAuthorId: reply?.created_by ?? null,
      replyAuthorLabel: reply
        ? (replyAuthor?.nickname ?? shortId(reply.created_by))
        : null,
      noteId: row.note_id,
      noteTitle: note?.title ?? null,
      category: row.category as FeedbackCategory,
      area: row.area as FeedbackArea,
      status: row.status as FeedbackStatus,
      title: row.title,
      contentPreview: createFeedbackContentPreview(row.content),
      imageCount: row.image_urls.length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * 프로필 정보를 찾지 못했을 때 목록에서 보여줄 짧은 사용자 식별자를 만듭니다.
 */
function shortId(id: string) {
  return id.slice(0, 8);
}
