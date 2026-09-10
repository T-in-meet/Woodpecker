// 아이콘 자산(public/icons/*) 생성 스크립트.
//
// 원본 public/woodpecker.png는 1254x1254 / 약 677KB다. 파비콘이나 알림 아이콘처럼
// next/image를 거치지 않고 원본이 그대로 내려가는 자리에 쓰면, 16~32px로 그릴
// 이미지를 위해 랜딩 페이지보다 무거운 파일을 받게 된다. 쓰이는 크기대로 미리 굽는다.
//
// 한 번 굽고 커밋하는 정적 자산이므로 빌드 파이프라인에는 들어가지 않는다.
// 로고(woodpecker.png)를 바꾸면 이 스크립트를 다시 돌린다.
//
//   node scripts/generate-icons.mjs
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "woodpecker.png");
const OUT_DIR = path.join(ROOT, "public", "icons");

/* 투명 배경을 유지한 채 정사각형으로 줄인다. fit: "contain"이라 원본 비율이
   바뀌지 않고, 여백은 투명하게 남는다. */
function resized(size) {
  return sharp(SOURCE).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}

async function writeIcon(size, filename) {
  const file = path.join(OUT_DIR, filename);
  await resized(size).png({ compressionLevel: 9 }).toFile(file);
  return file;
}

/**
 * 알림 badge용 단색 실루엣.
 *
 * 안드로이드 Chrome은 badge를 알파 채널만 보고 단색으로 칠한다. 컬러 원본을 그대로
 * 넣으면 상태표시줄에 의미를 알 수 없는 덩어리가 뜬다. 원본의 알파를 그대로 쓰되
 * 색은 흰색 단색으로 덮어 실루엣만 남긴다(칠하는 색은 OS가 정하므로 값 자체는 무의미하다).
 */
async function writeBadge(size, filename) {
  const file = path.join(OUT_DIR, filename);
  const alpha = await resized(size)
    .ensureAlpha()
    .extractChannel("alpha")
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .joinChannel(alpha)
    .png({ compressionLevel: 9 })
    .toFile(file);

  return file;
}

await mkdir(OUT_DIR, { recursive: true });

const generated = [
  // 브라우저 탭 파비콘.
  await writeIcon(32, "favicon-32.png"),
  // iOS 홈 화면 추가 시 쓰이는 크기.
  await writeIcon(180, "apple-touch-icon-180.png"),
  // 웹 푸시 알림 본문 아이콘(src/sw.ts).
  await writeIcon(192, "notification-192.png"),
  // 웹 푸시 알림 badge(src/sw.ts). 단색 실루엣이어야 한다.
  await writeBadge(96, "badge-96.png"),
];

for (const file of generated) {
  console.log(`generated ${path.relative(ROOT, file)}`);
}
