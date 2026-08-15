import { Skeleton } from "@/components/ui/skeleton";

/**
 * 관리자 AI 모델 목록의 로딩 행을 렌더링합니다.
 *
 * @returns AI 모델 목록 스켈레톤 행
 */
export function AdminAiModelsTableSkeleton() {
  return Array.from({ length: 5 }, (_, index) => (
    <tr key={index} className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-36" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-16 rounded-full" />
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
