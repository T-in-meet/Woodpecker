import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { AdminPageHeader } from "./AdminPageHeader";

interface Props {
  /** 상세 페이지 제목 */
  title: string;

  /** 상세 페이지 제목 아래에 표시할 설명 */
  description?: string;

  /** 목록 페이지로 이동할 경로 */
  backHref: string;

  /** 목록 이동 버튼에 표시할 문구 */
  backLabel?: string;

  /** 제목 영역 우측에 표시할 작업 요소 */
  actions?: ReactNode;
}

/**
 * 관리자 상세 페이지에서 사용하는 공통 헤더입니다.
 *
 * 상위 목록 페이지로 이동하는 버튼과 페이지 제목, 설명,
 * 우측 작업 영역을 일관된 형태로 표시합니다.
 */
export function AdminDetailPageHeader({
  title,
  description,
  backHref,
  backLabel = "목록",
  actions,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Button asChild type="button" variant="outline" size="sm">
          <Link href={backHref}>
            <ArrowLeft aria-hidden="true" />
            {backLabel}
          </Link>
        </Button>
      </div>

      <AdminPageHeader
        title={title}
        {...(description !== undefined ? { description } : {})}
        {...(actions !== undefined ? { actions } : {})}
      />
    </div>
  );
}
