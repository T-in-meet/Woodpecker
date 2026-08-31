-- =========================================
-- feedbacks / area constraints
-- =========================================

BEGIN;

SELECT plan(9);

SELECT set_config(
  'test.feedbacks_constraints_area_user_id',
  gen_random_uuid()::text,
  true
);
SELECT set_config(
  'test.feedbacks_constraints_area_feedback_id',
  gen_random_uuid()::text,
  true
);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  current_setting('test.feedbacks_constraints_area_user_id')::uuid,
  'feedbacks_constraints_area_' ||
    current_setting('test.feedbacks_constraints_area_user_id') ||
    '@example.com',
  '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feedbacks (id, user_id, category, title, content)
VALUES (
  current_setting('test.feedbacks_constraints_area_feedback_id')::uuid,
  current_setting('test.feedbacks_constraints_area_user_id')::uuid,
  'BUG',
  'area constraint test',
  'feedback area constraint fixture'
);

SELECT is(
  (
    SELECT area
    FROM public.feedbacks
    WHERE id = current_setting('test.feedbacks_constraints_area_feedback_id')::uuid
  ),
  'ETC'::character varying,
  'feedbacks.area should default to ETC'
);

SELECT lives_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'NOTE' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  'feedbacks.area should allow NOTE'
);

SELECT lives_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'REVIEW' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  'feedbacks.area should allow REVIEW'
);

SELECT lives_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'AI' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  'feedbacks.area should allow AI'
);

SELECT lives_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'NOTIFICATION' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  'feedbacks.area should allow NOTIFICATION'
);

SELECT lives_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'ACCOUNT' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  'feedbacks.area should allow ACCOUNT'
);

SELECT lives_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'ETC' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  'feedbacks.area should allow ETC'
);

SELECT throws_ok(
  format(
    $$UPDATE public.feedbacks SET area = NULL WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  '23502',
  NULL,
  'feedbacks.area should reject NULL'
);

SELECT throws_ok(
  format(
    $$UPDATE public.feedbacks SET area = 'UNKNOWN' WHERE id = %L::uuid$$,
    current_setting('test.feedbacks_constraints_area_feedback_id')
  ),
  '23514',
  NULL,
  'feedbacks.area should reject unknown values'
);

SELECT * FROM finish();

ROLLBACK;
