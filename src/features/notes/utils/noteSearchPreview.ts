import { stripNoteColorSyntax } from "@/features/editor/utils/noteColorMarkdown";
import { stripMarkdown } from "@/lib/utils/stripMarkdown";

export type SearchTextPart = { text: string; matched: boolean };

// Escape metacharacters so user input is always a literal search phrase.
function matchPattern(query: string) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
}

export function highlightSearchText(
  text: string,
  query: string,
): SearchTextPart[] {
  const term = query.trim();
  if (!term) return [{ text, matched: false }];
  const parts: SearchTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(matchPattern(term))) {
    const index = match.index;
    if (index > cursor)
      parts.push({ text: text.slice(cursor, index), matched: false });
    parts.push({ text: match[0], matched: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), matched: false });
  return parts;
}

export function getNoteSearchPreview(
  title: string,
  content: string,
  query: string,
) {
  const term = query.trim();
  const plainText = stripMarkdown(stripNoteColorSyntax(content));
  if (!term) return { text: plainText, sourceOnlyMatch: false };
  const text = plainText.replace(/\s+/g, " ").trim();
  const match = matchPattern(term).exec(text);
  if (match) {
    // Array.from keeps excerpt boundaries from splitting emoji surrogate pairs.
    const before = Array.from(text.slice(0, match.index));
    const after = Array.from(text.slice(match.index + match[0].length));
    return {
      text: `${before.length > 40 ? "…" : ""}${before.slice(-40).join("")}${match[0]}${after.slice(0, 80).join("")}${after.length > 80 ? "…" : ""}`,
      sourceOnlyMatch: false,
    };
  }
  const characters = Array.from(text);
  return {
    text:
      characters.slice(0, 140).join("") + (characters.length > 140 ? "…" : ""),
    sourceOnlyMatch: !matchPattern(term).test(title),
  };
}
