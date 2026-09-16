import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { expect, Page, test } from "@playwright/test";

import {
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_EMAIL_SUCCESS_LIMIT,
  OTP_ISSUE_IP_LONG_LIMIT,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";
import { ROUTES } from "@/lib/constants/routes";

const DEFAULT_BASE_URL = "http://localhost:3000";

const PRODUCTION_HOSTNAME = "woodpecker-blue.vercel.app";

const DEFAULT_SAMPLE_COUNT = 20;

const DEFAULT_EXISTING_REQUEST_GAP_MS = 7_000;
const MIN_EXISTING_REQUEST_GAP_MS = 7_000;

const SAMPLE_TIMEOUT_MS = 45_000;

const RESULT_DIRECTORY = resolve(process.cwd(), ".cache", "auth-timing");

const MANUAL_RUN_ENV = "RUN_AUTH_TIMING_DIAGNOSTIC";

type TimingEnvironment = "local" | "preview";

type SampleGroup = "existing" | "nonexistent";

type TimingSample = {
  sampleNumber: number;
  pairNumber: number;

  group: SampleGroup;
  accountSlot: number;

  redirectObserved: boolean;
  elapsedMs: number;

  startedAtIso: string;
  finishedAtIso: string;

  startedAtEpochMs: number;
  finishedAtEpochMs: number;

  internalOutcomeVerification: "not_applicable" | "pending";

  failureReason: string | null;
};

type TimingStats = {
  count: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
};

type RangeOverlap = {
  overlapMs: number;
  overlapRatio: number;
};

type TimingResult = {
  runId: string;
  generatedAt: string;

  interpretationStatus:
    | "pending_internal_outcome_verification"
    | "measurement_incomplete";

  environment: {
    label: TimingEnvironment;
    baseUrl: string;

    sampleCountPerGroup: number;

    existingAccountPoolSize: number;
    nonexistentAccountPoolSize: number;

    nonexistentPoolSource: "generated" | "configured";

    configuredNonexistentAbsenceConfirmed: boolean;

    existingRequestGapMs: number;

    minimumSameAccountReuseIntervalMs: number | null;

    storageStateUsed: boolean;

    previewCommit: string | null;
    previewPolicyAlignmentConfirmed: boolean;
  };

  samples: TimingSample[];

  summary: {
    existing: TimingStats | null;
    nonexistent: TimingStats | null;

    medianDifferenceMs: number | null;

    rangeOverlap: RangeOverlap | null;
  };

  internalOutcomeVerification: {
    required: true;
    status: "pending";

    existingAccountPrecondition: string;
    nonexistentAccountPrecondition: string;

    requiredCombination: string[];

    disqualifyingEvents: string[];

    note: string;
  };
};

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function deriveEnvironmentLabel(baseUrl: string): TimingEnvironment {
  const hostname = new URL(baseUrl).hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "local";
  }

  /**
   * 이 진단은 Local + Preview 전용이다.
   *
   * Production에서 실제 Provider / Email 요청이
   * 반복 실행되는 것을 방지하기 위해 명시적으로 거부한다.
   */
  if (hostname === PRODUCTION_HOSTNAME) {
    throw new Error(
      [
        "Production URL is not allowed",
        "for Auth timing diagnostics.",
        `hostname=${hostname}`,
      ].join(" "),
    );
  }

  return "preview";
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile95(sortedValues: number[]): number {
  const rank = Math.ceil(sortedValues.length * 0.95);

  const value = sortedValues[Math.max(0, rank - 1)];

  if (value === undefined) {
    throw new Error("percentile95 requires at least one value.");
  }

  return value;
}

function summarize(values: number[]): TimingStats | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);

  const minimum = sorted[0];

  const maximum = sorted[sorted.length - 1];

  if (minimum === undefined || maximum === undefined) {
    throw new Error("Timing summary requires at least one value.");
  }

  const middle = Math.floor(sorted.length / 2);

  let median: number;

  if (sorted.length % 2 === 0) {
    const lower = sorted[middle - 1];

    const upper = sorted[middle];

    if (lower === undefined || upper === undefined) {
      throw new Error("Unable to calculate timing median.");
    }

    median = (lower + upper) / 2;
  } else {
    const middleValue = sorted[middle];

    if (middleValue === undefined) {
      throw new Error("Unable to calculate timing median.");
    }

    median = middleValue;
  }

  return {
    count: sorted.length,

    medianMs: roundMs(median),

    p95Ms: roundMs(percentile95(sorted)),

    minMs: roundMs(minimum),

    maxMs: roundMs(maximum),
  };
}

