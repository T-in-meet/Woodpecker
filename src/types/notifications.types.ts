import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type NotificationStatus =
  | "PENDING"
  | "SENT"
  | "READ"
  | "SKIPPED"
  | "FAILED";
export type NotificationType = "REVIEW" | "SYSTEM";

// DB Row를 베이스로 status/type을 리터럴 유니온으로 override
type NotificationRow = Omit<Row<"notifications">, "status" | "type"> & {
  status: NotificationStatus;
  type: NotificationType;
};

export type Notification = NotificationRow;
export type NotificationInsert = InsertDto<"notifications">;
export type NotificationUpdate = UpdateDto<"notifications">;

export type NotificationId = Notification["id"];
export type NotificationUserId = Notification["user_id"];
export type NotificationNoteId = Notification["note_id"];

export type NotificationListItem = Pick<
  Notification,
  "id" | "title" | "body" | "type" | "status" | "sent_at" | "read_at"
>;

export type NotificationCreateInput = Omit<
  NotificationInsert,
  "id" | "sent_at" | "read_at" | "skipped_at" | "status" | "type"
> & {
  status: NotificationStatus;
  type: NotificationType;
};

export type NotificationPatchInput = Partial<
  Omit<NotificationUpdate, "status" | "type">
> & {
  status?: NotificationStatus;
  type?: NotificationType;
};

export type NotificationMarkReadInput = Pick<NotificationUpdate, "read_at">;
