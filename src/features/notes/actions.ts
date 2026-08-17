"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getNextReviewDate } from "@/lib/constants/reviewIntervals";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { generateNoteEmbedding } from "../ai/rags/note/generate-embedding";
import { resolveAiRuntimeEmbeddingConfiguration } from "../ai/runtimes";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "../note-chats/constants/ai";
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

  try {
    /*
     * 생성된 Note의 현재 snapshot을 DB에서 다시 조회합니다.
     *
     * embedding에 사용할 title/content와 sourceUpdatedAt을 같은 DB row에서
     * 가져와 서로 다른 Note version의 값이 섞이지 않도록 합니다.
     *
     * 조회 이후 Note가 다시 수정되더라도 activation RPC가 updated_at을
     * 검증하므로 오래된 generation은 활성화되지 않습니다.
     */
    const { data: embeddingSource, error: embeddingSourceError } =
      await supabase
        .from("notes")
        .select("id, title, content, updated_at")
        .eq("id", newNoteId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (embeddingSourceError || !embeddingSource) {
      throw new Error("Failed to load created Note for embedding.");
    }

    // Note가 DB에 정상 저장된 이후 동일한 Note snapshot을 RAG embedding으로 저장한다.
    // Note Chat의 검색 대상 embedding과 동일한 Runtime 설정을 사용한다.
    const embeddingConfiguration = await resolveAiRuntimeEmbeddingConfiguration(
      {
        featureKey: NOTE_CHAT_AI_FEATURE_KEY,
        roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
      },
    );

    await generateNoteEmbedding({
      embeddingConfiguration,
      ownerUserId: user.id,
      noteId: embeddingSource.id,
      sourceUpdatedAt: embeddingSource.updated_at,
      title: embeddingSource.title,
      content: embeddingSource.content,
    });
  } catch {
    // Note 저장은 이미 성공했으므로 embedding 실패가 Note 생성 결과에 영향을 주지 않도록 한다.
    // Embedding 오류 자체는 AI Foundation에서 operational error로 이미 보고된다.
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

  /*
   * UPDATE가 실제로 저장한 Note snapshot을 그대로 반환받습니다.
   *
   * 이후 embedding에는 이 row의 title/content/updated_at을 함께 사용하여
   * generation이 어떤 Note version에서 만들어졌는지 일관되게 유지합니다.
   */
  const { data: updatedNote, error } = await supabase
    .from("notes")
    .update({ title: parsed.data.title, content: parsed.data.content })
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .select("id, title, content, updated_at")
    .maybeSingle();

  if (error) {
    return { error: "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (!updatedNote) {
    return { error: "수정할 노트를 찾을 수 없습니다." };
  }

  try {
    // 수정된 Note를 RAG 검색 대상에 즉시 반영하기 위해
    // Note Chat과 동일한 note-retrieval Embedding Model로 새 embedding을 생성한다.
    const embeddingConfiguration = await resolveAiRuntimeEmbeddingConfiguration(
      {
        featureKey: NOTE_CHAT_AI_FEATURE_KEY,
        roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
      },
    );

    await generateNoteEmbedding({
      embeddingConfiguration,
      ownerUserId: user.id,
      noteId: updatedNote.id,
      sourceUpdatedAt: updatedNote.updated_at,
      title: updatedNote.title,
      content: updatedNote.content,
    });
  } catch {
    // Note 수정은 이미 성공했으므로 embedding 실패가 Note 수정 결과에 영향을 주지 않도록 한다.
    // Embedding 오류 자체는 AI Foundation에서 operational error로 이미 보고된다.
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
