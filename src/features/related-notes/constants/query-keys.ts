export const relatedNotesQueryKeys = {
  all: ["related-notes"] as const,
  byNoteId: (noteId: string) =>
    [...relatedNotesQueryKeys.all, "note", noteId] as const,
};
