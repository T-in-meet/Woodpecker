import { Skeleton } from "@/components/ui/skeleton";

/**
 * 관리자 AI Agent 목록의 로딩 행을 렌더링합니다.
 *
 * @returns AI Agent 목록 스켈레톤 행
 */
export function AdminAiAgentsTableSkeleton() {
  return Array.from({ length: 5 }, (_, index) => (
    <tr key={index} className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </td>

      <td className="px-4 py-3">
        <Skeleton className="h-4 w-56" />
      </td>

      <td className="px-4 py-3">
        <Skeleton className="h-4 w-8" />
      </td>

      <td className="px-4 py-3">
        <Skeleton className="h-4 w-28" />
      </td>

      <td className="px-4 py-3">
        <Skeleton className="h-4 w-28" />
      </td>
    </tr>
  ));
}
