"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { getNoteReviewRoute } from "@/lib/constants/routes";

import { deleteNoteAction } from "../actions";

export function useNoteCardActions(noteId: string) {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleStartReview(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(getNoteReviewRoute(noteId));
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("이 노트를 삭제하시겠습니까?")) return;
    startDeleteTransition(async () => {
      await deleteNoteAction(noteId);
    });
  }

  return {
    isDeleting,
    handleStartReview,
    handleDelete,
  };
}
