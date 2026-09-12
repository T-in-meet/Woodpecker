-- =========================================
-- review_logs / next_review_schedule 헬퍼
-- =========================================
--
-- 완료 경로와 재시작 경로가 같은 계산을 쓰도록 뽑아낸 헬퍼다. 두 경로가 어긋나지
-- 않는지는 여기서 한 번만 확인한다.

BEGIN;

SELECT plan(5);

SELECT set_config(
  'test.next_schedule_from',
  (TIMESTAMPTZ '2026-05-01 04:00:00+09')::text,
  true
);

-- 아직 한 번도 복습하지 않았으면 시퀀스의 첫 간격(1일)을 쓴다.
SELECT is(
  (
    SELECT next_at
    FROM public.next_review_schedule(
      0,
      NULL,
      current_setting('test.next_schedule_from')::timestamptz
    )
  ),
  current_setting('test.next_schedule_from')::timestamptz + interval '1 day',
  $$a note with no reviewed days should use the first interval$$
);

-- REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] — 인덱스는 복습한 서로 다른 KST 날짜 수다.
-- 3일 복습했으면 네 번째 값(14일)을 쓴다.
SELECT is(
  (
    SELECT next_at
    FROM public.next_review_schedule(
      3,
      NULL,
      current_setting('test.next_schedule_from')::timestamptz
    )
  ),
  current_setting('test.next_schedule_from')::timestamptz + interval '14 days',
  $$the interval should follow the reviewed-day count, not the round$$
);

-- 시퀀스를 넘어가면 마지막 값(30일)을 반복해 다음 일정이 항상 존재한다.
SELECT is(
  (
    SELECT next_at
    FROM public.next_review_schedule(
      42,
      NULL,
      current_setting('test.next_schedule_from')::timestamptz
    )
  ),
  current_setting('test.next_schedule_from')::timestamptz + interval '30 days',
  $$counts past the sequence should repeat the last interval$$
);

-- 알림 시각이 없으면 base와 next가 같다.
SELECT ok(
  (
    SELECT base_at = next_at
    FROM public.next_review_schedule(
      1,
      NULL,
      current_setting('test.next_schedule_from')::timestamptz
    )
  ),
  $$without a notification time the base and the scheduled time should match$$
);

-- 알림 시각이 있으면 base는 케이던스 그대로 두고 next에만 시각을 얹는다.
-- base는 notification_base_scheduled_at으로 저장돼 기본 일정을 되돌릴 때 쓰인다.
SELECT ok(
  (
    SELECT base_at
             = current_setting('test.next_schedule_from')::timestamptz
               + interval '3 days'
      AND next_at = public.apply_time_of_day_not_before(
        current_setting('test.next_schedule_from')::timestamptz
          + interval '3 days',
        TIME '21:30'
      )
    FROM public.next_review_schedule(
      1,
      TIME '21:30',
      current_setting('test.next_schedule_from')::timestamptz
    )
  ),
  $$a notification time should shift only the scheduled time, not the base$$
);

SELECT * FROM finish();

ROLLBACK;
