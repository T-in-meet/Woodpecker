-- 관리자 답변 첨부 이미지 버킷 (private)
--
-- 답변 이미지에도 사용자 피드백 내용이나 개인정보가 포함될 수 있으므로
-- public이 아닌 private 버킷으로 둔다.
--
-- 파일 경로 규칙:
--   {feedback_id}/{파일명}
--
-- 예:
--   550e8400-e29b-41d4-a716-446655440000/image.webp
--
-- 관리자 업로드/조회/수정/삭제 및 서명 URL 생성은
-- createAdminClient(service_role)로 처리한다.
--
-- 일반 사용자는 자신의 feedback에 연결된 이미지에 대해서만
-- SELECT 정책을 통해 접근할 수 있다.

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'feedback_replies',
    'feedback_replies',
    false,
    5242880,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp'
    ]
)
ON CONFLICT (id) DO NOTHING;


-- 기존 정책이 존재하더라도 마이그레이션을 다시 적용할 수 있도록 제거한다.
DROP POLICY IF EXISTS
    "feedback_replies_authenticated_select"
    ON storage.objects;


-- 로그인 사용자는 자신의 feedback ID 폴더에 저장된
-- 관리자 답변 이미지만 조회할 수 있다.
--
-- storage.foldername(name)의 첫 번째 값은
-- 경로의 첫 번째 폴더인 feedback_id이다.
CREATE POLICY "feedback_replies_authenticated_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'feedback_replies'
        AND EXISTS (
            SELECT 1
            FROM "public"."feedbacks"
            WHERE "feedbacks"."id"::text =
                (storage.foldername(name))[1]
              AND "feedbacks"."user_id" = "auth"."uid"()
        )
    );


-- INSERT/UPDATE/DELETE Storage 정책은 정의하지 않는다.
-- 관리자 Server Action에서 createAdminClient를 사용해 RLS를 우회한다.