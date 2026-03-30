const TASK_LIST_MARKER_PATTERN = /^(\s*(?:[-+*]|\d+[.)])\s)\[( |x|X)\]/gm;

export function toggleMarkdownTaskItem(content: string, index: number) {
  let currentIndex = 0;
  let didToggle = false;

  const nextContent = content.replace(
    TASK_LIST_MARKER_PATTERN,
    (match, prefix: string, marker: string) => {
      if (currentIndex !== index) {
        currentIndex += 1;
        return match;
      }

      currentIndex += 1;
      didToggle = true;

      return `${prefix}[${marker === " " ? "x" : " "}]`;
    },
  );

  return didToggle ? nextContent : content;
}
