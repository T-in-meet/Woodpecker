/*
 * toLocaleDateString/toLocaleString은 옵션 객체를 넘기면 호출마다 Intl.DateTimeFormat을
 * 새로 만든다. 포맷터 생성이 실제 포맷보다 훨씬 비싸고, 관리자 테이블처럼 행마다
 * 두 번씩 부르는 화면이 있어 locale별로 포맷터를 캐싱한다.
 * locale은 호출자가 넘기는 소수의 고정값이라 캐시가 무한정 커지지 않는다.
 */
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(locale: string): Intl.DateTimeFormat {
  const cached = dateFormatterCache.get(locale);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
  dateFormatterCache.set(locale, formatter);
  return formatter;
}

function getDateTimeFormatter(locale: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatterCache.get(locale);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    // 관리자 테이블 등 세로로 늘어놓는 화면이 많아 시(hour)는 두 자리로 고정한다.
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
  dateTimeFormatterCache.set(locale, formatter);
  return formatter;
}

let shortDateKSTFormatter: Intl.DateTimeFormat | null = null;

function getShortDateKSTFormatter(): Intl.DateTimeFormat {
  shortDateKSTFormatter ??= new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
  return shortDateKSTFormatter;
}

// ko-KR 숫자 형식은 "2026. 8. 24."처럼 끝에 온점이 붙으므로 떼어낸다.
const TRAILING_DOT_PATTERN = /\.$/;

export function formatDate(date: Date | string, locale = "ko-KR"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return getDateFormatter(locale).format(d);
}

/*
 * ICU 78의 ko-KR은 hour+minute 조합에서 오전/오후를 "AM"/"PM"으로 축약한다
 * ("2026년 8월 29일 PM 05:18"). dayPeriod 옵션으로 되돌리려 하면 flexible day period가
 * 나와서 21시가 "밤 09:00", 자정이 "밤 12:00", 정오가 "정오 12:00"이 되어 오전/오후를
 * 판별할 수 없다. 그래서 옵션 대신 포맷 결과의 dayPeriod 조각만 교정한다.
 * 예전 ICU는 이미 "오전"/"오후"를 주므로 매핑에 없는 값은 그대로 둔다.
 */
const KO_DAY_PERIODS: Record<string, string> = {
  AM: "오전",
  PM: "오후",
};

export function formatDateTime(date: Date | string, locale = "ko-KR"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = getDateTimeFormatter(locale);

  if (!locale.startsWith("ko")) {
    return formatter.format(d);
  }

  return formatter
    .formatToParts(d)
    .map((part) =>
      part.type === "dayPeriod"
        ? (KO_DAY_PERIODS[part.value.toUpperCase()] ?? part.value)
        : part.value,
    )
    .join("");
}

/** "2026. 8. 24" 형태의 짧은 KST 날짜. 노트 카드처럼 폭이 좁아 긴 형식이 줄바꿈되는 곳에서 쓴다. */
export function formatShortDateKST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return getShortDateKSTFormatter()
    .format(d)
    .trim()
    .replace(TRAILING_DOT_PATTERN, "");
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDate(d);
}
