/**
 * auth 흐름에서 사용되는 redirect 경로 검증의 단일 진입점
 *
 * 역할:
 * - 허용된 경로인지 판단하고, 안전한 경로 문자열을 반환한다
 * - 유효하지 않은 입력에서는 예외 없이 기본 경로(/mypage)로 fallback한다
 *
 * 사용 대상:
 * - login route (redirect query parameter 검증)
 * - 기타 redirect query를 사용하는 auth 흐름
 *
 * 사용하지 않는 대상:
 * - callback (서버 고정 경로 반환 모델을 사용하므로 이 유틸 불필요)
 *
 */

/** 유효하지 않은 입력에 대한 기본 fallback 경로 */
const FALLBACK_PATH = "/mypage";

/**
 * 외부 입력 없이 정확히 일치해야 허용되는 경로 집합
 */
const ALLOWED_EXACT_PATHS: ReadonlySet<string> = new Set([
  "/mypage",
  "/notes",
  "/notes/new",
  "/notes/today",
  "/note-chats",
]);

const ALLOWED_QUERY_KEYS_BY_PATH: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  "/mypage": new Set(["profile_nickname", "section", "tab"]),
  "/notes": new Set(["page", "q", "view"]),
  "/notes/today": new Set(["page"]),
};

/**
 * 완전 일치 기준으로 차단되는 경로 집합
 */
const BLOCKED_EXACT_PATHS: ReadonlySet<string> = new Set([
  "/login",
  "/signup",
  "/resend-email",
  "/privacy",
  "/terms",
]);

/**
 * /notes/[noteId] dynamic match를 수행하는 정규식
 *
 * 조건:
 * - /notes/ 뒤에 정확히 하나의 segment만 허용
 * - segment는 비어 있으면 안 됨
 * - . 또는 .. 는 path traversal이므로 차단
 * - 추가 하위 경로 불허 (슬래시 포함 불가)
 *
 * [^/]+ 패턴이 슬래시를 포함하지 않으므로 하나의 segment만 허용된다
 */
const NOTES_DYNAMIC_PATTERN = /^\/notes\/([^/]+)$/;
const NOTE_REVIEW_DYNAMIC_PATTERN = /^\/notes\/([^/]+)\/review$/;
const NOTE_CHAT_DYNAMIC_PATTERN = /^\/note-chats\/([^/]+)$/;

