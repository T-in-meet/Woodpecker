-- 노트 본문·백지 테스트 답안 길이 제약
--
-- 앱은 noteSchema(content 5만 자)와 ANSWER_MAX_LENGTH(5만 자)로 길이를 막지만
-- DB에는 아무 제약이 없었다. notes의 INSERT/UPDATE RLS는 본인 여부와 이메일 인증만 보므로,
-- 사용자가 PostgREST로 notes에 직접 쓰면 Zod를 통째로 건너뛰고 임의 길이 본문을 저장할 수 있다.
--
-- 그 노트로 AI 채점이나 퀴즈를 돌리면 프롬프트 크기에 상한이 없어져 호출 1회의 토큰 비용이
-- 얼마든지 커진다. 호출 "횟수" 한도로는 막을 수 없는 종류의 비용이다.
--
-- 채점 쪽에서 프롬프트를 잘라 대응하지 않는 이유: 노트 본문을 잘라서 채점하면
-- 잘린 뒷부분을 회상한 사용자가 부당하게 감점된다. 길이는 입력 단계에서 막는 게 맞다.
--
-- title은 이미 character varying(100)이라 별도 제약이 필요 없다.
--
-- notes는 기존 데이터가 있으므로 not valid로 추가한다.
-- 일반 ADD CONSTRAINT는 기존 행 전체를 즉시 검증해서, 초과 노트가 하나라도 있으면
-- 이 마이그레이션이 실패하고 main 자동 배포(migrate.yml)가 통째로 막힌다.
-- not valid여도 신규 INSERT/UPDATE는 즉시 차단되므로 위에 적은 비용 폭주는 여기서 막힌다.
--
-- 기존 데이터 정리 후 별도 마이그레이션에서 검증을 마무리한다.
--   select count(*) from public.notes where char_length(content) > 50000;
--   alter table public.notes validate constraint notes_content_length_check;

-- src/features/notes/schema.ts의 noteSchema.content와 같은 값이다. 함께 바꾼다.
alter table public.notes
  add constraint notes_content_length_check
  check (char_length(content) <= 50000) not valid;

-- review_gradings는 직전 마이그레이션에서 만든 신규 테이블이라 기존 데이터가 없다.
-- 검증 대상이 없으므로 not valid 없이 바로 추가한다.
-- src/features/review/schema.ts의 ANSWER_MAX_LENGTH와 같은 값이다. 함께 바꾼다.
alter table public.review_gradings
  add constraint review_gradings_user_answer_length_check
  check (char_length(user_answer) <= 50000);
