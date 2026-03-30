import { z } from "zod";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";
import { createClient } from "@/lib/supabase/server";

const noteDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  language: z.enum(NOTE_LANGUAGE_VALUES).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid(),
});

export type NoteDetail = z.infer<typeof noteDetailSchema>;

export async function getNotes() {
  return [];
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<NoteDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("id, title, content, language, created_at, updated_at, user_id")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  const parsed = noteDetailSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
