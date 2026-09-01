/**
 * 복습 간격(일). 인덱스는 "복습한 서로 다른 KST 날짜 수"다.
 *
 * 완료 횟수가 아니라 날짜 수를 쓴다. 하루에 여러 번 복습해도 그날은 한 칸만
 * 진행하므로, 몰아서 완료해도 간격이 뒤로 튀지 않는다.
 *
 * DB의 `review_interval_days()`와 같은 값을 유지해야 한다.
 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 다음 복습까지의 간격(일).
 * 시퀀스를 넘어서면 마지막 값을 반복하므로 항상 값이 존재한다.
 */
export function getReviewIntervalDays(reviewedDayCount: number): number {
  const lastIndex = REVIEW_INTERVALS_DAYS.length - 1;
  const index = Math.min(Math.max(Math.trunc(reviewedDayCount), 0), lastIndex);

  return REVIEW_INTERVALS_DAYS[index] ?? REVIEW_INTERVALS_DAYS[0];
}

export function getNextReviewDate(reviewedDayCount: number): Date {
  return new Date(
    Date.now() + getReviewIntervalDays(reviewedDayCount) * MILLISECONDS_PER_DAY,
  );
}
