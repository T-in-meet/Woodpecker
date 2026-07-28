import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

const ADMIN_USER_TABLE_SKELETON_ROW_COUNT = 5;

const ADMIN_USER_TABLE_SKELETON_WIDTHS = [
  "w-44",
  "w-52",
  "w-28",
  "w-20",
  "w-24",
  "w-32",
] as const;

interface AdminUserTableSkeletonProps {
  /** 표시할 skeleton 행 개수 */
  length?: number | undefined;
}

/**
 * 관리자 사용자 목록 최초 조회 중 테이블 행 위치에 표시할
 * skeleton row 목록입니다.
 */
export function AdminUserTableSkeleton({
  length = ADMIN_USER_TABLE_SKELETON_ROW_COUNT,
}: AdminUserTableSkeletonProps) {
  return Array.from({ length }, (_, rowIndex) => (
    <tr key={rowIndex} aria-hidden="true" className="border-b last:border-b-0">
      {ADMIN_USER_TABLE_SKELETON_WIDTHS.map((width, index) => (
        <td key={`${width}-${index}`} className="px-4 py-3">
          <Skeleton className={cn("h-4", width)} />
        </td>
      ))}
    </tr>
  ));
}
