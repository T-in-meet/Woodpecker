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

interface Props {
  /** 화면에 표시할 Breadcrumb 항목 */
  items: readonly AdminBreadcrumbItem[];

  /** Breadcrumb 전체를 조회하고 있는지 여부 */
  loading?: boolean;
}

/**
 * 관리자 페이지의 Breadcrumb 항목을 표시합니다.
 *
 * 동적 항목을 조회하는 동안에는 전체 Breadcrumb을
 * Skeleton 형태로 표시합니다.
 */
export function AdminBreadcrumb({ items, loading = false }: Props) {
  if (loading) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <Skeleton className="h-4 w-16" />
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          <BreadcrumbItem>
            <Skeleton className="h-4 w-24" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
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
