-- AI 백지테스트 채점 결과 테이블: 복습 1회(review_log)당 1건 저장
create table public.review_gradings (
  id uuid primary key default gen_random_uuid(),
  review_log_id uuid not null references public.review_logs(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round integer not null,
  user_answer text not null,
  score integer not null,
  feedback jsonb not null,
  created_at timestamptz not null default now(),
  constraint review_gradings_round_check check (round >= 1 and round <= 3),
  constraint review_gradings_score_check check (score >= 0 and score <= 100)
);

-- 복습 1회당 채점 1회 (재채점 방지 + 멱등성)
create unique index review_gradings_review_log_id_idx on public.review_gradings (review_log_id);
create index review_gradings_note_id_idx on public.review_gradings (note_id);
create index review_gradings_user_id_idx on public.review_gradings (user_id);

-- RLS
alter table public.review_gradings enable row level security;

create policy "Users can read own review gradings"
  on public.review_gradings for select
  to authenticated
  using (auth.uid() = user_id);

-- 쓰기는 이메일 인증 사용자만 (notes 쓰기 RLS와 동일 기준)
create policy "Users can insert own review gradings"
  on public.review_gradings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_current_user_email_confirmed()
  );

create policy "Users can delete own review gradings"
  on public.review_gradings for delete
  to authenticated
  using (auth.uid() = user_id);
