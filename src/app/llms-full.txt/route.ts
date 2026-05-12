import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderLandingMarkdown } from "@/features/landing/markdown";

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

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
