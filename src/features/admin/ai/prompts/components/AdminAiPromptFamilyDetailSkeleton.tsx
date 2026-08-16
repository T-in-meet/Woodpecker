import { Skeleton } from "@/components/ui/skeleton";

/**
 * 관리자 AI Prompt Family 상세 페이지의 로딩 스켈레톤을 렌더링합니다.
 *
 * @returns AI Prompt Family 상세 페이지 스켈레톤
 */
export function AdminAiPromptFamilyDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {/* 상세 폼 */}
      <div className="max-w-4xl space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-5 w-48" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminAiPromptFamilyFieldSkeleton />
          <AdminAiPromptFamilyFieldSkeleton />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-20 w-full" />
        </div>

        <AdminAiPromptFamilyFieldSkeleton />

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>

      {/* Version 목록 */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="grid grid-cols-5 items-center gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 관리자 AI Prompt Family 상세 폼의 단일 필드 스켈레톤을 렌더링합니다.
 *
 * @returns 라벨과 입력 영역 스켈레톤
 */
function AdminAiPromptFamilyFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
