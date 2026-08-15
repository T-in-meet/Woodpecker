-- notes_content_length_check 검증 마무리
--
-- 20260808000001에서 not valid로 추가한 제약을 기존 데이터까지 검증한다.
-- 그 시점에 not valid를 쓴 이유는 초과 노트가 있으면 ALTER가 실패해
-- main 자동 배포(migrate.yml)가 통째로 막히기 때문이었다.
--
-- 운영 DB에서 초과 데이터가 0건임을 확인했다.
--   select count(*) from public.notes where char_length(content) > 50000;
--
-- 파일을 나눠 둔 덕에, 확인 시점 이후 초과 데이터가 새로 들어와 이 문장이 실패하더라도
-- 앞 마이그레이션의 제약은 이미 적용된 상태로 남아 신규 쓰기 차단은 유지된다.
-- 그 경우 데이터를 정리하고 이 마이그레이션만 다시 적용하면 된다.
--
-- validate constraint는 ACCESS EXCLUSIVE가 아니라 SHARE UPDATE EXCLUSIVE를 잡으므로
-- 검증 중에도 읽기·쓰기가 막히지 않는다.

alter table public.notes
  validate constraint notes_content_length_check;
