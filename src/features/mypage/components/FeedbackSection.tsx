import type { FeedbackNoteOption, MyFeedback } from "../queries";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackList } from "./FeedbackList";

type FeedbackSectionProps = {
  feedbacks: MyFeedback[];
  noteOptions: FeedbackNoteOption[];
  hasSubmittedToday: boolean;
};

export function FeedbackSection({
  feedbacks,
  noteOptions,
  hasSubmittedToday,
}: FeedbackSectionProps) {
  return (
    <div className="space-y-6">
      <FeedbackForm
        noteOptions={noteOptions}
        hasSubmittedToday={hasSubmittedToday}
      />

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
