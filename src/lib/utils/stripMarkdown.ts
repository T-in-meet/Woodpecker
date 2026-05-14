import removeMd from "remove-markdown";

export function stripMarkdown(text: string): string {
  const preprocessed = text
    .replace(/\[[ x]\]/g, "")
    .replace(/^\|[\s\-|:]+\|$/gm, "")
    .replace(/\|/g, " ");
  return removeMd(preprocessed).replace(/`/g, "");
}
