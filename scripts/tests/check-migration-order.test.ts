/**
 * scripts/check-migration-order.mjs 검증
 *
 * 테스트 범위:
 * - 임시 Git 저장소에서 실제 스크립트를 실행해 exit code와 출력을 확인한다
 *   (신규 없음 / 최신보다 뒤 / 최신과 같음 / 최신보다 앞섬 / base에 마이그레이션 없음 / 인자 없음)
 * - ci.yml의 검사 step이 pull_request·merge_group 두 이벤트 모두에서 실행되는지 확인한다
 *
 * 전략:
 * - 스크립트는 git CLI에 의존하므로 mocking 대신 os.tmpdir 아래에 저장소를 만들어 통합 검증한다
 * - 워크플로 조건은 yaml 파서 의존성이 없어 step 블록만 잘라 텍스트로 검증한다
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = resolve(ROOT, "scripts/check-migration-order.mjs");
const MIGRATIONS_DIR = "supabase/migrations";
const BASE_BRANCH = "base";
const FEATURE_BRANCH = "feature";

let repoDir: string;

function git(args: string[]) {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd: repoDir, stdio: "pipe" },
  );
}

function addMigration(name: string) {
  const dir = join(repoDir, MIGRATIONS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), "select 1;\n");
  git(["add", "-A"]);
  git(["commit", "-m", `add ${name}`]);
}

function runScript(args: string[] = [BASE_BRANCH]) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: repoDir,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), "check-migration-order-"));
  git(["init", "-q", "-b", BASE_BRANCH]);
  writeFileSync(join(repoDir, "README.md"), "init\n");
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "init"]);
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

describe("check-migration-order.mjs", () => {
  describe("base에 마이그레이션이 있을 때", () => {
    const BASE_LATEST = "20260902000000";

    beforeEach(() => {
      addMigration("20260901000000_first.sql");
      addMigration(`${BASE_LATEST}_second.sql`);
      git(["checkout", "-q", "-b", FEATURE_BRANCH]);
    });

    it("신규 마이그레이션이 없으면 통과한다", () => {
      const result = runScript();

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("신규 0개");
      expect(result.stdout).toContain(`base 최신 ${BASE_LATEST}`);
    });

    it("base 최신보다 뒤인 타임스탬프는 통과한다", () => {
      addMigration("20260903000000_newer.sql");

      const result = runScript();

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("신규 1개");
    });

    it("base 최신과 같은 타임스탬프는 거부한다", () => {
      const name = `${BASE_LATEST}_duplicate.sql`;
      addMigration(name);

      const result = runScript();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(BASE_LATEST);
      expect(result.stderr).toContain(`${MIGRATIONS_DIR}/${name}`);
    });

    it("base 최신보다 앞선 타임스탬프는 거부한다", () => {
      const name = "20260901120000_stale.sql";
      addMigration(name);

      const result = runScript();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${MIGRATIONS_DIR}/${name}`);
    });

    it("앞선 파일과 뒤인 파일이 섞여 있으면 앞선 파일만 보고한다", () => {
      const stale = "20260901120000_stale.sql";
      const newer = "20260903000000_newer.sql";
      addMigration(stale);
      addMigration(newer);

      const result = runScript();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${MIGRATIONS_DIR}/${stale}`);
      expect(result.stderr).not.toContain(`${MIGRATIONS_DIR}/${newer}`);
    });

    it("base 브랜치에만 추가된 마이그레이션은 검사 대상이 아니다", () => {
      // 브랜치를 오래 유지하는 동안 base에 더 최신 마이그레이션이 들어온 상황.
      // feature 쪽 신규 파일이 없으므로 통과해야 한다.
      git(["checkout", "-q", BASE_BRANCH]);
      addMigration("20260904000000_on_base.sql");
      git(["checkout", "-q", FEATURE_BRANCH]);

      const result = runScript();

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("신규 0개");
      expect(result.stdout).toContain("base 최신 20260904000000");
    });

    it("분기 후 base가 앞서가면 feature의 마이그레이션을 거부한다", () => {
      const stale = "20260903000000_feature.sql";
      addMigration(stale);
      expect(runScript().status).toBe(0);

      git(["checkout", "-q", BASE_BRANCH]);
      addMigration("20260904000000_on_base.sql");
      git(["checkout", "-q", FEATURE_BRANCH]);

      const result = runScript();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("20260904000000");
      expect(result.stderr).toContain(`${MIGRATIONS_DIR}/${stale}`);
    });

    it.each([
      { timestamp: "20260903000000", status: 1 },
      { timestamp: "20260905000000", status: 0 },
    ])(
      "병합 커밋에서 $timestamp 파일의 검사 결과는 $status다",
      ({ timestamp, status }) => {
        const feature = `${timestamp}_feature.sql`;
        const base = "20260904000000_on_base.sql";
        addMigration(feature);
        git(["checkout", "-q", BASE_BRANCH]);
        addMigration(base);
        git(["checkout", "-q", FEATURE_BRANCH]);
        git(["merge", "--no-ff", "-m", "merge base", BASE_BRANCH]);
        git(["checkout", "--detach", "HEAD"]);

        const result = runScript();

        expect(result.status).toBe(status);
        if (status === 0) {
          expect(result.stdout).toContain("신규 1개");
          expect(result.stdout).toContain("base 최신 20260904000000");
        } else {
          expect(result.stderr).toContain(`${MIGRATIONS_DIR}/${feature}`);
          expect(result.stderr).not.toContain(`${MIGRATIONS_DIR}/${base}`);
        }
      },
    );
  });

  describe("base에 마이그레이션이 없을 때", () => {
    beforeEach(() => {
      git(["checkout", "-q", "-b", FEATURE_BRANCH]);
    });

    it("어떤 타임스탬프든 통과한다", () => {
      addMigration("20200101000000_any.sql");

      const result = runScript();

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("base 최신 없음");
    });
  });

  it("base-ref 인자가 없으면 exit 2로 종료한다", () => {
    const result = runScript([]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("사용법");
  });
});

describe("ci.yml Check migration order step", () => {
  const workflow = readFileSync(
    resolve(ROOT, ".github/workflows/ci.yml"),
    "utf8",
  );

  /**
   * `- name: Check migration order` 부터 다음 step(`- name:`) 직전까지의 블록
   */
  function stepBlock() {
    const start = workflow.indexOf("- name: Check migration order");
    expect(start).toBeGreaterThan(-1);
    const rest = workflow.slice(start + 1);
    const next = rest.search(/\n\s*- name: /);
    return next === -1 ? rest : rest.slice(0, next);
  }

  it("특정 이벤트로 실행을 제한하는 if 조건이 없다", () => {
    // pull_request 로 제한하면 merge queue의 최종 검증 시점에 검사가 건너뛰어진다
    expect(stepBlock()).not.toMatch(/^\s*if:/m);
  });

  it("pull_request와 merge_group의 base 브랜치를 모두 참조한다", () => {
    const block = stepBlock();

    expect(block).toMatch(
      /^\s*BASE_REF: \$\{\{ github\.base_ref \|\| github\.event\.merge_group\.base_ref \}\}\s*$/m,
    );
  });

  it.each(["development", "refs/heads/development", "main", "refs/heads/main"])(
    "%s 입력으로 올바른 브랜치를 fetch하고 검사한다",
    (baseRef) => {
      const run = stepBlock().split(/run: \|\r?\n/)[1];
      expect(run).toBeDefined();
      // Windows에서는 WSL 대신 git CLI와 함께 설치된 Git Bash를 사용한다.
      // PATH에 잡힌 git.exe 위치(cmd/, mingw64/bin/)에 따라 상대 경로가 달라지므로
      // `git --exec-path`(<Git>/mingw64/libexec/git-core)에서 설치 루트를 역산한다.
      const bash =
        process.platform === "win32"
          ? resolve(
              execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(),
              "../../..",
              "usr/bin/bash.exe",
            )
          : "bash";
      // 네트워크 호출 없이 실제 workflow 셸 코드가 전달하는 인자를 검증한다.
      const result = spawnSync(
        bash,
        [
          "--noprofile",
          "--norc",
          "-e",
          "-c",
          [
            'git() { printf "git <%s>\\n" "$@"; }',
            'node() { printf "node <%s>\\n" "$@"; }',
            run,
          ].join("\n"),
        ],
        {
          env: { ...process.env, BASE_REF: baseRef },
          encoding: "utf8",
        },
      );
      const branch = baseRef.endsWith("development") ? "development" : "main";

      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.replace(/\r\n/g, "\n")).toBe(
        [
          "git <fetch>",
          "git <--no-tags>",
          "git <origin>",
          `git <${branch}>`,
          "node <scripts/check-migration-order.mjs>",
          `node <origin/${branch}>`,
          "",
        ].join("\n"),
      );
    },
  );

  it("워크플로가 pull_request와 merge_group 이벤트를 모두 구독한다", () => {
    const onBlock = workflow.slice(
      workflow.indexOf("\non:"),
      workflow.indexOf("\nconcurrency:"),
    );

    expect(onBlock).toMatch(/^\s*pull_request:/m);
    expect(onBlock).toMatch(/^\s*merge_group:/m);
  });
});
