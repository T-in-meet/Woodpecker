"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type AdminCollapsibleSectionProps = {
  /** 접기 영역의 제목입니다. */
  title: string;

  /** 접기 영역에 표시할 내용입니다. */
  children: ReactNode;

  /** 처음 렌더링할 때 펼쳐둘지 여부입니다. */
  defaultOpen?: boolean;
};

/**
 * 관리자 페이지에서 콘텐츠 영역을 접고 펼칠 수 있도록 표시합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 접기 가능한 관리자 콘텐츠 영역
 */
export function AdminCollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: AdminCollapsibleSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>

        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${title} 접기 또는 펼치기`}
            className="group"
          >
            <ChevronDown
              aria-hidden="true"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="border-t p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
