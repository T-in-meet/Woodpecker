"use client";

import { useState } from "react";

import type { NotesView } from "@/features/notes/utils/buildNotesUrl";

export const NOTES_VIEW_COOKIE = "notes-view";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function useNotesView(
  initialView: NotesView = "list",
): [NotesView, (v: NotesView) => void] {
  const [view, setView] = useState<NotesView>(initialView);

  function updateView(v: NotesView) {
    setView(v);
    document.cookie = `${NOTES_VIEW_COOKIE}=${v}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  return [view, updateView];
}