function calculateRangeOverlap(
  existingStats: TimingStats | null,
  nonexistentStats: TimingStats | null,
): RangeOverlap | null {
  if (!existingStats || !nonexistentStats) {
    return null;
  }

  const lower = Math.max(existingStats.minMs, nonexistentStats.minMs);

  const upper = Math.min(existingStats.maxMs, nonexistentStats.maxMs);

  const overlapMs = Math.max(0, upper - lower);

  const unionLower = Math.min(existingStats.minMs, nonexistentStats.minMs);

  const unionUpper = Math.max(existingStats.maxMs, nonexistentStats.maxMs);

  const unionWidth = unionUpper - unionLower;

  return {
    overlapMs: roundMs(overlapMs),

    overlapRatio:
      unionWidth === 0
        ? 1
        : Math.round((overlapMs / unionWidth) * 10_000) / 10_000,
  };
}

/**
 * production과 동일한 canonicalEmail 기준으로
 * pool의 identity 중복을 검증한다.
 */
function assertCanonicalUnique(emails: string[], name: string): string[] {
  const canonicalEmails = emails.map(canonicalizeEmail);

  const seen = new Set<string>();

  for (const canonicalEmail of canonicalEmails) {
    if (seen.has(canonicalEmail)) {
      throw new Error(
        [
          `${name} contains duplicate canonical identities.`,
          `duplicate=${canonicalEmail}`,
          "Check case differences and Gmail aliases",
          "including dots, +tags, and googlemail.com.",
        ].join(" "),
      );
    }

    seen.add(canonicalEmail);
  }

  return canonicalEmails;
}

function assertNoCanonicalIntersection(
  existingCanonicalEmails: string[],
  nonexistentCanonicalEmails: string[],
): void {
  const existingSet = new Set(existingCanonicalEmails);

  for (const canonicalEmail of nonexistentCanonicalEmails) {
    if (existingSet.has(canonicalEmail)) {
      throw new Error(
        [
          "Existing and nonexistent pools overlap",
          "after email canonicalization.",
          `identity=${canonicalEmail}`,
        ].join(" "),
      );
    }
  }
}

function createGeneratedNonexistentEmailPool(poolSize: number): string[] {
  const runId = randomUUID().replaceAll("-", "").slice(0, 12);

  return Array.from(
    {
      length: poolSize,
    },
    (_, index) =>
      ["timing-nonexistent", runId, index + 1].join("-") + "@example.com",
  );
}

function buildResendUrl(baseUrl: string, email: string): string {
  const url = new URL(ROUTES.RESEND_EMAIL, baseUrl);

  url.searchParams.set("purpose", "signup");

  url.searchParams.set("email", email);

  return url.toString();
}

async function prepareResendPage(
  page: Page,
  baseUrl: string,
  email: string,
): Promise<void> {
  await page.goto(buildResendUrl(baseUrl, email), {
    waitUntil: "domcontentloaded",
  });

  const emailInput = page.locator("#resend-email-email");

  await expect(emailInput).toBeVisible();

  await emailInput.fill(email);

  await expect(
    page.getByRole("button", {
      name: "인증 번호 다시 받기",
    }),
  ).toBeEnabled();
}

function isExpectedVerifyOtpUrl(url: URL, email: string): boolean {
  return (
    url.pathname === ROUTES.VERIFY_OTP &&
    url.searchParams.get("purpose") === "signup" &&
    url.searchParams.get("email")?.toLowerCase() === email.toLowerCase()
  );
}

