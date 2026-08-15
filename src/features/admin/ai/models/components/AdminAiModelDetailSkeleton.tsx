import { Skeleton } from "@/components/ui/skeleton";

/**
 * 관리자 AI 모델 상세 페이지의 로딩 스켈레톤을 렌더링합니다.
 *
 * 상위 상세 페이지에서 브레드크럼과 페이지 헤더를 이미 렌더링하므로,
 * 이 컴포넌트는 상세 폼 영역의 로딩 상태만 표시합니다.
 *
 * @returns AI 모델 상세 폼 스켈레톤
 */
export function AdminAiModelDetailSkeleton() {
  return (
    <div className="space-y-5">
      <AdminAiModelFieldSkeleton />

      <div className="grid gap-4 md:grid-cols-2">
        <AdminAiModelFieldSkeleton />
        <AdminAiModelFieldSkeleton />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminAiModelFieldSkeleton />
        <AdminAiModelFieldSkeleton />
      </div>

      <AdminAiModelFieldSkeleton />

      <div className="space-y-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-24 w-full" />
      </div>

      <Skeleton className="h-4 w-36" />

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}

/**
 * 관리자 AI 모델 상세 폼의 단일 필드 스켈레톤을 렌더링합니다.
 *
 * @returns 라벨과 입력 영역 스켈레톤
 */
function AdminAiModelFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
