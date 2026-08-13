import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 개인정보 처리방침은 두 곳에 같은 내용이 중복돼 있다.
 * - `src/content/legal/privacy.md` — `/privacy.md` 원문 배포용
 * - `src/components/legal/PrivacySections.tsx` — 화면 렌더링용
 *
 * 한쪽만 고치면 사용자가 보는 문서와 배포되는 문서가 갈린다.
 * 특히 위탁 목록은 개인정보를 넘기는 대상이라 어긋나면 곧 고지 누락이다.
 */
const MARKDOWN = readFileSync(
  join(process.cwd(), "src/content/legal/privacy.md"),
  "utf8",
);
const COMPONENT = readFileSync(
  join(process.cwd(), "src/components/legal/PrivacySections.tsx"),
  "utf8",
);

/** 개인정보 처리를 위탁하는 사업자. 새로 추가하면 여기에도 넣는다. */
const PROCESSORS = ["Supabase Inc.", "Cloudflare, Inc."] as const;

describe("개인정보 처리방침 위탁 목록", () => {
  it.each(PROCESSORS)("%s가 마크다운 원문에 있다", (processor) => {
    expect(MARKDOWN).toContain(processor);
  });

  it.each(PROCESSORS)("%s가 렌더링 컴포넌트에 있다", (processor) => {
    expect(COMPONENT).toContain(processor);
  });

  it("노트 본문을 보내는 AI 처리자가 고지돼 있다", () => {
    // 노트 본문과 백지 테스트 답안이 Cloudflare Workers AI로 전송된다.
    expect(MARKDOWN).toContain("Cloudflare, Inc.");
    expect(COMPONENT).toContain("Cloudflare, Inc.");
  });
});
