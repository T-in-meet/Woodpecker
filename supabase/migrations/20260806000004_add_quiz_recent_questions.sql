-- 최근 출제 이력을 누적해 같은 문제가 반복 출제되는 것을 막는다.
--
-- questions 컬럼은 upsert로 덮어써지므로 직전 1세트밖에 알 수 없었다.
-- "새 퀴즈"를 세 번 누르면 3회차에서 1회차 문제가 그대로 다시 나온다.
--
-- recent_questions는 최근 세트들의 문제 문장만 담는다. 형식은 string[][]이고
-- 최신 세트가 앞에 온다. 몇 세트까지 남길지는 애플리케이션이 정한다.
-- 정답·해설·선택지는 재출제 회피에 필요 없어서 넣지 않는다.

alter table public.quizzes
  add column recent_questions jsonb not null default '[]'::jsonb;

-- 기존 캐시도 첫 재생성부터 회피가 동작하도록 현재 questions를 1세트로 채운다.
update public.quizzes
set recent_questions = jsonb_build_array(
  coalesce(
    (
      select jsonb_agg(question->>'question')
      from jsonb_array_elements(questions) as question
      where question->>'question' is not null
    ),
    '[]'::jsonb
  )
);
