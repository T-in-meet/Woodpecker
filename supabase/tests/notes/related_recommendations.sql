BEGIN;

SELECT plan(6);

SELECT ok(
  to_regclass('public.note_related_recommendations') IS NOT NULL,
  $$note_related_recommendations table should exist$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'note_related_recommendations_note_id_fkey'
      AND conrelid = 'public.note_related_recommendations'::regclass
      AND confrelid = 'public.notes'::regclass
      AND confdeltype = 'c'
  ),
  $$note_related_recommendations.note_id should cascade when note is deleted$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'note_related_recommendations_recommendations_array_check'
      AND conrelid = 'public.note_related_recommendations'::regclass
  ),
  $$note_related_recommendations.recommendations should require a JSON array$$
);

SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.note_related_recommendations'::regclass
  ),
  $$note_related_recommendations should have RLS enabled$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'note_related_recommendations'
      AND policyname = 'note_related_recommendations_select_own'
      AND cmd = 'SELECT'
  ),
  $$note_related_recommendations should expose an owner-scoped select policy$$
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'tr_note_related_recommendations_updated_at'
      AND tgrelid = 'public.note_related_recommendations'::regclass
      AND NOT tgisinternal
  ),
  $$note_related_recommendations should update updated_at automatically$$
);

SELECT * FROM finish();
ROLLBACK;
