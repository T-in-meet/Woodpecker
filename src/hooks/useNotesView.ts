"use client";

import { useEffect, useState } from "react";

import type { NotesView } from "@/features/notes/utils/buildNotesUrl";

export const NOTES_VIEW_STORAGE_KEY = "woodpecker:notes-view";

export function useNotesView(
  initialView: NotesView = "list",
): [NotesView, (v: NotesView) => void] {
  const [view, setView] = useState<NotesView>(initialView);

  useEffect(() => {
    const saved = localStorage.getItem(NOTES_VIEW_STORAGE_KEY);
    if (saved === "cards" || saved === "list") {
      setView(saved);
    }
  }, []);

  function updateView(v: NotesView) {
    setView(v);
    localStorage.setItem(NOTES_VIEW_STORAGE_KEY, v);
  }

  return [view, updateView];
}
