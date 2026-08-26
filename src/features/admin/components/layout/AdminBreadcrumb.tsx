import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

import type { AdminBreadcrumbItem } from "../../types/breadcrumb";

type Props = {
  /** 화면에 표시할 Breadcrumb 항목 */
  items: readonly AdminBreadcrumbItem[];

  /** Breadcrumb 전체를 조회하고 있는지 여부 */
  loading?: boolean;

  /** 로딩 중 표시할 동적 Breadcrumb Skeleton 항목 수 */
  loadingItemCount?: number;
};

/**
 * 관리자 페이지의 Breadcrumb 항목을 표시합니다.
 *
 * 동적 항목을 조회하는 동안에는 정적 항목과 조회 예정인 동적 항목 수에
 * 맞춰 전체 Breadcrumb을 Skeleton 형태로 표시합니다.
 */
export function AdminBreadcrumb({
  items,
  loading = false,
  loadingItemCount = 1,
}: Props) {
  if (loading) {
    const skeletonCount = items.length + loadingItemCount;

    return (
      <Breadcrumb className="py-2">
        <BreadcrumbList>
          {Array.from({ length: skeletonCount }).map((_, index) => {
            const isLast = index === skeletonCount - 1;

            return (
              <div key={index} className="contents">
                <BreadcrumbItem>
                  <Skeleton className={index === 0 ? "h-4 w-16" : "h-4 w-24"} />
                </BreadcrumbItem>

                {!isLast && <BreadcrumbSeparator />}
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="py-2">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <div key={`${item.label}-${index}`} className="contents">
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!isLast && <BreadcrumbSeparator />}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
