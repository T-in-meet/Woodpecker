-- avatars 버킷 RLS 정책
--
-- 설계 원칙:
-- - SELECT: 전체 공개 (public 버킷)
-- - INSERT/UPDATE/DELETE: 인증 유저 본인 폴더({auth.uid()}/)만 허용
-- - 회원가입 업로드는 service_role(adminClient)로 처리되어 RLS 우회

-- SELECT: 전체 공개
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- INSERT: 인증 유저가 본인 폴더에만 업로드 가능
CREATE POLICY "avatars_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: 인증 유저가 본인 폴더 파일만 수정 가능
CREATE POLICY "avatars_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: 인증 유저가 본인 폴더 파일만 삭제 가능
CREATE POLICY "avatars_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
