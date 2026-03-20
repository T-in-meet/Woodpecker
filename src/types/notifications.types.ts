import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type Notification = Row<"notifications">;
export type NotificationInsert = InsertDto<"notifications">;
export type NotificationUpdate = UpdateDto<"notifications">;

export type NotificationId = Notification["id"];
export type NotificationUserId = Notification["user_id"];
export type NotificationNoteId = Notification["note_id"];

export type NotificationStatus = Notification["status"];
export type NotificationType = Notification["type"];

export type NotificationListItem = Pick<
  Notification,
  "id" | "title" | "body" | "type" | "status" | "sent_at" | "read_at"
>;

export type NotificationCreateInput = Omit<
  NotificationInsert,
  "id" | "sent_at" | "read_at" | "skipped_at"
>;

export type NotificationPatchInput = Partial<
  Pick<
    NotificationUpdate,
    "title" | "body" | "status" | "read_at" | "skipped_at"
  >
>;

export type NotificationMarkReadInput = Pick<NotificationUpdate, "read_at">;
