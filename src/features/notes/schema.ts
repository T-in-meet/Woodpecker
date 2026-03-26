import { z } from "zod";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";

export const noteSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(100),
  content: z.string().min(1, "내용을 입력해주세요"),
  language: z.enum(NOTE_LANGUAGE_VALUES).nullable().optional(),
});

export type NoteInput = z.infer<typeof noteSchema>;
