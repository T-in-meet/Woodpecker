import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { test } from "@playwright/test";

import {
  AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT,
  AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
  AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS,
  OTP_ISSUE_COOLDOWN_MS,
  OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
  OTP_ISSUE_EMAIL_SUCCESS_LIMIT,
  OTP_ISSUE_IP_LONG_LIMIT,
  OTP_ISSUE_IP_SHORT_LIMIT,
  OTP_ISSUE_IP_SHORT_WINDOW_MS,
} from "@/features/auth/lib/rate-limit/authRateLimitConstants";
import { canonicalizeEmail } from "@/features/auth/utils/canonicalizeEmail";

const DEFAULT_BASE_URL = "http://localhost:3000";
const PRODUCTION_HOSTNAME = "woodpecker-blue.vercel.app";

const MANUAL_RUN_ENV = "RUN_AUTH_SIGNUP_TIMING_DIAGNOSTIC";
const DEFAULT_SAMPLE_COUNT = 20;
const REQUESTS_PER_PAIR = 2;
const SAMPLE_TIMEOUT_MS = 45_000;

const RESULT_DIRECTORY = resolve(process.cwd(), ".cache", "auth-timing");

type TimingEnvironment = "local" | "preview";
type TimingGroup = "provider_allowed" | "local_precheck_blocked";

type TimingSample = {
  sampleNumber: number;
  pairNumber: number;
  group: TimingGroup;
  accountSlot: number;
  email: string;

  elapsedMs: number;
  status: number | null;
  publicCode: string | null;
  contentType: string | null;

  startedAtIso: string;
  finishedAtIso: string;
  startedAtEpochMs: number;
  finishedAtEpochMs: number;

  internalOutcomeVerification: "pending";
  failureReason: string | null;
};

