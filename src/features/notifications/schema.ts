import { z } from "zod";

import {
  ADMIN_NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";

import { isValidDateKey } from "./lib/time";

const notificationUuidSchema = z.string().uuid();

export const notificationStatusSchema = z.enum([
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.READ,
]);

export const notificationSourceSchema = z.enum(["ADMIN", "USER"]);

export const notificationListItemSchema = z.object({
  body: z.string().nullable(),
  click_path: z.string().min(1),
  id: notificationUuidSchema,
  title: z.string(),
  type: z.enum([
    ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    NOTIFICATION_TYPES.FEEDBACK_REPLY,
    NOTIFICATION_TYPES.REVIEW,
    NOTIFICATION_TYPES.SYSTEM,
  ]),
  source: notificationSourceSchema,
  status: notificationStatusSchema,
  sent_at: z.string(),
  read_at: z.string().nullable(),
  note_id: notificationUuidSchema.nullable(),
  review_log_id: notificationUuidSchema.nullable(),
  noteTitle: z.string().nullable(),
});

export const notificationsResponseSchema = z.object({
  items: z.array(notificationListItemSchema),
  unreadCount: z.number().int().min(0),
});

export const notificationIdSchema = notificationUuidSchema;
export const notificationNoteIdSchema = notificationUuidSchema;

export const pushSubscriptionEndpointSchema = z.string().trim().url();

export const pushSubscriptionSchema = z
  .object({
    endpoint: pushSubscriptionEndpointSchema,
    keys: z
      .object({
        p256dh: z.string().trim().min(1),
        auth: z.string().trim().min(1),
      })
      .strict(),
  })
  .strip();

export const notificationTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const setNotificationTimeSchema = z.object({
  noteId: notificationNoteIdSchema,
  time: notificationTimeSchema.nullable(),
});

export const notificationDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateKey);

/** 직접 입력한 날짜와 시각. 과거 여부는 KST "지금"을 아는 액션과 RPC가 확인한다. */
export const setNotificationScheduleSchema = z.object({
  noteId: notificationNoteIdSchema,
  date: notificationDateSchema,
  time: notificationTimeSchema,
});

export type NotificationListItemType = z.infer<
  typeof notificationListItemSchema
>;
export type NotificationsResponseType = z.infer<
  typeof notificationsResponseSchema
>;
export type PushSubscriptionInputType = z.infer<typeof pushSubscriptionSchema>;
export type NotificationTimeInputType = z.infer<typeof notificationTimeSchema>;
export type SetNotificationTimeInputType = z.infer<
  typeof setNotificationTimeSchema
>;
export type SetNotificationScheduleInputType = z.infer<
  typeof setNotificationScheduleSchema
>;
