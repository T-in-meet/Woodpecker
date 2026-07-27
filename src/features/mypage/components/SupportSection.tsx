import { HelpCircle, MessageSquare } from "lucide-react";
import Link from "next/link";

import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import type { FeedbackNoteOption, MyFeedback } from "../queries";
import { FaqSection } from "./FaqSection";
import { FeedbackSection } from "./FeedbackSection";

export type SupportTab = "faq" | "inquiry";

const SUPPORT_TAB_ITEMS = [
  { id: "faq" as const, label: "FAQ", icon: HelpCircle },
  { id: "inquiry" as const, label: "1:1 문의", icon: MessageSquare },
];

type SupportSectionProps = {
  activeTab: SupportTab;
  feedbacks: MyFeedback[];
  noteOptions: FeedbackNoteOption[];
  hasSubmittedToday: boolean;
};

export function SupportSection({
  activeTab,
  feedbacks,
  noteOptions,
  hasSubmittedToday,
}: SupportSectionProps) {
  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b">
        {SUPPORT_TAB_ITEMS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`${ROUTES.MYPAGE}?section=support&tab=${id}`}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === "faq" && <FaqSection />}
      {activeTab === "inquiry" && (
        <FeedbackSection
          feedbacks={feedbacks}
          noteOptions={noteOptions}
          hasSubmittedToday={hasSubmittedToday}
        />
      )}
    </div>
  );
}
