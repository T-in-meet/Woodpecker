import { DAY_IN_MS, KST_OFFSET_MS } from "@/lib/constants/time";

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
    endUtcIso: new Date(kstDayStartUtcMs + DAY_IN_MS).toISOString(),
  };
}
