/**
 * 복습 간격(일). 인덱스는 "복습한 서로 다른 KST 날짜 수"다.
 *
 * 완료 횟수가 아니라 날짜 수를 쓴다. 하루에 여러 번 복습해도 그날은 한 칸만
 * 진행하므로, 몰아서 완료해도 간격이 뒤로 튀지 않는다.
 *
 * DB의 `review_interval_days()`와 같은 값을 유지해야 한다.
 */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

/**
 * 복습 횟수를 집계 화면에 묶어 보여줄 때 쓰는 마지막 칸.
 *
 * 누적 복습 횟수에는 상한이 없어서 실제 값을 그대로 칸으로 만들면 목록이 무한히
 * 길어진다. 이 값 이상은 모두 같은 간격(마지막 값)을 쓰므로 한 칸으로 묶는다.
 */
export const MAX_REVIEW_ROUND_BUCKET = REVIEW_INTERVALS_DAYS.length;

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
