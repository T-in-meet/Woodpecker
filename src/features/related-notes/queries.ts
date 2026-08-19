"use server";

import { z } from "zod";

import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";

import { relatedNoteRowSchema } from "./schemas";
import type { RelatedNoteRecommendation } from "./types";

/**
 * 지정한 Note에 현재 연결되어 있는 Related Notes를 조회합니다.
 *
 * 사용자가 직접 연결한 관계와 AI 추천 관계 중 active 상태인 관계만 반환하며,
 * 각 관계의 origin도 함께 반환합니다.
 *
 * dismissed AI 추천은 화면에 표시하지 않습니다.
 *
 * @param noteId Related Notes를 조회할 기준 Note ID
 * @returns 현재 표시할 Related Notes 목록
 */
export async function getRelatedNotes(
  noteId: string,
): Promise<RelatedNoteRecommendation[]> {
  const supabase = await createServerComponentClient();

  const { data, error } = await supabase
    .from("note_related_notes")
    .select("related_note_id, origin, metadata")
    .eq("note_id", noteId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    logError({
      message: "[getRelatedNotes] 관련 노트 조회 실패",
      error,
    });

    return [];
  }

  const parsed = z.array(relatedNoteRowSchema).safeParse(data);

  if (!parsed.success) {
    logError({
      message: "[getRelatedNotes] 관련 노트 파싱 실패",
      error: parsed.error,
    });

    return [];
  }

  return parsed.data.map(({ related_note_id: noteId, origin, metadata }) => ({
    noteId,
    origin,
    ...metadata,
  }));
}
