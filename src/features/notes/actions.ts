"use server";

import { recordSchema } from "./schema";

export async function createRecordAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = recordSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    language: formData.get("language"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Supabase insert
}

export async function deleteRecordAction(id: string) {
  // TODO: Supabase delete
  return { id };
}
