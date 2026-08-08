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

type AdminFeedbackTableSkeletonProps = {
  /** 표시할 skeleton 행 개수 */
  length?: number | undefined;
};

/**
 * 피드백 목록 최초 조회 중 테이블 행 위치에 표시할 skeleton row 목록입니다.
 */
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
