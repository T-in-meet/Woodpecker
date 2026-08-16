import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

const ADMIN_AI_SETTINGS_TABLE_SKELETON_ROW_COUNT = 5;

const ADMIN_AI_SETTINGS_TABLE_SKELETON_WIDTHS = [
  "w-40",
  "w-36",
  "w-32",
  "w-32",
  "w-40",
  "w-32",
  "w-32",
] as const;

type AdminAiSettingsTableSkeletonProps = {
  /** 표시할 skeleton 행 개수 */
  length?: number | undefined;
};

/**
 * @description AI 설정 목록 최초 조회 중 표시할 skeleton row 목록입니다.
 * @param props Skeleton 속성
 * @returns AI 설정 목록 Skeleton
 */
export function AdminAiSettingsTableSkeleton({
  length = ADMIN_AI_SETTINGS_TABLE_SKELETON_ROW_COUNT,
}: AdminAiSettingsTableSkeletonProps) {
  return Array.from({ length }, (_, rowIndex) => (
    <tr key={rowIndex} aria-hidden="true" className="border-b last:border-b-0">
      {ADMIN_AI_SETTINGS_TABLE_SKELETON_WIDTHS.map((width, index) => (
        <td key={`${width}-${index}`} className="px-4 py-3">
          <Skeleton className={cn("h-4", width)} />
        </td>
      ))}
    </tr>
  ));
}
