"use server";

import { getNextReviewDate } from "@/lib/constants/reviewIntervals";
import { createClient } from "@/lib/supabase/server";
import type { NoteCreateInput } from "@/types/notes.types";
import type { ReviewLogCreateInput } from "@/types/review-logs.types";

import { type NoteInput, noteSchema } from "./schema";

type NoteActionFieldErrors = Partial<Record<keyof NoteInput, string[]>>;

export type CreateNoteActionState =
  | {
      success: true;
      newNoteId: string;
      error?: never;
    }
  | {
      success?: false;
      newNoteId?: never;
      error: NoteActionFieldErrors | string;
    }
  | null;

export async function createNoteAction(
  _prevState: CreateNoteActionState,
  formData: FormData,
): Promise<CreateNoteActionState> {
  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    language: formData.get("language"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const firstReviewDate = getNextReviewDate(0);

  const noteToCreate = {
    title: parsed.data.title,
    content: parsed.data.content,
    language: parsed.data.language ?? null,
    next_review_at: firstReviewDate?.toISOString() ?? null,
    user_id: user.id,
  } satisfies NoteCreateInput;

  const { data, error } = await supabase
    .from("notes")
    .insert(noteToCreate)
    .select("id")
    .single();

  if (error || !data) {
    return { error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (firstReviewDate) {
    const reviewLogToCreate = {
      note_id: data.id,
      user_id: user.id,
      round: 1,
      scheduled_at: firstReviewDate.toISOString(),
    } satisfies ReviewLogCreateInput;

    const { error: reviewLogError } = await supabase
      .from("review_logs")
      .insert(reviewLogToCreate);

    if (reviewLogError) {
      console.error("Failed to create initial review log", {
        noteId: data.id,
        userId: user.id,
        error: reviewLogError,
      });

      const { error: rollbackError } = await supabase
        .from("notes")
        .update({ next_review_at: null })
        .eq("id", data.id);

      if (rollbackError) {
        console.error("Failed to rollback next_review_at", {
          noteId: data.id,
          error: rollbackError,
        });
      }
    }
  }

  return { success: true, newNoteId: data.id };
}

// TODO: deleteNoteAction 구현 시 인증 체크 필수
