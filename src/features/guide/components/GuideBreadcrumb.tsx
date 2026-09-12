import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type GuideBreadcrumbEntry = {
  name: string;
  /** 현재 페이지(마지막 항목)는 링크가 아니라 텍스트로 그려지므로 href가 없다. */
  href?: string;
};

/**
 * 화면에 보이는 breadcrumb. JSON-LD(`buildBreadcrumbJsonLd`)와 같은 경로를 그린다.
 *
 * 구조화 데이터만 넣고 화면에는 없으면 사용자에게 상위 탐색 경로가 생기지 않는다.
 * 둘을 같은 데이터로 만들어 화면과 마크업이 갈라지지 않게 한다.
 */
export function GuideBreadcrumb({
  entries,
}: {
  entries: readonly GuideBreadcrumbEntry[];
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {entries.map((entry, index) => (
          <Fragment key={entry.name}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {entry.href ? (
                <BreadcrumbLink asChild>
                  <Link href={entry.href}>{entry.name}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{entry.name}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
