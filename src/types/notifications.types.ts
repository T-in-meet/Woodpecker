import type {
  AdminNotificationKindType,
  NotificationKindType,
  NotificationStatusType,
} from "@/lib/constants/notifications";
import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type NotificationStatus = NotificationStatusType;
export type NotificationType = NotificationKindType;
export type AdminNotificationType = AdminNotificationKindType;

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

export type NotificationCreateInput = Omit<
  NotificationInsert,
  "id" | "sent_at" | "read_at" | "status" | "type"
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

type AdminNotificationEventRow = Omit<
  Row<"admin_notification_events">,
  "type"
> & {
  type: AdminNotificationType;
};

export type AdminNotificationEvent = AdminNotificationEventRow;
export type AdminNotificationEventInsert =
  InsertDto<"admin_notification_events">;
export type AdminNotificationRead = Row<"admin_notification_reads">;
export type AdminNotificationReadInsert = InsertDto<"admin_notification_reads">;
