import { z } from "zod";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";

export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해주세요")
    .max(100, "제목은 100자 이하여야 합니다"),
  content: z
    .string()
    .max(50000, "내용이 너무 깁니다")
    .refine((value) => value.trim().length > 0, "내용을 입력해주세요"),
  language: z.preprocess(
    (value) => (value === "" ? null : value),
    z.enum(NOTE_LANGUAGE_VALUES).nullable().optional(),
  ),
});

export type NoteInput = z.infer<typeof noteSchema>;
