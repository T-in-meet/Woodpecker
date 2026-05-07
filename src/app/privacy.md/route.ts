import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const filePath = path.join(
    process.cwd(),
    "src",
    "content",
    "legal",
    "privacy.md",
  );
  const body = await readFile(filePath, "utf8");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      Vary: "Accept",
    },
  });
}
