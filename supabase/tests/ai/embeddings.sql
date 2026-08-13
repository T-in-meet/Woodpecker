-- =========================================
-- ai / embeddings
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 16개인지 선언합니다.
SELECT plan(16);

-- =========================================
-- Test fixtures
-- =========================================

-- Embedding fixture가 참조할 사용자와 모델 ID를 테스트별로 고유하게 생성하여
-- seed.sql이나 다른 테스트 데이터에 의존하지 않도록 합니다.
SELECT set_config(
  'test.ai_embedding_user_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_embedding_model_id',
  gen_random_uuid()::text,
  true
);

-- ai_embeddings.owner_user_id Foreign Key를 만족하도록
-- 테스트 전용 auth.users fixture를 생성합니다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at
)
VALUES (
  current_setting('test.ai_embedding_user_id')::uuid,
  'ai_embedding_test_'
    || current_setting('test.ai_embedding_user_id')
    || '@example.com',
  now()
);


-- =========================================
-- Table / column structure
-- =========================================

-- Embedding 저장소 테이블과 런타임에서 사용하는 핵심 컬럼,
-- 필수 NOT NULL 제약이 존재하는지 검증합니다.
SELECT has_table(
  'public',
  'ai_embeddings',
  'ai_embeddings table should exist'
);

SELECT has_column(
  'public',
  'ai_embeddings',
  'embedding',
  'embedding column should exist'
);

SELECT has_column(
  'public',
  'ai_embeddings',
  'model_config_id',
  'model_config_id column should exist'
);

SELECT col_not_null(
  'public',
  'ai_embeddings',
  'owner_user_id',
  'owner_user_id should be NOT NULL'
);

SELECT col_not_null(
  'public',
  'ai_embeddings',
  'embedding',
  'embedding should be NOT NULL'
);


-- =========================================
-- Constraints
-- =========================================

-- 동일 입력의 Embedding 캐시 중복을 방지하는 UNIQUE 제약과
-- 사용자 및 모델 참조 Foreign Key가 구성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_embeddings'::regclass
      AND conname = 'ai_embeddings_owner_source_model_kind_hash_key'
      AND contype = 'u'
  ),
  'embedding cache scope should have a unique constraint'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_embeddings'::regclass
      AND conname = 'ai_embeddings_owner_user_id_fkey'
      AND contype = 'f'
  ),
  'owner_user_id foreign key should exist'
);


-- =========================================
-- Indexes
-- =========================================

-- Embedding 캐시 조회와 유사도 검색 범위 제한에 사용하는
-- 주요 인덱스가 생성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_embeddings'
      AND indexname = 'ai_embeddings_lookup_idx'
  ),
  'embedding lookup index should exist'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_embeddings'
      AND indexname = 'ai_embeddings_match_scope_idx'
  ),
  'embedding match scope index should exist'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_embeddings'
      AND indexname = 'ai_embeddings_model_kind_hash_idx'
  ),
  'embedding model/kind/hash index should exist'
);


-- =========================================
-- RLS
-- =========================================

-- 일반 클라이언트의 직접 접근을 제한할 수 있도록
-- ai_embeddings 테이블에 RLS가 활성화되어 있는지 검증합니다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ai_embeddings'::regclass
  ),
  'RLS should be enabled on ai_embeddings'
);


-- =========================================
-- Permissions
-- =========================================

-- anon/authenticated 역할의 직접 조회는 차단하고,
-- service_role에는 서버 측 Embedding 관리에 필요한 권한을 부여했는지 검증합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.ai_embeddings',
    'SELECT'
  ),
  'anon should not have SELECT on ai_embeddings'
);

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.ai_embeddings',
    'SELECT'
  ),
  'authenticated should not have SELECT on ai_embeddings'
);

SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ai_embeddings',
    'SELECT'
  )
  AND has_table_privilege(
    'service_role',
    'public.ai_embeddings',
    'INSERT'
  )
  AND has_table_privilege(
    'service_role',
    'public.ai_embeddings',
    'UPDATE'
  )
  AND has_table_privilege(
    'service_role',
    'public.ai_embeddings',
    'DELETE'
  ),
  'service_role should have full table privileges on ai_embeddings'
);


-- =========================================
-- Check constraints
-- =========================================

-- 비어 있는 source_type과 음수 token_count처럼 유효하지 않은 값을
-- CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_embeddings (
        owner_user_id,
        source_type,
        source_id,
        model_config_id,
        input_kind,
        content_hash,
        input_hash,
        input_text,
        input_preview,
        embedding,
        token_count
      )
      VALUES (
        '%s'::uuid,
        '',
        gen_random_uuid(),
        '%s'::uuid,
        'test',
        'content-hash-source-type',
        'input-hash-source-type',
        'input',
        'preview',
        (
          '['
          || array_to_string(
            array_fill(0, ARRAY[1536]),
            ','
          )
          || ']'
        )::extensions.vector,
        NULL
      );
    $sql$,
    current_setting('test.ai_embedding_user_id'),
    current_setting('test.ai_embedding_model_id')
  ),
  '23514',
  NULL,
  'blank source_type should be rejected'
);

SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_embeddings (
        owner_user_id,
        source_type,
        source_id,
        model_config_id,
        input_kind,
        content_hash,
        input_hash,
        input_text,
        input_preview,
        embedding,
        token_count
      )
      VALUES (
        '%s'::uuid,
        'note',
        gen_random_uuid(),
        '%s'::uuid,
        'test',
        'content-hash-token-count',
        'input-hash-token-count',
        'input',
        'preview',
        (
          '['
          || array_to_string(
            array_fill(0, ARRAY[1536]),
            ','
          )
          || ']'
        )::extensions.vector,
        -1
      );
    $sql$,
    current_setting('test.ai_embedding_user_id'),
    current_setting('test.ai_embedding_model_id')
  ),
  '23514',
  NULL,
  'negative token_count should be rejected'
);


-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;