import removeMd from "remove-markdown";

export function stripMarkdown(text: string): string {
  const preprocessed = text
    .replace(/\[[ xX]\]/g, "")
    .replace(/^\|[\s\-|:]+\|$/gm, "")
    .replace(/\|/g, " ");
  return removeMd(preprocessed).replace(/`/g, "").replace(/ {2,}/g, " ").trim();
}
