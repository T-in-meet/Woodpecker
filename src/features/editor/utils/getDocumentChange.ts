import { Annotation, type ChangeSpec } from "@codemirror/state";

export const EXTERNAL_SYNC_ANNOTATION = Annotation.define<boolean>();

export function getDocumentChange(
  currentDoc: string,
  nextDoc: string,
): ChangeSpec | null {
  if (currentDoc === nextDoc) {
    return null;
  }

  let from = 0;

  while (
    from < currentDoc.length &&
    from < nextDoc.length &&
    currentDoc[from] === nextDoc[from]
  ) {
    from += 1;
  }

  let currentTo = currentDoc.length;
  let nextTo = nextDoc.length;

  while (
    currentTo > from &&
    nextTo > from &&
    currentDoc[currentTo - 1] === nextDoc[nextTo - 1]
  ) {
    currentTo -= 1;
    nextTo -= 1;
  }

  return {
    from,
    to: currentTo,
    insert: nextDoc.slice(from, nextTo),
  };
}
