import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/** Mock 사용자 테이블의 로딩 중 표시할 행 개수 */
const MOCK_USER_TABLE_SKELETON_ROW_COUNT = 5;

const MOCK_USER_TABLE_SKELETON_WIDTHS = [
  "w-8",
  "w-20",
  "w-40",
  "w-12",
  "w-24",
  "w-16",
  "w-10",
  "w-24",
] as const;

type MockUserTableSkeletonProps = {
  /** 표시할 스켈레톤 행 개수 */
  length?: number | undefined;
};

/**
 * Mock 사용자 테이블의 최초 조회 중 표시할 스켈레톤 목록입니다.
 *
 * 실제 사용자 행과 동일한 8개 열 구조를 유지하여
 * 로딩 전후 테이블의 레이아웃 변화를 줄입니다.
 */

export function MockUserTableSkeleton({
  length = MOCK_USER_TABLE_SKELETON_ROW_COUNT,
}: MockUserTableSkeletonProps) {
  return Array.from({ length }, (_, rowIndex) => (
    <tr key={rowIndex} aria-hidden="true" className="border-b last:border-b-0">
      {MOCK_USER_TABLE_SKELETON_WIDTHS.map((width, index) => (
        <MockUserTableSkeletonCell
          key={`${width}-${index}`}
          className={width}
        />
      ))}
    </tr>
  ));
}

type MockUserTableSkeletonCellProps = {
  /** 셀 내부 스켈레톤에 적용할 너비 및 형태 스타일 */
  className?: string | undefined;
};

/**
 * Mock 사용자 테이블의 단일 로딩 셀을 표시합니다.
 */
function MockUserTableSkeletonCell({
  className,
}: MockUserTableSkeletonCellProps) {
  return (
    <td className="px-4 py-3">
      <Skeleton className={cn("h-4", className)} />
    </td>
  );
}
