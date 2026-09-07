import { readFile } from "node:fs/promises";
import path from "node:path";

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

// llms-full.txt는 세 문서를 이어 붙인 통합본이라 대응하는 HTML 페이지가 없다.
// markdownResponse가 canonical 대신 X-Robots-Tag: noindex를 붙인다.
export async function GET(): Promise<Response> {
  const [privacy, terms] = await Promise.all([
    readContent("privacy.md"),
    readContent("terms.md"),
  ]);

  const body = [
    renderLandingMarkdown(),
    "---",
    "",
    privacy.trim(),
    "",
    "---",
    "",
    terms.trim(),
    "",
  ].join("\n");

  return markdownResponse(body);
}
