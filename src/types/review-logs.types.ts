import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type ReviewLog = Row<"review_logs">;
export type ReviewLogInsert = InsertDto<"review_logs">;
export type ReviewLogUpdate = UpdateDto<"review_logs">;

export type ReviewLogId = ReviewLog["id"];
export type ReviewLogUserId = ReviewLog["user_id"];
export type ReviewLogNoteId = ReviewLog["note_id"];

export type ReviewLogListItem = Pick<
  ReviewLog,
  "id" | "note_id" | "round" | "scheduled_at" | "completed_at" | "created_at"
>;

export type ReviewLogCreateInput = Omit<ReviewLogInsert, "id" | "created_at">;
export type ReviewLogPatchInput = Partial<
  Pick<ReviewLogUpdate, "completed_at" | "scheduled_at" | "round">
>;