type TimingStats = {
  count: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
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
    accountPoolSize: number;
    pairGapMs: number;
    minimumSameAccountReuseIntervalMs: number;
    storageStateUsed: boolean;
    previewCommit: string | null;
    previewPolicyAlignmentConfirmed: boolean;
  };

  samples: TimingSample[];

  summary: {
    providerAllowed: TimingStats | null;
    localPrecheckBlocked: TimingStats | null;
    medianDifferenceMs: number | null;
    midpointThresholdMs: number | null;
    fasterGroup: TimingGroup | null;
  };

  internalOutcomeVerification: {
    required: true;
    status: "pending";
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

  if (hostname === PRODUCTION_HOSTNAME) {
    throw new Error(
      "Production URL is not allowed for Auth timing diagnostics.",
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

  const median =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);

  return {
    count: sorted.length,
    medianMs: roundMs(median),
    p95Ms: roundMs(percentile95(sorted)),
    minMs: roundMs(minimum),
    maxMs: roundMs(maximum),
  };
}

function assertCanonicalUnique(emails: string[]): string[] {
  const canonicalEmails = emails.map(canonicalizeEmail);
  const seen = new Set<string>();

  for (const canonicalEmail of canonicalEmails) {
    if (seen.has(canonicalEmail)) {
      throw new Error(
        `AUTH_SIGNUP_TIMING_EXISTING_EMAILS contains duplicate canonical identity: ${canonicalEmail}`,
      );
    }

    seen.add(canonicalEmail);
  }

  return canonicalEmails;
}

function calculateMinimumPairGapMs(): number {
  const otpIpGap =
    Math.floor(OTP_ISSUE_IP_SHORT_WINDOW_MS / OTP_ISSUE_IP_SHORT_LIMIT) + 1;

  const authGlobalGap =
    Math.floor(
      (AUTH_GLOBAL_REQUEST_IP_SHORT_WINDOW_MS * REQUESTS_PER_PAIR) /
        AUTH_GLOBAL_REQUEST_IP_SHORT_LIMIT,
    ) + 1;

  return Math.max(otpIpGap, authGlobalGap);
}

function calculateRequiredPoolSize(
  sampleCount: number,
  pairGapMs: number,
): number {
  const cooldownPoolSize = Math.ceil(OTP_ISSUE_COOLDOWN_MS / pairGapMs);
  const successQuotaPoolSize = Math.ceil(
    sampleCount / OTP_ISSUE_EMAIL_SUCCESS_LIMIT,
  );
  const attemptQuotaPoolSize = Math.ceil(
    sampleCount / OTP_ISSUE_EMAIL_ATTEMPT_LIMIT,
  );

  return Math.max(
    1,
    cooldownPoolSize,
    successQuotaPoolSize,
    attemptQuotaPoolSize,
  );
}

function sanitizeTimestampForFilename(timestamp: string): string {
  return timestamp.replace(/[:.]/g, "-");
}

function printLine(message = ""): void {
  process.stdout.write(`${message}\n`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function buildPayload(email: string) {
  return {
    email,
    password: "timing-test-password",
    nickname: "timing-test",
    agreements: {
      termsOfService: true,
      privacyPolicyAcknowledged: true,
      age14OrOlder: true,
    },
  };
}

async function measureSignupRequest(
  requestContext: {
    post: (
      url: string,
      options: {
        data: unknown;
        timeout: number;
        failOnStatusCode: boolean;
      },
    ) => Promise<{
      status(): number;
      headers(): Record<string, string>;
      text(): Promise<string>;
    }>;
  },
  input: {
    url: string;
    email: string;
    sampleNumber: number;
    pairNumber: number;
    group: TimingGroup;
    accountSlot: number;
  },
): Promise<TimingSample> {
  const startedAtEpochMs = Date.now();
  const startedAtIso = new Date(startedAtEpochMs).toISOString();
  const startedAt = performance.now();

  try {
    const response = await requestContext.post(input.url, {
      data: buildPayload(input.email),
      timeout: SAMPLE_TIMEOUT_MS,
      failOnStatusCode: false,
    });

    const elapsedMs = roundMs(performance.now() - startedAt);
    const finishedAtEpochMs = Date.now();
    const text = await response.text();

    let publicCode: string | null = null;

    try {
      const body = JSON.parse(text) as { code?: unknown };

      publicCode = typeof body.code === "string" ? body.code : null;
    } catch {
      // Preview protection/auth failure 등 JSON이 아닌 응답은 아래 검증에서 실패로 기록한다.
    }

    const contentType = response.headers()["content-type"] ?? null;
    const status = response.status();

    const isExpectedPublicContract =
      status === 200 &&
      publicCode === "SIGNUP_SUCCESS" &&
      contentType?.includes("application/json") === true;

    return {
      sampleNumber: input.sampleNumber,
      pairNumber: input.pairNumber,
      group: input.group,
      accountSlot: input.accountSlot,
      email: input.email,

      elapsedMs,
      status,
      publicCode,
      contentType,

      startedAtIso,
      finishedAtIso: new Date(finishedAtEpochMs).toISOString(),
      startedAtEpochMs,
      finishedAtEpochMs,

      internalOutcomeVerification: "pending",
      failureReason: isExpectedPublicContract
        ? null
        : [
            "Unexpected public Signup contract.",
            `status=${status}`,
            `code=${publicCode ?? "null"}`,
            `contentType=${contentType ?? "null"}`,
          ].join(" "),
    };
  } catch (error) {
    const finishedAtEpochMs = Date.now();

    return {
      sampleNumber: input.sampleNumber,
      pairNumber: input.pairNumber,
      group: input.group,
      accountSlot: input.accountSlot,
      email: input.email,

      elapsedMs: roundMs(performance.now() - startedAt),
      status: null,
      publicCode: null,
      contentType: null,

      startedAtIso,
      finishedAtIso: new Date(finishedAtEpochMs).toISOString(),
      startedAtEpochMs,
      finishedAtEpochMs,

      internalOutcomeVerification: "pending",
      failureReason:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : "UnknownError",
    };
  }
}

test.describe("Signup POST timing diagnostic", () => {
  test.skip(
    process.env[MANUAL_RUN_ENV] !== "1",
    "Manual Signup POST timing diagnostic only.",
  );

  test("Provider-start allowed / immediate Local precheck blocked timing distribution", async ({
    browser,
  }, testInfo) => {
    const runId = randomUUID();

    const baseUrl = normalizeBaseUrl(
      process.env.AUTH_SIGNUP_TIMING_BASE_URL ?? DEFAULT_BASE_URL,
    );

    const environmentLabel = deriveEnvironmentLabel(baseUrl);

    const previewCommit =
      process.env.AUTH_SIGNUP_TIMING_PREVIEW_COMMIT?.trim() || null;

    const previewPolicyAlignmentConfirmed =
      process.env.AUTH_SIGNUP_TIMING_POLICY_ALIGNMENT_CONFIRMED === "1";

    if (environmentLabel === "preview") {
      if (!previewCommit) {
        throw new Error(
          "AUTH_SIGNUP_TIMING_PREVIEW_COMMIT is required for Preview timing diagnostics.",
        );
      }

      if (!previewPolicyAlignmentConfirmed) {
        throw new Error(
          "Set AUTH_SIGNUP_TIMING_POLICY_ALIGNMENT_CONFIRMED=1 after confirming the Preview commit/policy matches this harness.",
        );
      }
    }

    if (process.env.AUTH_SIGNUP_TIMING_EXISTING_ACCOUNTS_CONFIRMED !== "1") {
      throw new Error(
        "Set AUTH_SIGNUP_TIMING_EXISTING_ACCOUNTS_CONFIRMED=1 only after confirming every configured email already exists in the target environment.",
      );
    }

    const sampleCount = parsePositiveInteger(
      process.env.AUTH_SIGNUP_TIMING_SAMPLE_COUNT,
      DEFAULT_SAMPLE_COUNT,
      "AUTH_SIGNUP_TIMING_SAMPLE_COUNT",
    );

    if (sampleCount > OTP_ISSUE_IP_LONG_LIMIT) {
      throw new Error(
        `sampleCount=${sampleCount} exceeds OTP Issue IP long limit=${OTP_ISSUE_IP_LONG_LIMIT}.`,
      );
    }

    const totalRequests = sampleCount * REQUESTS_PER_PAIR;

    if (totalRequests > AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT) {
      throw new Error(
        `totalRequests=${totalRequests} exceeds Auth Global IP long limit=${AUTH_GLOBAL_REQUEST_IP_LONG_LIMIT}.`,
      );
    }

    const minimumPairGapMs = calculateMinimumPairGapMs();

    const pairGapMs = parsePositiveInteger(
      process.env.AUTH_SIGNUP_TIMING_PAIR_GAP_MS,
      minimumPairGapMs,
      "AUTH_SIGNUP_TIMING_PAIR_GAP_MS",
    );

    if (pairGapMs < minimumPairGapMs) {
      throw new Error(
        `AUTH_SIGNUP_TIMING_PAIR_GAP_MS must be at least ${minimumPairGapMs}.`,
      );
    }

    const configuredEmails = parseEmailList(
      process.env.AUTH_SIGNUP_TIMING_EXISTING_EMAILS,
    );

    if (configuredEmails.length === 0) {
      throw new Error(
        "AUTH_SIGNUP_TIMING_EXISTING_EMAILS must contain controlled existing test accounts.",
      );
    }

    assertCanonicalUnique(configuredEmails);

    const requiredPoolSize = calculateRequiredPoolSize(sampleCount, pairGapMs);

    if (configuredEmails.length < requiredPoolSize) {
      throw new Error(
        [
          "Not enough controlled existing accounts.",
          `configured=${configuredEmails.length}`,
          `required=${requiredPoolSize}`,
          "The requirement protects cooldown and per-email quotas from contaminating the measurement.",
        ].join(" "),
      );
    }

    const accountPool = configuredEmails.slice(0, requiredPoolSize);

    const minimumSameAccountReuseIntervalMs = accountPool.length * pairGapMs;

    if (minimumSameAccountReuseIntervalMs < OTP_ISSUE_COOLDOWN_MS) {
      throw new Error(
        [
          "Same-account reuse interval would be shorter than OTP Issue cooldown.",
          `reuse=${minimumSameAccountReuseIntervalMs}`,
          `cooldown=${OTP_ISSUE_COOLDOWN_MS}`,
        ].join(" "),
      );
    }

    const storageStatePath =
      process.env.AUTH_SIGNUP_TIMING_STORAGE_STATE?.trim();

    const overallTimeoutMs = Math.max(
      10 * 60 * 1000,
      sampleCount * (pairGapMs + SAMPLE_TIMEOUT_MS * 2) + 2 * 60 * 1000,
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

    const requestContext = context.request;
    const signupUrl = new URL("/api/auth/signup", baseUrl).toString();

    const samples: TimingSample[] = [];
    let executionError: unknown = null;
    let globalSampleNumber = 0;

    const generatedAt = new Date().toISOString();

    const filename = [
      "auth-signup-timing",
      environmentLabel,
      sanitizeTimestampForFilename(generatedAt),
      `${runId.slice(0, 8)}.json`,
    ].join("-");

    const outputPath = resolve(RESULT_DIRECTORY, filename);

    try {
      for (let pairIndex = 0; pairIndex < sampleCount; pairIndex += 1) {
        const accountSlot = pairIndex % accountPool.length;
        const email = accountPool[accountSlot];

        if (!email) {
          throw new Error(`Unable to resolve account slot ${accountSlot}.`);
        }

        globalSampleNumber += 1;

        const allowedSample = await measureSignupRequest(requestContext, {
          url: signupUrl,
          email,
          sampleNumber: globalSampleNumber,
          pairNumber: pairIndex + 1,
          group: "provider_allowed",
          accountSlot,
        });

        samples.push(allowedSample);

        if (allowedSample.failureReason) {
          throw new Error(
            `Pair ${pairIndex + 1} provider_allowed request failed public-contract validation: ${allowedSample.failureReason}`,
          );
        }

        globalSampleNumber += 1;

        const blockedSample = await measureSignupRequest(requestContext, {
          url: signupUrl,
          email,
          sampleNumber: globalSampleNumber,
          pairNumber: pairIndex + 1,
          group: "local_precheck_blocked",
          accountSlot,
        });

        samples.push(blockedSample);

        if (blockedSample.failureReason) {
          throw new Error(
            `Pair ${pairIndex + 1} local_precheck_blocked request failed public-contract validation: ${blockedSample.failureReason}`,
          );
        }

        if (pairIndex + 1 < sampleCount) {
          await sleep(pairGapMs);
        }
      }
    } catch (error) {
      executionError = error;
    } finally {
      const completedMeasurement =
        executionError === null && samples.length === sampleCount * 2;

      const providerAllowedElapsed = completedMeasurement
        ? samples
            .filter((sample) => sample.group === "provider_allowed")
            .map((sample) => sample.elapsedMs)
        : [];

      const localBlockedElapsed = completedMeasurement
        ? samples
            .filter((sample) => sample.group === "local_precheck_blocked")
            .map((sample) => sample.elapsedMs)
        : [];

      const providerAllowedStats = summarize(providerAllowedElapsed);
      const localBlockedStats = summarize(localBlockedElapsed);

      const medianDifferenceMs =
        providerAllowedStats && localBlockedStats
          ? roundMs(providerAllowedStats.medianMs - localBlockedStats.medianMs)
          : null;

      const midpointThresholdMs =
        providerAllowedStats && localBlockedStats
          ? roundMs(
              (providerAllowedStats.medianMs + localBlockedStats.medianMs) / 2,
            )
          : null;

      const fasterGroup: TimingGroup | null =
        providerAllowedStats && localBlockedStats
          ? providerAllowedStats.medianMs < localBlockedStats.medianMs
            ? "provider_allowed"
            : providerAllowedStats.medianMs > localBlockedStats.medianMs
              ? "local_precheck_blocked"
              : null
          : null;

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
          accountPoolSize: accountPool.length,
          pairGapMs,
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
          providerAllowed: providerAllowedStats,
          localPrecheckBlocked: localBlockedStats,
          medianDifferenceMs,
          midpointThresholdMs,
          fasterGroup,
        },

        internalOutcomeVerification: {
          required: true,
          status: "pending",
          requiredCombination: [
            "Every provider_allowed sample: controlled existing account + actual OTP Issue Provider-start path confirmed in structured logs.",
            "Every local_precheck_blocked sample: AUTH_RATE_LIMIT_BLOCKED with OTP Issue Local RL reason confirmed in the matching time window.",
            "No Auth Global block, profile_lookup failure, auth_user_lookup failure, Provider failure, delivery failure, or unexpected internal failure contaminates the run.",
          ],
          disqualifyingEvents: [
            "AUTH_GLOBAL_IP_LIMIT",
            "profile_lookup failure",
            "auth_user_lookup failure",
            "Provider 429/system failure",
            "Email delivery failure",
            "unexpected internal failure",
          ],
          note: "Both public responses are intentionally SIGNUP_SUCCESS. Do not interpret the timing distribution until structured logs confirm that the first request in every pair actually reached Provider-start and the second request was blocked by Local OTP Issue precheck. A later independent run must reuse this run's median midpoint threshold when applying the predeclared 80% classification rule.",
        },
      };

      await mkdir(RESULT_DIRECTORY, {
        recursive: true,
      });

      await writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");

      printLine();
      printLine("=== Signup POST Timing Summary ===");
      printLine(`provider_allowed: ${JSON.stringify(providerAllowedStats)}`);
      printLine(`local_precheck_blocked: ${JSON.stringify(localBlockedStats)}`);
      printLine(`median difference: ${medianDifferenceMs}`);
      printLine(`midpoint threshold: ${midpointThresholdMs}`);
      printLine(`faster group: ${fasterGroup}`);
      printLine(`interpretation: ${result.interpretationStatus}`);
      printLine(`result: ${outputPath}`);
      printLine();

      await context.close();

      await testInfo.attach("auth-signup-timing", {
        path: outputPath,
        contentType: "application/json",
      });
    }

    if (executionError) {
      throw executionError;
    }
  });
});
