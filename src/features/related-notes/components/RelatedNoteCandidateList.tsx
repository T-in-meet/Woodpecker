"use client";

import { cn } from "@/lib/utils/cn";

import { RelatedNoteCandidateItem } from "./RelatedNoteCandidateItem";

type RelatedNoteCandidate = {
  /** 후보 Note ID입니다. */
  id: string;

  /** 후보 Note 제목입니다. */
  title: string;
};

type SelectedRelatedNote = {
  /** 선택된 Related Note ID입니다. */
  relatedNoteId: string;

  /** 해당 Related Note에 입력된 연결 이유입니다. */
  reason: string;
};

type RelatedNoteCandidateListProps = {
  /** 현재 페이지에 표시할 Related Note 후보 목록입니다. */
  candidates: RelatedNoteCandidate[];

  /** 현재 선택된 Related Notes와 각 연결 이유입니다. */
  selectedRelatedNotes: SelectedRelatedNote[];

  /** 최초 후보 목록을 불러오는 중인지 여부입니다. */
  isLoading: boolean;

  /** 검색 또는 pagination으로 후보 목록을 다시 조회 중인지 여부입니다. */
  isFetching: boolean;

  /** 사용자가 후보 Note의 선택 상태를 전환했을 때 호출됩니다. */
  onToggle: (candidateId: string) => void;

  /** 선택된 Related Note의 연결 이유가 변경될 때 호출됩니다. */
  onReasonChange: (candidateId: string, reason: string) => void;
};

/**
 * 수동 Related Note 추가 Dialog에 표시할 후보 Note 목록입니다.
 *
 * 목록 전체의 로딩/빈 상태를 처리하고,
 * 각 후보 Note의 선택 및 reason 입력 UI는
 * `RelatedNoteCandidateItem`에 위임합니다.
 *
 * 검색 또는 pagination으로 목록을 다시 조회하는 동안에는
 * 기존 목록 높이를 유지한 채 비활성화하여 레이아웃 변화를 방지합니다.
 *
 * @param props 후보 목록과 선택 상태
 */
export function RelatedNoteCandidateList({
  candidates,
  selectedRelatedNotes,
  isLoading,
  isFetching,
  onToggle,
  onReasonChange,
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
            const selectedRelatedNote = selectedRelatedNotes.find(
              (relatedNote) => relatedNote.relatedNoteId === candidate.id,
            );

            return (
              <RelatedNoteCandidateItem
                key={candidate.id}
                id={candidate.id}
                title={candidate.title}
                selected={Boolean(selectedRelatedNote)}
                reason={selectedRelatedNote?.reason ?? ""}
                onToggle={() => onToggle(candidate.id)}
                onReasonChange={(reason) =>
                  onReasonChange(candidate.id, reason)
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
