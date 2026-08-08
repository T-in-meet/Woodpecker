-- 퀴즈 캐시를 노트별에서 노트·유형별로 분리한다.
--
-- 기존에는 note_id에 unique 인덱스가 걸려 있어 노트당 퀴즈 1개만 남았다.
-- 유형을 OX → 객관식으로 바꾸면 이전 유형 캐시가 덮어써지고,
-- 다시 OX로 돌아오면 Gemini를 또 호출해야 했다.
--
-- quiz_type을 컬럼으로 분리하면서 note_content_hash는 제목+내용 해시만 담는다.
-- (유형이 컬럼으로 빠졌으므로 해시 뒤에 붙이던 ':<유형>' 접미사가 필요 없다.)

alter table public.quizzes add column quiz_type text;

-- 기존 캐시 키는 '<해시>:<유형>' 형식이라 유형을 복원할 수 있다.
update public.quizzes
set
  quiz_type = nullif(split_part(note_content_hash, ':', 2), ''),
  note_content_hash = split_part(note_content_hash, ':', 1)
where quiz_type is null;

-- 복원하지 못한 행은 캐시라 버려도 안전하다. 다음 조회 때 다시 생성된다.
delete from public.quizzes where quiz_type is null;

alter table public.quizzes alter column quiz_type set not null;

-- note_id 단독 unique를 노트·유형 복합 unique로 교체한다.
-- 선두 컬럼이 note_id라 note_id 단독 조회와 FK cascade에도 그대로 쓰인다.
drop index if exists public.quizzes_note_id_idx;

create unique index quizzes_note_id_quiz_type_idx
  on public.quizzes (note_id, quiz_type);
