-- avatars bucket RLS policies
--
-- Design rules:
-- - no SELECT policy (public bucket URLs do not need SELECT RLS and should not enable listing)
-- - INSERT/UPDATE/DELETE are limited to the authenticated user's own folder ({auth.uid()}/)
-- - signup uploads use service_role(adminClient), so they bypass these policies
-- - this migration resets the policies first because the earlier duplicate migration
--   version could leave migration history out of sync with the actual DB state

DROP POLICY IF EXISTS "avatars_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_authenticated_delete" ON storage.objects;

CREATE POLICY "avatars_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
