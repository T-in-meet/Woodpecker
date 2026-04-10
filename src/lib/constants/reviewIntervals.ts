export const REVIEW_INTERVALS_DAYS = [1, 3, 7] as const;
export const MAX_REVIEW_ROUND = REVIEW_INTERVALS_DAYS.length;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getNextReviewDate(completedRound: number): Date | null {
  const intervalDays = REVIEW_INTERVALS_DAYS[completedRound];

  if (intervalDays === undefined) {
    return null;
  }

  return new Date(Date.now() + intervalDays * MILLISECONDS_PER_DAY);
}
