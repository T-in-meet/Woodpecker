-- 퀴즈 캐싱 테이블: 노트별 AI 생성 퀴즈를 저장
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  questions jsonb not null,
  note_content_hash text not null,
  created_at timestamptz not null default now()
);

-- 노트당 하나의 퀴즈만 유지 (재생성 시 upsert)
create unique index quizzes_note_id_idx on public.quizzes (note_id);
create index quizzes_user_id_idx on public.quizzes (user_id);

-- RLS
alter table public.quizzes enable row level security;

create policy "Users can read own quizzes"
  on public.quizzes for select
  using (auth.uid() = user_id);

create policy "Users can insert own quizzes"
  on public.quizzes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own quizzes"
  on public.quizzes for update
  using (auth.uid() = user_id);

create policy "Users can delete own quizzes"
  on public.quizzes for delete
  using (auth.uid() = user_id);
