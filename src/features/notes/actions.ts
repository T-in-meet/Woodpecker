"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getNextReviewDate } from "@/lib/constants/reviewIntervals";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { type NoteInput, noteSchema } from "./schema";

type NoteActionFieldErrors = Partial<Record<keyof NoteInput, string[]>>;
const noteIdSchema = z.string().uuid();

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

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
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
    },
  );

  if (error || !newNoteId) {
    return { error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return { success: true, newNoteId };
}

export type UpdateNoteActionState =
  | {
      success: true;
      error?: never;
    }
  | {
      success?: false;
      error: NoteActionFieldErrors | string;
    }
  | null;

export async function updateNoteAction(
  noteId: string,
  _prevState: UpdateNoteActionState,
  formData: FormData,
): Promise<UpdateNoteActionState> {
  const parsedNoteId = noteIdSchema.safeParse(noteId);

  if (!parsedNoteId.success) {
    return { error: "수정할 노트를 찾을 수 없습니다." };
  }

  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
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

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  const { data: updatedNote, error } = await supabase
    .from("notes")
    .update({ title: parsed.data.title, content: parsed.data.content })
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (!updatedNote) {
    return { error: "수정할 노트를 찾을 수 없습니다." };
  }

  return { success: true };
}

export async function deleteNoteAction(noteId: string) {
  const parsedNoteId = noteIdSchema.safeParse(noteId);

  if (!parsedNoteId.success) {
    return { error: "삭제할 노트를 찾을 수 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  const { data: deletedNote, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "노트 삭제에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (!deletedNote) {
    return { error: "삭제할 노트를 찾을 수 없습니다." };
  }

  redirect(ROUTES.NOTES);
}
