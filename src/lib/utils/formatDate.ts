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
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
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
