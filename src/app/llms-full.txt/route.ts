import { readFile } from "node:fs/promises";
import path from "node:path";

import { getPublishedGuideDocuments } from "@/features/guide/content";
import { readGuideMarkdown } from "@/features/guide/lib/readGuideMarkdown";
import { renderLandingMarkdown } from "@/features/landing/markdown";
import { markdownResponse } from "@/lib/seo/markdownResponse";

export const dynamic = "force-static";

async function readContent(filename: string): Promise<string> {
  const filePath = path.join(
    process.cwd(),
    "src",
    "content",
    "legal",
    filename,
  );
  return readFile(filePath, "utf8");
}

/* 가이드 본문 파일에는 H1이 없다(화면에서는 페이지 컴포넌트가 heading으로 그린다).
   통합본에서는 문서 경계가 제목으로 드러나야 하므로 여기서 H1을 붙여 준다. */
async function readGuideDocuments(): Promise<string[]> {
  const publishedGuides = getPublishedGuideDocuments();

  return Promise.all(
    publishedGuides.map(async (document) => {
      const markdown = await readGuideMarkdown(document.slug);

      return [`# ${document.heading}`, "", markdown.trim(), ""].join("\n");
    }),
  );
}

// llms-full.txt는 공개 문서를 이어 붙인 통합본이라 대응하는 HTML 페이지가 없다.
// markdownResponse가 canonical 대신 X-Robots-Tag: noindex를 붙인다.
export async function GET(): Promise<Response> {
  const [privacy, terms, guides] = await Promise.all([
    readContent("privacy.md"),
    readContent("terms.md"),
    readGuideDocuments(),
  ]);

  const body = [
    renderLandingMarkdown(),
    "---",
    "",
    ...guides.flatMap((guide) => [guide, "---", ""]),
    privacy.trim(),
    "",
    "---",
    "",
    terms.trim(),
    "",
  ].join("\n");

  return markdownResponse(body);
}
