-- feedbacks 첨부 이미지 버킷 (private)
-- 버그 화면·개인정보가 담길 수 있으므로 public이 아닌 private로 둔다.
--   조회는 서명 URL(createSignedUrl)로만 가능.
-- 파일 경로 규칙: {auth.uid()}/{feedbackId 등}/파일명 → RLS는 첫 폴더가 본인 uid인지로 판별.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedbacks',
  'feedbacks',
  false, -- private: URL만으로는 접근 불가, 서명 URL 필요
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;


-- feedbacks bucket RLS policies
--
-- Design rules:
-- - private 버킷이므로 본인 이미지 열람을 위한 SELECT 정책이 필요
-- - INSERT/SELECT/UPDATE/DELETE 모두 본인 폴더({auth.uid()}/)로 제한
-- - 관리자 조회는 service_role(adminClient)로 서명 URL을 만들어 RLS를 우회한다
DROP POLICY IF EXISTS "feedbacks_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "feedbacks_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "feedbacks_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "feedbacks_authenticated_delete" ON storage.objects;

CREATE POLICY "feedbacks_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedbacks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedbacks_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedbacks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedbacks_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'feedbacks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "feedbacks_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedbacks'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
