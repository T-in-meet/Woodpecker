import { execFileSync } from "node:child_process";

/**
 * PR에서 새로 추가된 마이그레이션의 타임스탬프가 base 브랜치의 마지막 마이그레이션보다
 * 뒤인지 확인합니다.
 *
 * 운영 DB 적용(`migrate.yml`)은 `supabase db push`를 쓰는데, 원격에 이미 적용된 마지막
 * 마이그레이션보다 앞선 타임스탬프의 파일이 있으면 전체 적용을 거부합니다.
 * 브랜치를 오래 유지하다 머지하면 이런 파일이 생기므로 릴리스 전 PR CI에서 미리 잡습니다.
 *
 * 사용: node scripts/check-migration-order.mjs <base-ref>
 * 예:   node scripts/check-migration-order.mjs origin/development
 */

const MIGRATIONS_DIR = "supabase/migrations";
const MIGRATION_PATTERN = /^supabase\/migrations\/(\d{14})_.+\.sql$/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function timestampOf(path) {
  return path.match(MIGRATION_PATTERN)?.[1] ?? null;
}

const baseRef = process.argv[2];

if (!baseRef) {
  console.error("사용법: node scripts/check-migration-order.mjs <base-ref>");
  process.exit(2);
}

// base 브랜치에 이미 있는 마이그레이션 중 가장 늦은 타임스탬프
const baseTimestamps = git([
  "ls-tree",
  "-r",
  "--name-only",
  baseRef,
  "--",
  MIGRATIONS_DIR,
])
  .map(timestampOf)
  .filter(Boolean)
  .sort();
const baseLatest = baseTimestamps.at(-1) ?? null;

// 이 브랜치에서 새로 추가된 마이그레이션 (base와의 merge-base 기준)
const added = git([
  "diff",
  "--name-only",
  "--diff-filter=A",
  `${baseRef}...HEAD`,
  "--",
  MIGRATIONS_DIR,
]).filter((path) => timestampOf(path) !== null);

const outOfOrder =
  baseLatest === null
    ? []
    : added.filter((path) => timestampOf(path) <= baseLatest);

if (outOfOrder.length > 0) {
  console.error(
    `base(${baseRef})의 마지막 마이그레이션 타임스탬프: ${baseLatest}`,
  );
  console.error(
    "아래 파일의 타임스탬프가 그보다 앞서 있어 운영 `supabase db push`가 적용을 거부합니다.",
  );
  console.error("파일명의 타임스탬프를 현재 UTC 시각으로 갱신하세요.\n");

  for (const path of outOfOrder) {
    console.error(`  ${path}`);
  }

  process.exit(1);
}

console.log(
  `마이그레이션 순서 OK (신규 ${added.length}개, base 최신 ${baseLatest ?? "없음"})`,
);
