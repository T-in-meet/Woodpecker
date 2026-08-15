import { Skeleton } from "@/components/ui/skeleton";

/**
 * 관리자 AI Agent 상세 페이지의 로딩 스켈레톤을 렌더링합니다.
 *
 * @returns AI Agent 상세 페이지 스켈레톤
 */
export function AdminAiAgentDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 상세 폼 */}
      <div className="space-y-5">
        <AdminAiAgentFieldSkeleton />

        <div className="grid gap-4 md:grid-cols-2">
          <AdminAiAgentFieldSkeleton />
          <AdminAiAgentFieldSkeleton />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-20 w-full" />
        </div>

        <AdminAiAgentFieldSkeleton />

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>

      {/* 연결된 Prompt */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />

        <div className="overflow-hidden rounded-md border">
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="grid grid-cols-3 items-center gap-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 관리자 AI Agent 상세 폼의 단일 필드 스켈레톤을 렌더링합니다.
 *
 * @returns 라벨과 입력 영역 스켈레톤
 */
function AdminAiAgentFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
