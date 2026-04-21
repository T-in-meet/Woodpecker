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
 * spec 근거: auth-shared-spec.md §3.8 Redirect Validation
 */

/** 유효하지 않은 입력에 대한 기본 fallback 경로 */
const FALLBACK_PATH = "/mypage";

/**
 * 외부 입력 없이 정확히 일치해야 허용되는 경로 목록
 * spec §3.8 Exact Match 허용 경로
 */
const ALLOWED_EXACT_PATHS: readonly string[] = [
  "/mypage",
  "/notes",
  "/notes/new",
];

/**
 * 접두사 기반으로 차단되는 경로 목록
 * spec §3.8 차단 경로
 */
const BLOCKED_PATH_PREFIXES: readonly string[] = ["/api/"];

/**
 * 완전 일치 기반으로 차단되는 경로 목록
 * spec §3.8 차단 경로
 */
const BLOCKED_EXACT_PATHS: readonly string[] = [
  "/login",
  "/signup",
  "/verify-email",
  "/privacy",
  "/terms",
];

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

/**
 * 디코딩 전후 모두 적용되는 위험 패턴 정규식
 *
 * 다음을 차단한다:
 * - 역슬래시 (경로 우회 수단)
 * - 탭, 개행 등 제어 문자 (헤더 인젝션, 로그 위조 수단)
 * - query string (?) 및 fragment (#) 부가 요소
 * - protocol-relative (//) 형태 우회
 */
const DANGER_PATTERN = /[\\%\t\r\n?#]|^\/\//;

/**
 * percent-encoded 슬래시 / 역슬래시 / 공백을 검출하는 정규식
 *
 * 디코딩 전 원본 문자열에 포함된 인코딩 우회를 선제 차단하기 위해 사용한다
 * - %2F → /
 * - %5C → \
 * - %20 → 공백 (제어 문자)
 * 대소문자를 구분하지 않아 %2f, %5c 형태도 차단한다
 */
const ENCODED_DANGER_PATTERN = /%(?:2[fF]|5[cC]|20)/;

/**
 * path traversal 패턴 검출 정규식
 *
 * 경로에 . 또는 .. 가 segment로 포함되는 경우를 차단한다
 * /./  /../  /. (끝)  /.. (끝) 형태를 모두 차단
 */
const PATH_TRAVERSAL_PATTERN = /(?:^|\/)(\.\.?)(?:\/|$)/;

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
 * 8. 유효하면 정규화 경로 반환, 실패하면 /mypage 반환
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

  // protocol-relative (//) 및 제어 문자, query string, fragment 등 위험 패턴 선제 차단
  if (DANGER_PATTERN.test(trimmed)) {
    return FALLBACK_PATH;
  }

  // percent-encoded 슬래시, 역슬래시, 공백을 디코딩 전에 차단
  // 디코딩 후 위험 패턴이 드러나는 우회를 방지하기 위해 원본 기준으로 먼저 검사한다
  if (ENCODED_DANGER_PATTERN.test(trimmed)) {
    return FALLBACK_PATH;
  }

  // path traversal 패턴을 디코딩 전에 먼저 검사
  if (PATH_TRAVERSAL_PATTERN.test(trimmed)) {
    return FALLBACK_PATH;
  }

  // URL 디코딩을 1회만 수행
  // 실패 시 잘못된 percent-encoding으로 간주하고 fallback
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return FALLBACK_PATH;
  }

  // 디코딩 후에도 동일한 위험 패턴을 재검사
  // 인코딩 우회로 디코딩 후에 위험 패턴이 드러나는 경우를 차단한다
  if (DANGER_PATTERN.test(decoded)) {
    return FALLBACK_PATH;
  }

  if (PATH_TRAVERSAL_PATTERN.test(decoded)) {
    return FALLBACK_PATH;
  }

  // 디코딩된 경로에 역슬래시 또는 인코딩 우회 패턴이 포함되는지 재검사
  if (/[\\]/.test(decoded)) {
    return FALLBACK_PATH;
  }

  // 정책상 차단된 경로 — 완전 일치 기준
  if (BLOCKED_EXACT_PATHS.includes(trimmed)) {
    return FALLBACK_PATH;
  }

  // 정책상 차단된 경로 — 접두사 기준 (/api/ 하위 모든 경로)
  if (BLOCKED_PATH_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return FALLBACK_PATH;
  }

  // exact match 허용 경로 판정
  if (ALLOWED_EXACT_PATHS.includes(trimmed)) {
    return trimmed;
  }

  // dynamic match — /notes/[noteId] 패턴 판정
  const dynamicMatch = NOTES_DYNAMIC_PATTERN.exec(trimmed);
  if (dynamicMatch) {
    const noteId = dynamicMatch[1];

    // noteId가 . 또는 .. 이면 path traversal로 간주하여 차단
    // 정규식이 이미 슬래시를 배제하지만, 명시적으로 재검증하여 안전성을 보장한다
    if (noteId === "." || noteId === "..") {
      return FALLBACK_PATH;
    }

    return trimmed;
  }

  // 어떤 허용 규칙에도 해당하지 않으면 fallback
  return FALLBACK_PATH;
}
