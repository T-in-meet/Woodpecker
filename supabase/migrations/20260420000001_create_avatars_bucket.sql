-- avatars 버킷 생성
-- public: true → 인증 없이 URL로 이미지 접근 가능 (읽기), 쓰기는 RLS로 제한
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
