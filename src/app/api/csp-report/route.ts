/**
 * CSP 위반 리포트 수신 엔드포인트
 *
 * 두 가지 포맷을 모두 수신한다:
 * - report-uri 포맷 (Firefox/Safari, legacy Chromium):
 *   Content-Type: application/csp-report
 *   Body: { "csp-report": { ... } }
 * - report-to 포맷 (Chromium 96+, Reporting API):
 *   Content-Type: application/reports+json
 *   Body: [{ "type": "csp-violation", "body": { ... }, ... }, ...]
 *
 * 두 포맷을 공통 스키마로 정규화하여 로깅한다. 추후 Sentry 등 로그 수집 도구
 * 연동 시 단일 진입점에서 처리할 수 있도록 한다.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

type NormalizedReport = {
  source: "report-uri" | "report-to";
  violatedDirective: string | undefined;
  effectiveDirective: string | undefined;
  blockedUri: string | undefined;
  documentUri: string | undefined;
  disposition: string | undefined;
  statusCode: number | undefined;
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(
  source: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function pickNumber(
  source: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

function normalizeReportUriBody(body: unknown): NormalizedReport | null {
  const record = asRecord(body);
  if (!record) return null;
  const report = asRecord(record["csp-report"]);
  if (!report) return null;
  return {
    source: "report-uri",
    violatedDirective: pickString(report, "violated-directive"),
    effectiveDirective: pickString(report, "effective-directive"),
    blockedUri: pickString(report, "blocked-uri"),
    documentUri: pickString(report, "document-uri"),
    disposition: pickString(report, "disposition"),
    statusCode: pickNumber(report, "status-code"),
    raw: report,
  };
}

function normalizeReportToEntry(entry: unknown): NormalizedReport | null {
  const record = asRecord(entry);
  if (!record) return null;
  if (record.type !== "csp-violation") return null;
  const body = asRecord(record.body);
  if (!body) return null;
  return {
    source: "report-to",
    violatedDirective: pickString(
      body,
      "violatedDirective",
      "effectiveDirective",
    ),
    effectiveDirective: pickString(body, "effectiveDirective"),
    blockedUri: pickString(body, "blockedURL", "blockedURI"),
    documentUri: pickString(body, "documentURL", "documentURI"),
    disposition: pickString(body, "disposition"),
    statusCode: pickNumber(body, "statusCode"),
    raw: body,
  };
}

function normalize(payload: unknown): NormalizedReport[] {
  if (Array.isArray(payload)) {
    return payload
      .map(normalizeReportToEntry)
      .filter((r): r is NormalizedReport => r !== null);
  }
  const single = normalizeReportUriBody(payload);
  return single ? [single] : [];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const reports = normalize(payload);
    if (reports.length === 0) {
      // 알 수 없는 포맷은 원본을 그대로 남겨 추후 분석 가능하게 한다.
      console.warn("[CSP-VIOLATION] unknown format", JSON.stringify(payload));
    } else {
      for (const report of reports) {
        console.warn("[CSP-VIOLATION]", JSON.stringify(report));
      }
    }
  } catch {
    // malformed JSON은 무시
  }
  return new NextResponse(null, { status: 204 });
}
