import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type PushSubscription = Row<"push_subscriptions">;
export type PushSubscriptionInsert = InsertDto<"push_subscriptions">;
export type PushSubscriptionUpdate = UpdateDto<"push_subscriptions">;

export type PushSubscriptionId = PushSubscription["id"];
export type PushSubscriptionUserId = PushSubscription["user_id"];

export type PushSubscriptionKeys = Pick<PushSubscription, "p256dh" | "auth">;

export type PushSubscriptionCreateInput = Omit<
  PushSubscriptionInsert,
  "id" | "created_at"
>;

export type PushSubscriptionPatchInput = Partial<
  Pick<PushSubscriptionUpdate, "endpoint" | "p256dh" | "auth">
>;