async function measureResend(
  page: Page,
  input: {
    email: string;
    sampleNumber: number;
    pairNumber: number;
    group: SampleGroup;
    accountSlot: number;
  },
): Promise<TimingSample> {
  const submitButton = page.getByRole("button", {
    name: "인증 번호 다시 받기",
  });

  const startedAtEpochMs = Date.now();

  const startedAtIso = new Date(startedAtEpochMs).toISOString();

  const startedAt = performance.now();

  try {
    await Promise.all([
      page.waitForURL((url) => isExpectedVerifyOtpUrl(url, input.email), {
        timeout: SAMPLE_TIMEOUT_MS,
      }),

      submitButton.click(),
    ]);

    const finishedAtEpochMs = Date.now();

    return {
      sampleNumber: input.sampleNumber,

      pairNumber: input.pairNumber,

      group: input.group,

      accountSlot: input.accountSlot,

      redirectObserved: true,

      elapsedMs: roundMs(performance.now() - startedAt),

      startedAtIso,

      finishedAtIso: new Date(finishedAtEpochMs).toISOString(),

      startedAtEpochMs,
      finishedAtEpochMs,

      internalOutcomeVerification:
        input.group === "existing" ? "pending" : "not_applicable",

      failureReason: null,
    };
  } catch (error) {
    const finishedAtEpochMs = Date.now();

    return {
      sampleNumber: input.sampleNumber,

      pairNumber: input.pairNumber,

      group: input.group,

      accountSlot: input.accountSlot,

      redirectObserved: false,

      elapsedMs: roundMs(performance.now() - startedAt),

      startedAtIso,

      finishedAtIso: new Date(finishedAtEpochMs).toISOString(),

      startedAtEpochMs,
      finishedAtEpochMs,

      internalOutcomeVerification:
        input.group === "existing" ? "pending" : "not_applicable",

      failureReason:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "UnknownError",
    };
  }
}

function sanitizeTimestampForFilename(timestamp: string): string {
  return timestamp.replace(/[:.]/g, "-");
}

function printLine(message = ""): void {
  process.stdout.write(`${message}\n`);
}

