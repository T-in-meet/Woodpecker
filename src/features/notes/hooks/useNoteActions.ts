"use client";

import { useRouter } from "next/navigation";

import { getNoteReviewRoute } from "@/lib/constants/routes";

export function useNoteActions(noteId: string) {
  const router = useRouter();

  function handleStartReview(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(getNoteReviewRoute(noteId));
  }

  return {
    handleStartReview,
  };
}
