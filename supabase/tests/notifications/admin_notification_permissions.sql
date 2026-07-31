-- =========================================
-- admin notifications / direct permissions
-- =========================================

BEGIN;

SELECT plan(4);

SELECT is(
  has_table_privilege('anon', 'public.admin_notification_events', 'SELECT'),
  false,
  $$anon should not select admin_notification_events directly$$
);

SELECT is(
  has_table_privilege(
    'authenticated',
    'public.admin_notification_events',
    'SELECT'
  ),
  false,
  $$authenticated should not select admin_notification_events directly$$
);

SELECT is(
  has_table_privilege('anon', 'public.admin_notification_reads', 'SELECT'),
  false,
  $$anon should not select admin_notification_reads directly$$
);

SELECT is(
  has_table_privilege(
    'authenticated',
    'public.admin_notification_reads',
    'SELECT'
  ),
  false,
  $$authenticated should not select admin_notification_reads directly$$
);

SELECT * FROM finish();
ROLLBACK;
