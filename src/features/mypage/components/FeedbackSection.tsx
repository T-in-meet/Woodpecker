import type { MyFeedback } from "../queries";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackList } from "./FeedbackList";

type FeedbackSectionProps = {
  feedbacks: MyFeedback[];
  hasSubmittedToday: boolean;
};

export function FeedbackSection({
  feedbacks,
  hasSubmittedToday,
}: FeedbackSectionProps) {
  return (
    <div className="space-y-6">
      <FeedbackForm hasSubmittedToday={hasSubmittedToday} />

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          내가 남긴 문의사항{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({feedbacks.length})
          </span>
        </h2>
        <FeedbackList feedbacks={feedbacks} />
      </section>
    </div>
  );
}
