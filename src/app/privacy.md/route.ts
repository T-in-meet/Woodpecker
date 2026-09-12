import { readFile } from "node:fs/promises";
import path from "node:path";

import { ROUTES } from "@/lib/constants/routes";
import { SITE_URL } from "@/lib/constants/site";
import { markdownResponse } from "@/lib/seo/markdownResponse";

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

  return markdownResponse(body, {
    canonicalUrl: `${SITE_URL}${ROUTES.PRIVACY}`,
  });
}