test.describe("Signup Resend timing diagnostic", () => {
  test.skip(
    process.env[MANUAL_RUN_ENV] !== "1",
    "Manual timing diagnostic only.",
  );

  test("existing / nonexistent response timing distribution", async ({
    browser,
  }, testInfo) => {
    const runId = randomUUID();

    const baseUrl = normalizeBaseUrl(
      process.env.AUTH_TIMING_BASE_URL ?? DEFAULT_BASE_URL,
    );

    /**
     * Production URL 차단은 모든 실제 요청보다 먼저 수행한다.
     */
    const environmentLabel = deriveEnvironmentLabel(baseUrl);

    const previewCommit =
      process.env.AUTH_TIMING_PREVIEW_COMMIT?.trim() || null;

    const previewPolicyAlignmentConfirmed =
      process.env.AUTH_TIMING_POLICY_ALIGNMENT_CONFIRMED === "1";

    if (environmentLabel === "preview") {
      if (!previewCommit) {
        throw new Error(
          [
            "AUTH_TIMING_PREVIEW_COMMIT is required",
            "for Preview timing diagnostics.",
            "Confirm the deployed commit before measuring.",
          ].join(" "),
        );
      }

      if (!previewPolicyAlignmentConfirmed) {
        throw new Error(
          [
            "Preview policy alignment has not been confirmed.",
            "Verify that the Preview uses the same",
            "Signup Resend contract and OTP Issue",
            "Rate Limit policy as this harness.",
            "Then set",
            "AUTH_TIMING_POLICY_ALIGNMENT_CONFIRMED=1.",
          ].join(" "),
        );
      }
    }

    const sampleCount = parsePositiveInteger(
      process.env.AUTH_TIMING_SAMPLE_COUNT,

      DEFAULT_SAMPLE_COUNT,

      "AUTH_TIMING_SAMPLE_COUNT",
    );

    if (sampleCount > OTP_ISSUE_IP_LONG_LIMIT) {
      throw new Error(
        [
          "AUTH_TIMING_SAMPLE_COUNT exceeds",
          "the OTP Issue IP long limit.",
          `sampleCount=${sampleCount}`,
          `limit=${OTP_ISSUE_IP_LONG_LIMIT}`,
        ].join(" "),
      );
    }

    const existingRequestGapMs = parsePositiveInteger(
      process.env.AUTH_TIMING_EXISTING_REQUEST_GAP_MS,

      DEFAULT_EXISTING_REQUEST_GAP_MS,

      "AUTH_TIMING_EXISTING_REQUEST_GAP_MS",
    );

    if (existingRequestGapMs < MIN_EXISTING_REQUEST_GAP_MS) {
      throw new Error(
        [
          "AUTH_TIMING_EXISTING_REQUEST_GAP_MS",
          `must be at least ${MIN_EXISTING_REQUEST_GAP_MS}.`,
        ].join(" "),
      );
    }

    const configuredExistingEmails = parseEmailList(
      process.env.AUTH_TIMING_EXISTING_EMAILS,
    );

    if (configuredExistingEmails.length === 0) {
      throw new Error(
        [
          "AUTH_TIMING_EXISTING_EMAILS is required.",
          "Provide controlled test accounts",
          "whose existence has been verified before the run.",
        ].join(" "),
      );
    }

    const existingEmails = configuredExistingEmails.slice(
      0,
      Math.min(configuredExistingEmails.length, sampleCount),
    );

    const existingCanonicalEmails = assertCanonicalUnique(
      existingEmails,
      "AUTH_TIMING_EXISTING_EMAILS",
    );

    const poolSize = existingEmails.length;

    const maxSamplesPerExistingAccount = Math.ceil(sampleCount / poolSize);

    if (maxSamplesPerExistingAccount > OTP_ISSUE_EMAIL_SUCCESS_LIMIT) {
      throw new Error(
        [
          "Not enough existing test accounts.",
          `sampleCount=${sampleCount}`,
          `poolSize=${poolSize}`,
          `maxSamplesPerAccount=${maxSamplesPerExistingAccount}`,
          `emailSuccessLimit=${OTP_ISSUE_EMAIL_SUCCESS_LIMIT}`,
        ].join(" "),
      );
    }

    const accountIsReused = sampleCount > poolSize;

    const minimumSameAccountReuseIntervalMs = accountIsReused
      ? poolSize * existingRequestGapMs
      : null;

    if (
      minimumSameAccountReuseIntervalMs !== null &&
      minimumSameAccountReuseIntervalMs < OTP_ISSUE_COOLDOWN_MS
    ) {
      throw new Error(
        [
          "Existing account reuse interval is shorter",
          "than OTP Issue cooldown.",
          `poolSize=${poolSize}`,
          `gapMs=${existingRequestGapMs}`,
          `minimumReuseMs=${minimumSameAccountReuseIntervalMs}`,
          `cooldownMs=${OTP_ISSUE_COOLDOWN_MS}`,
        ].join(" "),
      );
    }

    const configuredNonexistentEmails = parseEmailList(
      process.env.AUTH_TIMING_NONEXISTENT_EMAILS,
    );

    const usesConfiguredNonexistentPool =
      configuredNonexistentEmails.length > 0;

    /**
     * 수동 nonexistent pool은 harness가 DB를 조회해서
     * 실제 미존재 여부를 증명하지 않는다.
     *
     * 따라서 사용자가 사전에 미존재를 확인했다는 명시적 guard가 필요하다.
     */
    const configuredNonexistentAbsenceConfirmed =
      process.env.AUTH_TIMING_NONEXISTENT_ABSENCE_CONFIRMED === "1";

    if (
      usesConfiguredNonexistentPool &&
      !configuredNonexistentAbsenceConfirmed
    ) {
      throw new Error(
        [
          "Configured nonexistent accounts require",
          "an explicit absence confirmation.",
          "Verify that all configured addresses",
          "do not exist in the target environment,",
          "then set",
          "AUTH_TIMING_NONEXISTENT_ABSENCE_CONFIRMED=1.",
        ].join(" "),
      );
    }

    if (
      usesConfiguredNonexistentPool &&
      configuredNonexistentEmails.length < poolSize
    ) {
      throw new Error(
        [
          "AUTH_TIMING_NONEXISTENT_EMAILS",
          `must contain at least ${poolSize} emails.`,
        ].join(" "),
      );
    }

    const nonexistentEmails = usesConfiguredNonexistentPool
      ? configuredNonexistentEmails.slice(0, poolSize)
      : createGeneratedNonexistentEmailPool(poolSize);

    const nonexistentCanonicalEmails = assertCanonicalUnique(
      nonexistentEmails,
      "AUTH_TIMING_NONEXISTENT_EMAILS",
    );

    assertNoCanonicalIntersection(
      existingCanonicalEmails,
      nonexistentCanonicalEmails,
    );

    const storageStatePath = process.env.AUTH_TIMING_STORAGE_STATE?.trim();

    const overallTimeoutMs = Math.max(
      10 * 60 * 1000,

      sampleCount * (existingRequestGapMs + 15_000) + 2 * 60 * 1000,
    );

    test.setTimeout(overallTimeoutMs);

    const context = await browser.newContext({
      baseURL: baseUrl,

      ...(storageStatePath
        ? {
            storageState: storageStatePath,
          }
        : {}),
    });

    const page = await context.newPage();

    const samples: TimingSample[] = [];

    let executionError: unknown = null;

    let globalSampleNumber = 0;

    const generatedAt = new Date().toISOString();

    const filename = [
      "auth-resend-timing",
      environmentLabel,
      sanitizeTimestampForFilename(generatedAt),
      `${runId.slice(0, 8)}.json`,
    ].join("-");

    const outputPath = resolve(RESULT_DIRECTORY, filename);

    printLine();

    printLine("=== Signup Resend Timing Diagnostic ===");

    printLine(`runId: ${runId}`);

    printLine(`environment: ${environmentLabel}`);

    printLine(`baseURL: ${baseUrl}`);

    if (environmentLabel === "preview") {
      printLine(`preview commit: ${previewCommit}`);

      printLine("preview policy alignment: confirmed");
    }

    printLine(`samples per group: ${sampleCount}`);

    printLine(`existing pool: ${existingEmails.length}`);

    printLine(`nonexistent pool: ${nonexistentEmails.length}`);

    printLine(
      `nonexistent pool source: ${
        usesConfiguredNonexistentPool ? "configured" : "generated"
      }`,
    );

    if (usesConfiguredNonexistentPool) {
      printLine("configured nonexistent absence: confirmed");
    }

    printLine(`pair gap: ${existingRequestGapMs}ms`);

    if (minimumSameAccountReuseIntervalMs !== null) {
      printLine(
        `minimum same-account reuse: ${minimumSameAccountReuseIntervalMs}ms`,
      );
    }

    printLine();

    try {
      for (let pairIndex = 0; pairIndex < sampleCount; pairIndex += 1) {
        const poolIndex = pairIndex % poolSize;

        const existingEmail = existingEmails[poolIndex];

        const nonexistentEmail = nonexistentEmails[poolIndex];

        if (existingEmail === undefined || nonexistentEmail === undefined) {
          throw new Error(
            [
              "Timing account pool lookup failed.",
              `poolIndex=${poolIndex}`,
              `existingPoolSize=${existingEmails.length}`,
              `nonexistentPoolSize=${nonexistentEmails.length}`,
            ].join(" "),
          );
        }

        const accountSlot = poolIndex + 1;

        const pair =
          pairIndex % 2 === 0
            ? [
                {
                  group: "existing" as const,

                  email: existingEmail,
                },

                {
                  group: "nonexistent" as const,

                  email: nonexistentEmail,
                },
              ]
            : [
                {
                  group: "nonexistent" as const,

                  email: nonexistentEmail,
                },

                {
                  group: "existing" as const,

                  email: existingEmail,
                },
              ];

        for (const target of pair) {
          globalSampleNumber += 1;

          await prepareResendPage(page, baseUrl, target.email);

          const sample = await measureResend(page, {
            email: target.email,

            sampleNumber: globalSampleNumber,

            pairNumber: pairIndex + 1,

            group: target.group,

            accountSlot,
          });

          samples.push(sample);

          printLine(
            [
              `[${sample.group}]`,

              `sample=${sample.sampleNumber}`,

              `pair=${sample.pairNumber}`,

              `slot=${sample.accountSlot}`,

              `elapsed=${sample.elapsedMs}ms`,

              sample.redirectObserved
                ? "redirect-observed"
                : "REDIRECT-NOT-OBSERVED",

              sample.group === "existing" ? "internal-outcome=pending" : "",
            ]
              .filter(Boolean)
              .join(" "),
          );

          if (!sample.redirectObserved) {
            throw new Error(
              [
                "Timing measurement became incomplete.",

                `sample=${sample.sampleNumber}`,

                `group=${sample.group}`,

                `reason=${sample.failureReason}`,
              ].join(" "),
            );
          }
        }

        if (pairIndex < sampleCount - 1) {
          await page.waitForTimeout(existingRequestGapMs);
        }
      }
    } catch (error) {
      executionError = error;
    } finally {
      const completedMeasurement =
        executionError === null && samples.length === sampleCount * 2;

      const existingElapsed = completedMeasurement
        ? samples
            .filter((sample) => sample.group === "existing")
            .map((sample) => sample.elapsedMs)
        : [];

      const nonexistentElapsed = completedMeasurement
        ? samples
            .filter((sample) => sample.group === "nonexistent")
            .map((sample) => sample.elapsedMs)
        : [];

      const existingStats = summarize(existingElapsed);

      const nonexistentStats = summarize(nonexistentElapsed);

      const rangeOverlap = calculateRangeOverlap(
        existingStats,
        nonexistentStats,
      );

      const result: TimingResult = {
        runId,
        generatedAt,

        interpretationStatus: completedMeasurement
          ? "pending_internal_outcome_verification"
          : "measurement_incomplete",

        environment: {
          label: environmentLabel,

          baseUrl,

          sampleCountPerGroup: sampleCount,

          existingAccountPoolSize: existingEmails.length,

          nonexistentAccountPoolSize: nonexistentEmails.length,

          nonexistentPoolSource: usesConfiguredNonexistentPool
            ? "configured"
            : "generated",

          configuredNonexistentAbsenceConfirmed: usesConfiguredNonexistentPool
            ? configuredNonexistentAbsenceConfirmed
            : true,

          existingRequestGapMs,

          minimumSameAccountReuseIntervalMs,

          storageStateUsed: Boolean(storageStatePath),

          previewCommit,

          previewPolicyAlignmentConfirmed:
            environmentLabel === "preview"
              ? previewPolicyAlignmentConfirmed
              : true,
        },

        samples,

        summary: {
          existing: existingStats,

          nonexistent: nonexistentStats,

          medianDifferenceMs:
            existingStats && nonexistentStats
              ? roundMs(existingStats.medianMs - nonexistentStats.medianMs)
              : null,

          rangeOverlap,
        },

        internalOutcomeVerification: {
          required: true,

          status: "pending",

          existingAccountPrecondition:
            "Every existing pool entry must be a controlled test account whose existence was verified before the run.",

          nonexistentAccountPrecondition: usesConfiguredNonexistentPool
            ? "Every configured nonexistent pool entry must be verified as absent in the target environment before the run."
            : "The harness generated a run-scoped example.com pool.",

          requiredCombination: [
            "known-existing controlled test account",
            "AUTH_RESEND_EMAIL_COMPLETED in the sample time window",
            "no AUTH_RESEND_EMAIL_RATE_LIMITED in the same sample time window",
            "no AUTH_RESEND_EMAIL_FAILED in the same sample time window",
          ],

          disqualifyingEvents: [
            "AUTH_RESEND_EMAIL_RATE_LIMITED",
            "AUTH_RESEND_EMAIL_FAILED",
          ],

          note: "AUTH_RESEND_EMAIL_COMPLETED alone does not prove Provider execution because the nonexistent short-circuit also emits the completed event. Do not interpret the existing timing distribution until all known-existing samples satisfy the full verification combination.",
        },
      };

      await mkdir(RESULT_DIRECTORY, {
        recursive: true,
      });

      await writeFile(
        outputPath,

        JSON.stringify(result, null, 2),

        "utf8",
      );

      printLine();

      printLine("=== Summary ===");

      printLine(`existing: ${JSON.stringify(existingStats)}`);

      printLine(`nonexistent: ${JSON.stringify(nonexistentStats)}`);

      printLine(`range overlap: ${JSON.stringify(rangeOverlap)}`);

      printLine(`interpretation: ${result.interpretationStatus}`);

      printLine("existing verification required:");

      printLine("known-existing + COMPLETED + no RATE_LIMITED + no FAILED");

      printLine(`result: ${outputPath}`);

      printLine();

      await context.close();

      await testInfo.attach("auth-resend-timing", {
        path: outputPath,

        contentType: "application/json",
      });
    }

    if (executionError) {
      throw executionError;
    }

    expect(
      samples.filter(
        (sample) => sample.group === "existing" && sample.redirectObserved,
      ),
    ).toHaveLength(sampleCount);

    expect(
      samples.filter(
        (sample) => sample.group === "nonexistent" && sample.redirectObserved,
      ),
    ).toHaveLength(sampleCount);
  });
});