/**
 * Supabase UUID v4 형식을 검증하는 정규식
 *
 * 조건:
 * - 8-4-4-4-12 형식의 하이픈 포함 UUID
 * - version은 4로 고정 (UUID v4)
 * - variant는 RFC 4122 규격에 따라 8, 9, a, b 중 하나
 * - 대소문자 hex 모두 허용
 *
 * 목적:
 * - /notes/[noteId] dynamic match에서 noteId를 UUID v4로 강제하여
 *   임의 문자열, 숫자, '.', '..' 등의 비정상 경로를 차단한다
 */
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 디코딩 전 원본 문자열에서 바로 드러나는 위험 문자를 검출한다.
 * - 역슬래시
 * - 제어 문자
 * - fragment
 * - protocol-relative (//)
 */
const RAW_PATH_DANGER_PATTERN = /[\\ \t\r\n#]|^\/\//;

/**
 * 디코딩 전 차단해야 하는 위험한 percent-encoding 값을 검출한다.
 * - slash / backslash / dot 우회
 * - 공백 / 제어 문자 우회
 */
const ENCODED_DANGER_PATTERN = /%(2f|5c|2e|09|0a|0d|20)/i;

/**
 * 1회 디코딩 후 문자열에서 다시 확인해야 하는 위험 문자를 검출한다.
 * - 역슬래시
 * - 제어 문자
 * - path에 섞인 query / fragment 구분자
 */
const DECODED_PATH_DANGER_PATTERN = /[\\ \t\r\n?#]/;

/**
 * traversal segment 검출 정규식
 *
 * 경로에 . 또는 .. 가 segment로 포함되는 경우를 차단한다
 * /./  /../  /. (끝)  /.. (끝) 형태를 모두 차단
 */
const TRAVERSAL_SEGMENT_PATTERN = /(?:^|\/)(\.\.?)(?:\/|$)/;

/**
 * API 경로 차단 규칙
 *
 * redirect는 사용자 이동용 페이지 경로만 허용하며,
 * API endpoint 경로는 허용하지 않는다.
 *
 * 차단 대상:
 * - 정확히 "/api"
 * - 첫 번째 path segment가 "api"인 경우 ("/api/*")
 *
 * 주의:
 * - "/api-test", "/notes/api" 등은 API 경로가 아니므로 차단 대상이 아니다
 * - 반드시 decode 이후 문자열 기준으로 검사해야 한다
 *   (예: "/api%2Ftest" → decode 후 "/api/test" → 차단)
 */
function isApiPath(path: string): boolean {
  if (path === "/api") return true;
  if (path.startsWith("/api/")) return true;

  return false;
}

function hasValidDynamicIdMatch(path: string, pattern: RegExp): boolean {
  const match = pattern.exec(path);
  const id = match?.[1];

  return id !== undefined && UUID_V4_PATTERN.test(id);
}

function validatePath(path: string): string | null {
  if (BLOCKED_EXACT_PATHS.has(path) || isApiPath(path)) return null;
  if (ALLOWED_EXACT_PATHS.has(path)) return path;

  if (
    hasValidDynamicIdMatch(path, NOTES_DYNAMIC_PATTERN) ||
    hasValidDynamicIdMatch(path, NOTE_REVIEW_DYNAMIC_PATTERN) ||
    hasValidDynamicIdMatch(path, NOTE_CHAT_DYNAMIC_PATTERN)
  ) {
    return path;
  }

  return null;
}

function validateSearch(path: string, rawSearch: string): string {
  if (!rawSearch) return "";

  const allowedKeys = ALLOWED_QUERY_KEYS_BY_PATH[path];
  if (!allowedKeys || rawSearch.length > 2_000) return "";

  let decodedSearch: string;
  try {
    decodedSearch = decodeURIComponent(rawSearch.replaceAll("+", "%20"));
  } catch {
    return "";
  }

  if (/[\\\t\r\n#]/.test(decodedSearch)) return "";

  const searchParams = new URLSearchParams(rawSearch);
  const seenKeys = new Set<string>();

  for (const key of searchParams.keys()) {
    if (!allowedKeys.has(key) || seenKeys.has(key)) return "";
    seenKeys.add(key);
  }

  const normalizedSearch = searchParams.toString();
  return normalizedSearch ? `?${normalizedSearch}` : "";
}

/**
 * redirect 경로 검증 함수
 *
 * 입력을 다음 순서로 처리한다:
 * 1. 타입/null/undefined/빈 문자열 체크
 * 2. trim
 * 3. 디코딩 전 위험 패턴 검사
 * 4. URL 디코딩 1회 (try/catch로 실패 시 fallback)
 * 5. 디코딩 후 위험 패턴 재검사
 * 6. 차단 경로 체크
 * 7. exact match 또는 dynamic match 판정
 * 8. 경로별로 허용된 query만 보존
 * 9. 유효하면 정규화 경로 반환, 실패하면 /mypage 반환
 *
 * 이 함수는 어떤 입력에도 예외를 발생시키지 않는다
 *
 * @param input - 검증할 redirect 경로 (외부 입력이므로 unknown 타입)
 * @returns 안전한 경로 문자열 (유효하면 해당 경로, 아니면 /mypage)
 */
export function validateRedirectPath(input: unknown): string {
  // 문자열이 아닌 입력은 즉시 fallback
  // undefined, null, 숫자, 객체 등을 모두 포함한다
  if (typeof input !== "string") {
    return FALLBACK_PATH;
  }

  const trimmed = input.trim();

  // trim 후 빈 문자열이면 fallback
  if (trimmed.length === 0) {
    return FALLBACK_PATH;
  }

  // /로 시작하지 않으면 앱 내부 상대경로가 아니므로 차단
  // 절대 URL (https://...), scheme 포함 값 (javascript:...)도 이 단계에서 차단된다
  if (!trimmed.startsWith("/")) {
    return FALLBACK_PATH;
  }

  const queryIndex = trimmed.indexOf("?");
  const rawPath = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
  const rawSearch = queryIndex === -1 ? "" : trimmed.slice(queryIndex + 1);

  // protocol-relative (//), 제어 문자, fragment 등 위험 패턴 선제 차단
  if (RAW_PATH_DANGER_PATTERN.test(rawPath) || trimmed.includes("#")) {
    return FALLBACK_PATH;
  }

  // percent-encoded 슬래시, 역슬래시, 공백을 디코딩 전에 차단
  // 디코딩 후 위험 패턴이 드러나는 우회를 방지하기 위해 원본 기준으로 먼저 검사한다
  if (ENCODED_DANGER_PATTERN.test(rawPath)) {
    return FALLBACK_PATH;
  }

  // path traversal 패턴을 디코딩 전에 먼저 검사
  if (TRAVERSAL_SEGMENT_PATTERN.test(rawPath)) {
    return FALLBACK_PATH;
  }

  // URL 디코딩을 1회만 수행
  // 실패 시 잘못된 percent-encoding으로 간주하고 fallback
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return FALLBACK_PATH;
  }

  // 디코딩 후 문자열 기준으로 위험 패턴을 재검사한다
  // - 인코딩을 통해 숨겨졌던 위험 문자가 디코딩 후 드러나는 경우를 차단한다
  // - 이 단계에서는 역슬래시, 제어 문자, query/fragment 등 "실제 문자열 기준 위험"만 검사한다
  // - percent(%) 자체는 추가 디코딩을 하지 않으므로 검사 대상이 아니다
  if (DECODED_PATH_DANGER_PATTERN.test(decoded)) {
    return FALLBACK_PATH;
  }

  if (TRAVERSAL_SEGMENT_PATTERN.test(decoded)) {
    return FALLBACK_PATH;
  }

  const validatedPath = validatePath(decoded);
  if (!validatedPath) return FALLBACK_PATH;

  return `${validatedPath}${validateSearch(validatedPath, rawSearch)}`;
}
