import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * 가이드 본문 마크다운 경로.
 *
 * 본문을 `src/content/guide/`에 두는 이유는 `src/content/legal/`과 같다. 문서를
 * 고치는 일과 화면을 고치는 일을 분리해, 오탈자 수정이 컴포넌트 diff로 번지지 않게 한다.
 */
export function getGuideMarkdownPath(slug: string): string {
  return path.join(process.cwd(), "src", "content", "guide", `${slug}.md`);
}

export async function readGuideMarkdown(slug: string): Promise<string> {
  return readFile(getGuideMarkdownPath(slug), "utf8");
}
