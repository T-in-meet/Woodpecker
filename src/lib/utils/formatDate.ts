export function formatDate(date: Date | string, locale = "ko-KR"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
}

export function formatDateTime(date: Date | string, locale = "ko-KR"): string {
  const d = typeof date === "string" ? new Date(date) : date;

  // ICU 78의 ko-KR은 hour+minute 조합에서 오전/오후를 "AM"/"PM"으로 축약한다
  // ("2026년 8월 29일 PM 05:18"). "오후"를 얻으려면 dayPeriod를 명시해야 하는데,
  // 이 옵션은 en 계열에서 "in the morning" 같은 flexible day period가 되므로
  // 한국어 로케일에서만 붙인다. dayPeriod 자체는 Safari 16.4 미만에서 무시되므로
  // 모든 런타임에서 같은 문자열을 보장하지는 않는다.
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    // 관리자 테이블 등 세로로 늘어놓는 화면이 많아 시(hour)는 두 자리로 고정한다.
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  };

  if (locale.startsWith("ko")) {
    options.dayPeriod = "short";
  }

  return d.toLocaleString(locale, options);
}

/** "2026. 8. 24" 형태의 짧은 KST 날짜. 노트 카드처럼 폭이 좁아 긴 형식이 줄바꿈되는 곳에서 쓴다. */
export function formatShortDateKST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // ko-KR 숫자 형식은 "2026. 8. 24."처럼 끝에 온점이 붙으므로 떼어낸다.
  return d
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "Asia/Seoul",
    })
    .trim()
    .replace(/\.$/, "");
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
