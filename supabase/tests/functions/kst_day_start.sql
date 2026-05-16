-- =========================================
-- functions / KST_DAY_START
-- =========================================

BEGIN;

SELECT plan(3);

-- UTC 입력 → KST 자정 (UTC+9 → 다음날 자정 아님, 같은 KST 날짜 자정)
-- UTC 2026-05-13 15:00:00 = KST 2026-05-14 00:00:00 → KST 자정 = 2026-05-14 00:00:00+09
SELECT is(
  public.kst_day_start(TIMESTAMPTZ '2026-05-13 15:00:00+00'),
  TIMESTAMPTZ '2026-05-14 00:00:00+09',
  $$UTC input maps to KST midnight of the same KST date$$
);

-- KST 23:30 입력 → 같은 KST 날짜 자정 (UTC 기준 다음 날이지만 KST 날짜는 같음)
-- KST 2026-05-13 23:30:00 → KST 자정 = 2026-05-13 00:00:00+09
SELECT is(
  public.kst_day_start(TIMESTAMPTZ '2026-05-13 23:30:00+09'),
  TIMESTAMPTZ '2026-05-13 00:00:00+09',
  $$KST 23:30 maps to midnight of the same KST date, not the next day$$
);

-- KST 자정 정시 입력 → 입력값 그대로 반환
SELECT is(
  public.kst_day_start(TIMESTAMPTZ '2026-05-13 00:00:00+09'),
  TIMESTAMPTZ '2026-05-13 00:00:00+09',
  $$KST midnight input returns the same value$$
);

SELECT * FROM finish();
ROLLBACK;
