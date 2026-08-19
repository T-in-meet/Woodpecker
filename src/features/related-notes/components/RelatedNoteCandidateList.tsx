"use client";

import { cn } from "@/lib/utils/cn";

type RelatedNoteCandidate = {
  /** 후보 Note ID입니다. */
  id: string;

  /** 후보 Note 제목입니다. */
  title: string;
};

type RelatedNoteCandidateListProps = {
  /** 현재 페이지에 표시할 Related Note 후보 목록입니다. */
  candidates: RelatedNoteCandidate[];

  /** 현재 선택된 Related Note ID입니다. */
  selectedRelatedNoteId: string;

  /** 최초 후보 목록을 불러오는 중인지 여부입니다. */
  isLoading: boolean;

  /** 검색 또는 pagination으로 후보 목록을 다시 조회 중인지 여부입니다. */
  isFetching: boolean;

  /** 사용자가 후보 Note를 선택했을 때 호출됩니다. */
  onSelect: (candidateId: string) => void;
};

/**
 * 수동 Related Note 추가 Dialog에 표시할 후보 Note 목록입니다.
 *
 * 최초 조회 중에는 로딩 상태를 표시하고,
 * 검색 또는 pagination으로 목록을 다시 조회하는 동안에는
 * 기존 목록 높이를 유지한 채 비활성화하여 레이아웃 변화를 방지합니다.
 *
 * @param props 후보 목록과 선택 상태
 */
export function RelatedNoteCandidateList({
  candidates,
  selectedRelatedNoteId,
  isLoading,
  isFetching,
  onSelect,
}: RelatedNoteCandidateListProps) {
  return (
    <div
      className={cn(
        "rounded-md border transition-opacity",
        isFetching && !isLoading && "pointer-events-none opacity-50",
      )}
    >
      {isLoading ? (
        <div className="flex min-h-56 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">
            노트를 불러오는 중입니다.
          </p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex min-h-56 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">
            추가할 수 있는 노트가 없습니다.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {candidates.map((candidate) => {
            const selected = candidate.id === selectedRelatedNoteId;

            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onSelect(candidate.id)}
                className={cn(
                  "flex w-full items-center px-4 py-3 text-left text-sm transition-colors",
                  selected ? "bg-muted font-medium" : "hover:bg-muted/50",
                )}
              >
                <span className="min-w-0 truncate">{candidate.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
