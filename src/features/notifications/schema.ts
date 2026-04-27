import { z } from "zod";

const notificationUuidSchema = z.string().uuid();

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

export type PushSubscriptionInputType = z.infer<typeof pushSubscriptionSchema>;
export type NotificationTimeInputType = z.infer<typeof notificationTimeSchema>;
export type SetNotificationTimeInputType = z.infer<
  typeof setNotificationTimeSchema
>;
