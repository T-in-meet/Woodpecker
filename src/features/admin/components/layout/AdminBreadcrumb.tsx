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

  /** 마지막 동적 Breadcrumb 항목을 조회하고 있는지 여부 */
  loading?: boolean;
}

/**
 * 관리자 페이지의 Breadcrumb 항목을 표시합니다.
 *
 * 동적 항목을 조회하는 동안에는 마지막 위치에 Skeleton을 표시합니다.
 */
export function AdminBreadcrumb({ items, loading = false }: Props) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1 && !loading;

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

              {(!isLast || loading) && <BreadcrumbSeparator />}
            </div>
          );
        })}

        {loading && (
          <BreadcrumbItem>
            <Skeleton className="h-4 w-24" />
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
