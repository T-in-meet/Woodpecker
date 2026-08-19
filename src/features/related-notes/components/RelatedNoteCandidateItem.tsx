"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

type RelatedNoteCandidateItemProps = {
  /** 후보 Note ID입니다. */
  id: string;

  /** 후보 Note 제목입니다. */
  title: string;

  /** 현재 후보 Note가 선택된 상태인지 여부입니다. */
  selected: boolean;

  /** 선택된 후보 Note에 입력된 연결 이유입니다. */
  reason: string;

  /** 후보 Note의 선택 상태를 전환할 때 호출됩니다. */
  onToggle: () => void;

  /** 연결 이유가 변경될 때 호출됩니다. */
  onReasonChange: (reason: string) => void;
};

/**
 * 수동 Related Note 후보 목록의 개별 항목입니다.
 *
 * - Checkbox로 Related Note 선택 여부를 변경합니다.
 * - 제목을 클릭하면 새 탭에서 해당 Note 상세를 확인할 수 있습니다.
 * - 선택된 Note에만 이유 입력 버튼을 표시합니다.
 * - 이유 입력 버튼을 누르면 현재 항목 하단에 선택적 reason 입력란을 표시합니다.
 *
 * @param props 후보 Note의 표시 및 입력 상태
 */
export function RelatedNoteCandidateItem({
  id,
  title,
  selected,
  reason,
  onToggle,
  onReasonChange,
}: RelatedNoteCandidateItemProps) {
  const [reasonOpen, setReasonOpen] = useState(false);

  function handleCheckedChange(checked: boolean) {
    onToggle();

    if (!checked) {
      setReasonOpen(false);
    }
  }

  return (
    <div>
      <div className="flex min-w-0 items-center gap-3 px-4 py-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => handleCheckedChange(checked === true)}
          aria-label={`${title} 관련 노트 선택`}
          className="shrink-0"
        />

        <Link
          href={`/notes/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-sm hover:underline"
          title={title}
        >
          {title}
        </Link>

        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => setReasonOpen((current) => !current)}
          >
            {reasonOpen ? "이유 닫기" : reason ? "이유 수정" : "이유 입력"}
          </Button>
        )}
      </div>

      <div
        className={
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out " +
          (selected && reasonOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0")
        }
      >
        <div className="overflow-hidden">
          <div className="border-t bg-muted/30 px-4 py-3">
            <Textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="이 노트를 연결하는 이유를 입력할 수 있습니다."
            />

            <p className="mt-1 text-right text-xs text-muted-foreground">
              {reason.length}/500
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
