import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type Note = Row<"notes">;
export type NoteInsert = InsertDto<"notes">;
export type NoteUpdate = UpdateDto<"notes">;

export type NoteId = Note["id"];
export type NoteUserId = Note["user_id"];

export type NoteSummary = Pick<
  Note,
  "id" | "title" | "review_round" | "next_review_at" | "updated_at"
>;

export type NoteListItem = Pick<
  Note,
  "id" | "title" | "created_at" | "updated_at" | "next_review_at"
>;

export type NoteEditorValue = Pick<
  NoteInsert,
  "title" | "content" | "language"
>;

export type NoteCreateInput = Omit<
  NoteInsert,
  "id" | "created_at" | "updated_at"
>;

export type NotePatchInput = Partial<
  Pick<
    NoteUpdate,
    "title" | "content" | "language" | "next_review_at" | "review_round"
  >
>;
