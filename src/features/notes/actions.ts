"use server";

import { getNextReviewDate } from "@/lib/constants/reviewIntervals";
import { createClient } from "@/lib/supabase/server";

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

  if (!firstReviewDate) {
    return { error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { data: newNoteId, error } = await supabase.rpc(
    "create_note_with_initial_review_log",
    {
      p_title: parsed.data.title,
      p_content: parsed.data.content,
      p_scheduled_at: firstReviewDate.toISOString(),
      ...(parsed.data.language ? { p_language: parsed.data.language } : {}),
    },
  );

  if (error || !newNoteId) {
    return { error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return { success: true, newNoteId };
}

// TODO: deleteNoteAction 구현 시 인증 체크 필수
