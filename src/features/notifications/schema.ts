import { z } from "zod";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";

const notificationUuidSchema = z.string().uuid();

export const notificationStatusSchema = z.enum([
  NOTIFICATION_STATUS.SENT,
  NOTIFICATION_STATUS.READ,
]);

export const notificationListItemSchema = z.object({
  id: notificationUuidSchema,
  title: z.string(),
  body: z.string().nullable(),
  type: z.enum([NOTIFICATION_TYPES.REVIEW]),
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
