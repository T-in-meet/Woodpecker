import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 피드백 상세 데이터 최초 조회 중 표시하는 skeleton 레이아웃입니다.
 *
 * 실제 상세 화면과 같은 2열 구조를 유지해 로딩 후 레이아웃 이동을 줄입니다.
 */
export function AdminFeedbackDetailSkeleton() {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
      <Card className="rounded-md">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <Separator />
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="aspect-video w-full" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-9 w-28 self-end" />
        </CardContent>
      </Card>
    </div>
  );
}
