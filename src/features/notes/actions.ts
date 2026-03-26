"use server";

import { noteSchema } from "./schema";

export async function createNoteAction(
  _prevState: unknown,
  formData: FormData,
) {
  const rawLanguage = formData.get("language");
  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    language: rawLanguage === "" ? null : rawLanguage,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Supabase insert
}

export async function deleteNoteAction(id: string) {
  // TODO: Supabase delete
  return { id };
}
