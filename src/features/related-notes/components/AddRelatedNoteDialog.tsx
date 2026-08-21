"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { getAdminPagination } from "@/features/admin/utils/admin-pagination";

import { useAddManualRelatedNotes } from "../hooks/use-add-manual-related-notes";
import { useRelatedNoteCandidates } from "../hooks/use-related-note-candidates";
import { MAX_MANUAL_RELATED_NOTES_PER_REQUEST } from "../schemas";
import { RelatedNoteCandidateList } from "./RelatedNoteCandidateList";
import { RelatedNoteCandidatePagination } from "./RelatedNoteCandidatePagination";

const PAGE_SIZE = 6;

const addRelatedNotesSchema = z.object({
  relatedNotes: z
    .array(
      z.object({
        relatedNoteId: z.string().uuid(),
        reason: z
          .string()
          .trim()
          .max(500, "연결 이유는 500자 이하로 입력해주세요."),
      }),
    )
    .min(1, "연결할 노트를 하나 이상 선택해주세요.")
    .max(
      MAX_MANUAL_RELATED_NOTES_PER_REQUEST,
      `관련 노트는 한 번에 최대 ${MAX_MANUAL_RELATED_NOTES_PER_REQUEST}개까지 추가할 수 있습니다.`,
    ),
});

type AddRelatedNotesFormValues = z.infer<typeof addRelatedNotesSchema>;

type AddRelatedNoteDialogProps = {
  /** Related Notes를 추가할 기준 Note ID입니다. */
  noteId: string;
};

/**
 * 사용자가 자신의 Notes 중 여러 개를 선택하여
 * 현재 Note에 수동 Related Notes로 연결하기 위한 Dialog입니다.
 *
 * 검색어와 pagination은 후보 조회를 위한 UI 상태이므로 local state로 관리하고,
 * 실제 저장 대상인 Related Notes와 각 연결 이유는 React Hook Form에서 관리합니다.
 *
 * @param props Related Notes를 추가할 기준 Note ID
 */
export function AddRelatedNoteDialog({ noteId }: AddRelatedNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const form = useForm<AddRelatedNotesFormValues>({
    resolver: zodResolver(addRelatedNotesSchema),
    defaultValues: {
      relatedNotes: [],
    },
  });

  const { append, remove } = useFieldArray({
    control: form.control,
    name: "relatedNotes",
  });

  const selectedRelatedNotes = form.watch("relatedNotes");

  const addManualRelatedNotesMutation = useAddManualRelatedNotes();

  const { data, isLoading, isFetching } = useRelatedNoteCandidates({
    noteId,
    page,
    search,
    pageSize: PAGE_SIZE,
  });

  const candidates = data?.notes ?? [];
  const total = data?.total ?? 0;
  const pagination = getAdminPagination({
    currentPage: page,
    totalCount: total,
    pageSize: PAGE_SIZE,
    pageCount: 1,
  });

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
      addManualRelatedNotesMutation.reset();
    }
  }

  /**
   * 후보 Note 선택 상태를 전환합니다.
   *
   * 이미 선택된 Note라면 form 배열에서 제거하고,
   * 선택되지 않은 Note라면 빈 reason과 함께 추가합니다.
   */
  function handleCandidateToggle(candidateId: string) {
    const selectedIndex = selectedRelatedNotes.findIndex(
      (relatedNote) => relatedNote.relatedNoteId === candidateId,
    );

    if (selectedIndex >= 0) {
      remove(selectedIndex);
      return;
    }

    append({
      relatedNoteId: candidateId,
      reason: "",
    });
  }

  async function handleSubmit(values: AddRelatedNotesFormValues) {
    try {
      await addManualRelatedNotesMutation.mutateAsync({
        noteId,
        relatedNotes: values.relatedNotes.map((relatedNote) => ({
          relatedNoteId: relatedNote.relatedNoteId,
          ...(relatedNote.reason
            ? {
                reason: relatedNote.reason,
              }
            : {}),
        })),
      });

      handleOpenChange(false);

      toast.success(
        values.relatedNotes.length === 1
          ? "관련 노트를 추가했습니다."
          : `관련 노트 ${values.relatedNotes.length}개를 추가했습니다.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "관련 노트 추가에 실패했습니다.",
      );
    }
  }

  function handleReasonChange(candidateId: string, reason: string) {
    const selectedIndex = selectedRelatedNotes.findIndex(
      (relatedNote) => relatedNote.relatedNoteId === candidateId,
    );

    if (selectedIndex < 0) {
      return;
    }

    form.setValue(`relatedNotes.${selectedIndex}.reason`, reason, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  /*
   * 검색 결과가 줄어 현재 page가 전체 페이지 수를 초과하게 된 경우
   * 유효한 마지막 페이지로 보정합니다.
   */
  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

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
            연결할 노트를 선택하고 필요하면 각 노트의 연결 이유를 입력할 수
            있습니다.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto [scrollbar-gutter:stable] -mr-4 pr-4 sm:-mr-6 sm:pr-6">
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
                selectedRelatedNotes={selectedRelatedNotes}
                isLoading={isLoading}
                isFetching={isFetching}
                onToggle={handleCandidateToggle}
                onReasonChange={handleReasonChange}
              />

              {form.formState.errors.relatedNotes?.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.relatedNotes.root.message}
                </p>
              )}

              <RelatedNoteCandidatePagination
                page={page}
                totalCount={total}
                pageSize={PAGE_SIZE}
                isFetching={isFetching}
                onPageChange={setPage}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              취소
            </Button>

            <Button
              type="submit"
              disabled={
                selectedRelatedNotes.length === 0 ||
                addManualRelatedNotesMutation.isPending
              }
            >
              {addManualRelatedNotesMutation.isPending
                ? "추가 중..."
                : selectedRelatedNotes.length > 1
                  ? `${selectedRelatedNotes.length}개 추가`
                  : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
