import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

const ADMIN_FEEDBACK_TABLE_SKELETON_ROW_COUNT = 5;

// AdminFeedbackTable의 열 순서·개수를 그대로 따라간다. 개수가 어긋나면 로딩 중과
// 로딩 후의 열 폭이 달라져 표가 흔들린다.
const ADMIN_FEEDBACK_TABLE_SKELETON_WIDTHS = [
  "w-20", // 상태
  "w-28", // 카테고리
  "w-16", // 영역
  "w-80", // 피드백
  "w-24", // 사용자
  "w-16", // 첨부
  "w-36", // 답변 작성자
  "w-24", // 연결 노트
  "w-28", // 등록일
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
