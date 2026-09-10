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

/**
 * 루트 레이아웃이 `headers()`를 읽어 모든 라우트가 동적 렌더링이라, 이 읽기는
 * 빌드가 아니라 요청 시점에 서버에서 일어난다. 그래서 본문 `.md`가 배포 번들에
 * 들어가 있어야 한다.
 *
 * `path.join(...)`을 `getGuideMarkdownPath()`로 감싸 넘기면 Next의 output file
 * tracing이 인자를 불투명한 함수 호출로 보고 경로를 해석하지 못한다. 여기서는
 * 인자 자리에 직접 적어 정적으로 읽히게 한다. 그것만으로는 확실하지 않아
 * `next.config.ts`의 `outputFileTracingIncludes`로도 함께 못박아 둔다.
 */
export async function readGuideMarkdown(slug: string): Promise<string> {
  return readFile(
    path.join(process.cwd(), "src", "content", "guide", `${slug}.md`),
    "utf8",
  );
}
