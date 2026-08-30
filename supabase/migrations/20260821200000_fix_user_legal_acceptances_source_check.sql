-- 20260821190000_create_user_legal_acceptances.sql이 source CHECK에 'reconsent'를 넣었지만
-- 실제 기록 경로(src/features/auth/agreements/actions/acceptLegalDocumentsAction.ts)는
-- 'agreements_page'를 쓴다. 이미 적용된 마이그레이션은 수정하지 않으므로 제약을 갈아끼운다.

-- 'reconsent'를 기록하는 코드 경로는 존재한 적이 없어 실제로는 0건이지만,
-- 남아 있으면 아래 ADD CONSTRAINT가 실패하므로 방어적으로 먼저 정리한다.
UPDATE public.user_legal_acceptances
SET source = 'agreements_page'
WHERE source = 'reconsent';

ALTER TABLE public.user_legal_acceptances
  DROP CONSTRAINT IF EXISTS user_legal_acceptances_source_check;

ALTER TABLE public.user_legal_acceptances
  ADD CONSTRAINT user_legal_acceptances_source_check CHECK (
    source IN ('email', 'oauth', 'email_backfill', 'agreements_page')
  );
