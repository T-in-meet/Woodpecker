"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

import { useRelatedNoteCandidates } from "../hooks/use-related-note-candidates";
import { RelatedNoteCandidateList } from "./RelatedNoteCandidateList";
import { RelatedNoteCandidatePagination } from "./RelatedNoteCandidatePagination";

const PAGE_SIZE = 6;

const addRelatedNoteSchema = z.object({
  relatedNoteId: z.string().uuid("연결할 노트를 선택해주세요."),
  reason: z.string().trim().max(500, "연결 이유는 500자 이하로 입력해주세요."),
});

type AddRelatedNoteFormValues = z.infer<typeof addRelatedNoteSchema>;

type AddRelatedNoteDialogProps = {
  /** Related Note를 추가할 기준 Note ID입니다. */
  noteId: string;
};

/**
 * 사용자가 자신의 Note 중 하나를 선택하여
 * 현재 Note에 수동 Related Note로 연결하기 위한 Dialog입니다.
 *
 * 검색어와 pagination은 후보 조회를 위한 UI 상태이므로 local state로 관리하고,
 * 실제 저장 대상인 relatedNoteId와 reason만 React Hook Form에서 관리합니다.
 *
 * 현재 단계에서는 후보 선택과 입력 UI까지만 제공하며,
 * 실제 Related Note 저장 mutation은 후속 구현에서 연결합니다.
 *
 * @param props Related Note를 추가할 기준 Note ID
 */
export function AddRelatedNoteDialog({ noteId }: AddRelatedNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const form = useForm<AddRelatedNoteFormValues>({
    resolver: zodResolver(addRelatedNoteSchema),
    defaultValues: {
      relatedNoteId: "",
      reason: "",
    },
  });

  const selectedRelatedNoteId = form.watch("relatedNoteId");

  const { data, isLoading, isFetching } = useRelatedNoteCandidates({
    noteId,
    page,
    search,
    pageSize: PAGE_SIZE,
  });

  const candidates = data?.notes ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedCandidate = useMemo(
    () =>
      candidates.find((candidate) => candidate.id === selectedRelatedNoteId) ??
      null,
    [candidates, selectedRelatedNoteId],
  );

  /*
   * 검색 조건이 변경되면 첫 페이지부터 다시 조회합니다.
   *
   * 검색 input 값 자체와 실제 Query에 사용할 검색어를 분리하여
   * 사용자가 Enter 또는 검색 버튼을 눌렀을 때만 서버 조회가 변경되도록 합니다.
   */
  function handleSearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  /*
   * Dialog를 닫을 때 다음 열기에서 이전 상태가 남지 않도록
   * 검색, pagination, form 상태를 모두 초기화합니다.
   */
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setSearchInput("");
      setSearch("");
      setPage(1);
      form.reset();
    }
  }

  function handleCandidateSelect(candidateId: string) {
    form.setValue("relatedNoteId", candidateId, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleSubmit(values: AddRelatedNoteFormValues) {
    /*
     * 실제 추가 Server Action / mutation은 후속 구현에서 연결합니다.
     *
     * values:
     * {
     *   relatedNoteId,
     *   reason
     * }
     */
    console.log("[Add Related Note]", values);
  }

  /*
   * 검색 결과가 줄어 현재 page가 totalPages를 초과하게 된 경우
   * 유효한 마지막 페이지로 보정합니다.
   */
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          관련 노트 추가
        </Button>
      </DialogTrigger>

      <DialogContent className="left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none p-4 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[90vw] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>관련 노트 추가</DialogTitle>
          <DialogDescription>
            연결할 노트를 선택하고 필요하면 연결 이유를 입력할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto -mr-4 pr-4 sm:-mr-6 sm:pr-6">
            <div className="space-y-2">
              <Label htmlFor="related-note-search">노트 검색</Label>

              <div className="flex min-w-0 gap-2">
                <Input
                  id="related-note-search"
                  className="min-w-0"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="노트 제목 검색"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSearch}
                  aria-label="노트 검색"
                >
                  <Search className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>연결할 노트</Label>

              <RelatedNoteCandidateList
                candidates={candidates}
                selectedRelatedNoteId={selectedRelatedNoteId}
                isLoading={isLoading}
                isFetching={isFetching}
                onSelect={handleCandidateSelect}
              />

              {form.formState.errors.relatedNoteId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.relatedNoteId.message}
                </p>
              )}

              <RelatedNoteCandidatePagination
                page={page}
                totalPages={totalPages}
                isFetching={isFetching}
                onPrevious={() => setPage((current) => current - 1)}
                onNext={() => setPage((current) => current + 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="related-note-reason">
                연결 이유
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  선택
                </span>
              </Label>

              <Textarea
                id="related-note-reason"
                rows={3}
                maxLength={500}
                placeholder="이 노트를 연결하는 이유를 입력할 수 있습니다."
                {...form.register("reason")}
              />

              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            {selectedCandidate && (
              <p className="text-xs text-muted-foreground">
                선택됨: {selectedCandidate.title}
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              취소
            </Button>

            <Button type="submit" disabled={!selectedRelatedNoteId}>
              추가
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
