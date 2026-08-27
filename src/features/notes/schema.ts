import { z } from "zod";

export const NOTE_VIEWS = ["all", "due", "scheduled", "completed"] as const;
export const noteViewSchema = z.enum(NOTE_VIEWS);
export type NoteView = z.infer<typeof noteViewSchema>;

export const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해주세요")
    .max(100, "제목은 100자 이하여야 합니다"),
  // DB의 notes_content_length_check와 같은 값이다. 바꿀 때 마이그레이션도 함께 올린다.
  // (RLS가 본인 여부만 보므로 PostgREST 직접 쓰기로 이 검증을 건너뛸 수 있다.)
  content: z
    .string()
    .max(50000, "내용이 너무 깁니다")
    .refine((value) => value.trim().length > 0, "내용을 입력해주세요"),
});

export type NoteInput = z.infer<typeof noteSchema>;
