const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getKstDayBoundsUtc(now = new Date()): {
  startUtcIso: string;
  endUtcIso: string;
} {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstDayStartUtcMs =
    Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
    ) - KST_OFFSET_MS;

  return {
    startUtcIso: new Date(kstDayStartUtcMs).toISOString(),
    endUtcIso: new Date(kstDayStartUtcMs + DAY_MS).toISOString(),
  };
}
