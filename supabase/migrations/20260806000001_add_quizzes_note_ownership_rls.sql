-- quizzes의 INSERT/UPDATE 정책이 user_id만 검사해서,
-- 타인 노트의 UUID를 아는 사용자가 자기 명의로 행을 만들어
-- quizzes_note_id_idx(unique)를 선점할 수 있었다.
-- 선점당한 노트는 캐시 저장이 계속 실패해 매번 Gemini를 재호출하게 된다.
-- note_id가 실제로 자기 노트인지 함께 확인하도록 정책을 교체한다.

drop policy if exists "Users can insert own quizzes" on public.quizzes;
drop policy if exists "Users can update own quizzes" on public.quizzes;

create policy "Users can insert own quizzes"
  on public.quizzes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.notes n
      where n.id = quizzes.note_id
        and n.user_id = auth.uid()
    )
  );

create policy "Users can update own quizzes"
  on public.quizzes for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.notes n
      where n.id = quizzes.note_id
        and n.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.notes n
      where n.id = quizzes.note_id
        and n.user_id = auth.uid()
    )
  );
