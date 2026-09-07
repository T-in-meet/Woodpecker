// OG 이미지(public/og-image.png) 생성 스크립트.
//
// 랜딩 hero와 같은 카피·같은 배경으로 1200x630 카드를 렌더링해 PNG로 굽는다.
// 한 번 굽고 커밋하는 정적 자산이므로 빌드 파이프라인에는 들어가지 않는다.
// 카피(heroContent)나 로고(woodpecker.png)를 바꾸면 이 스크립트를 다시 돌린다.
//
//   node scripts/generate-og-image.mjs
//
// Playwright 브라우저를 따로 받지 않고 시스템에 설치된 Edge/Chrome을 쓴다.
//
// 폰트는 시스템 폰트에 기대지 않고 Google Fonts에서 받아 굽는다.
// 실행 환경이 달라도 결과가 같아야 하기 때문이다. 네트워크가 필요하지만
// 빌드가 아니라 이 스크립트를 돌릴 때만 그렇다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public", "og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;
const WORDMARK_FONTS = [
  { file: "jua-wordmark-b531.woff2", unicodeRange: "U+B531" },
  { file: "jua-wordmark-ad6c.woff2", unicodeRange: "U+AD6C" },
  { file: "jua-wordmark-b2e4-b9ac.woff2", unicodeRange: "U+B2E4, U+B9AC" },
];

// 랜딩 hero와 문구를 맞춘다. content.ts는 TS라 여기서 import하지 않고 옮겨 적되,
// 바뀌면 함께 고친다는 걸 잊지 않도록 출처를 명시한다.
// 출처: src/features/landing/content.ts (heroContent)
const TITLE = "기록이 기억이 되는 공간";
const DESCRIPTION =
  "공부한 내용을 기록하면 복습 시점을 알려주고,\n백지 테스트와 AI 피드백으로 기억할 때까지 반복해요.";

async function buildHtml() {
  const logo = await readFile(path.join(ROOT, "public", "woodpecker.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const wordmarkFontFaces = await Promise.all(
    WORDMARK_FONTS.map(async ({ file, unicodeRange }) => {
      const font = await readFile(path.join(ROOT, "public", "fonts", file));
      return `@font-face { font-family: "Woodpecker Jua"; font-style: normal; font-weight: 400; src: url("data:font/woff2;base64,${font.toString("base64")}") format("woff2"); unicode-range: ${unicodeRange}; }`;
    }),
  );

  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8" />
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap" />
<style>
  ${wordmarkFontFaces.join("\n  ")}
  /* 워드마크는 layout.tsx가 next/font/google로 쓰는 것과 같은 주아체다
     — 한쪽만 바꾸면 헤더와 OG 이미지의 서비스명이 서로 달라진다. */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px;
    font-family: "Noto Sans KR", sans-serif;
    /* HeroSection의 from-amber-50 via-orange-50 to-rose-50 */
    background: linear-gradient(135deg, #fffbeb 0%, #fff7ed 50%, #fff1f2 100%);
    position: relative; overflow: hidden;
  }
  /* hero의 blur blob 두 개 */
  .blob { position: absolute; border-radius: 9999px; filter: blur(80px); }
  .blob-1 {
    top: -140px; right: -140px; width: 460px; height: 460px;
    background: linear-gradient(135deg, rgba(253,230,138,.55), rgba(254,215,170,.55));
  }
  .blob-2 {
    bottom: -120px; left: -140px; width: 400px; height: 400px;
    background: linear-gradient(45deg, rgba(254,205,211,.55), rgba(251,207,232,.55));
  }
  /* HeroSection이 h1·본문 모두 text-center라 카드도 가운데로 맞춘다.
     왼쪽 정렬로 두면 76px 제목이 폭을 다 쓰지 못해 오른쪽만 비어 보인다. */
  .card {
    position: relative; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    padding: 0 80px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  /* 세로로 긴 원본 아이콘을 글자 높이에 맞춰 축소한다. */
  .brand img { width: 52px; height: 52px; }
  .brand span {
    /* 헤더 워드마크(Header.tsx의 font-brand)와 같은 폰트.
       주아체는 normal 한 벌뿐이라 굵기를 올리면 가짜 볼드가 된다. */
    font-family: "Woodpecker Jua", sans-serif;
    font-size: 46px; font-weight: 400; color: #1c1917; letter-spacing: -.01em;
    /* 아이콘은 투명 여백을 포함한 정사각형이고 글자는 기준선으로 배치된다.
       글자를 조금 내려 두 요소의 시각적 하단선을 맞춘다. */
    transform: translateY(3px);
  }
  h1 {
    margin-top: 40px;
    font-size: 76px; font-weight: 700; color: #1c1917;
    letter-spacing: -.035em; line-height: 1.2;
  }
  p {
    margin-top: 32px; white-space: pre-line;
    font-size: 32px; font-weight: 400; color: #57534e;
    line-height: 1.55; letter-spacing: -.01em;
  }
  .rule { margin-top: 48px; width: 88px; height: 6px; border-radius: 3px; background: #b45309; }
</style>
</head>
<body>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="card">
    <div class="brand"><img src="${logoSrc}" alt="" /><span>딱다구리</span></div>
    <h1>${TITLE}</h1>
    <p>${DESCRIPTION}</p>
    <div class="rule"></div>
  </div>
</body>
</html>`;
}

async function launch() {
  // 설치된 브라우저를 순서대로 시도한다. 전부 없으면 마지막 에러를 그대로 던진다.
  const channels = [undefined, "msedge", "chrome"];
  let lastError;
  for (const channel of channels) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const browser = await launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
await page.setContent(await buildHtml(), { waitUntil: "networkidle" });
// 웹폰트가 도착하기 전에 찍으면 폴백 폰트가 그대로 구워진다.
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUTPUT, type: "png" });
await browser.close();

console.log(`generated ${path.relative(ROOT, OUTPUT)} (${WIDTH}x${HEIGHT})`);
