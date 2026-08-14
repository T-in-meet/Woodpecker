import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description?: string;

  /** 상위 페이지로 이동할 경로입니다. */
  backHref?: string;

  /** 상위 페이지 이동 버튼에 표시할 문구입니다. */
  backLabel?: string;

  actions?: ReactNode;
};

/**
 * 관리자 목록 페이지의 제목, 설명, 이동 버튼 및 작업 버튼을 표시합니다.
 */
export function AdminPageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
}: Props) {
  return (
    <div className="-mx-6 flex flex-col gap-4 border-b px-6 pb-6 md:mx-0 md:px-0">
      {backHref ? (
        <div>
          <Button asChild type="button" variant="outline" size="sm">
            <Link href={backHref}>
              <ArrowLeft aria-hidden="true" />
              {backLabel ?? "뒤로가기"}
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

          {description ? (
            <p className="mt-2 text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
