import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

const ADMIN_FEEDBACK_TABLE_SKELETON_ROW_COUNT = 5;

const ADMIN_FEEDBACK_TABLE_SKELETON_WIDTHS = [
  "w-20",
  "w-28",
  "w-80",
  "w-24",
  "w-16",
  "w-36",
  "w-24",
] as const;

interface AdminFeedbackTableSkeletonProps {
  length?: number | undefined;
}

export function AdminFeedbackTableSkeleton({
  length = ADMIN_FEEDBACK_TABLE_SKELETON_ROW_COUNT,
}: AdminFeedbackTableSkeletonProps) {
  return Array.from({ length }, (_, rowIndex) => (
    <tr key={rowIndex} aria-hidden="true" className="border-b last:border-b-0">
      {ADMIN_FEEDBACK_TABLE_SKELETON_WIDTHS.map((width, index) => (
        <td key={`${width}-${index}`} className="px-4 py-3">
          <Skeleton className={cn("h-4", width)} />
        </td>
      ))}
    </tr>
  ));
}
