import { Skeleton } from "@/components/ui/skeleton";

/**
 * 관리자 AI Prompt Version 상세 페이지의 로딩 스켈레톤을 렌더링합니다.
 *
 * @returns AI Prompt Version 상세 페이지 스켈레톤
 */
export function AdminAiPromptVersionDetailSkeleton() {
  return (
    <div className="max-w-5xl space-y-5">
      {/* Version 상태 */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* 이름과 Tags */}
      <div className="grid gap-4 md:grid-cols-2">
        <AdminAiPromptVersionFieldSkeleton />
        <AdminAiPromptVersionFieldSkeleton />
      </div>

      {/* 변경 요약 */}
      <AdminAiPromptVersionFieldSkeleton />

      {/* System Template */}
      <AdminAiPromptVersionTextareaSkeleton />

      {/* User Template */}
      <AdminAiPromptVersionTextareaSkeleton />

      {/* JSON */}
      <div className="grid gap-4 md:grid-cols-2">
        <AdminAiPromptVersionJsonFieldSkeleton />
        <AdminAiPromptVersionJsonFieldSkeleton />
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-16" />
      </div>
    </div>
  );
}

/**
 * Prompt Version 단일 입력 필드 스켈레톤을 렌더링합니다.
 *
 * @returns 라벨과 입력 스켈레톤
 */
function AdminAiPromptVersionFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/**
 * Prompt Template Textarea 스켈레톤을 렌더링합니다.
 *
 * @returns 라벨과 Template 입력 영역 스켈레톤
 */
function AdminAiPromptVersionTextareaSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/**
 * Prompt Version JSON 필드 스켈레톤을 렌더링합니다.
 *
 * @returns 라벨과 JSON 입력 영역 스켈레톤
 */
function AdminAiPromptVersionJsonFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
