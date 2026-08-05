import type { InsertDto, Row } from "@/types/db.helpers";

export type Feedback = Row<"feedbacks">;
export type FeedbackInsert = InsertDto<"feedbacks">;

export type FeedbackReply = Row<"feedback_replies">;

export type FeedbackId = Feedback["id"];
