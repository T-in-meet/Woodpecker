-- =========================================
-- ai / match_ai_embeddings
-- =========================================

BEGIN;

-- 이 테스트는 match_ai_embeddings RPC의 권한,
-- 활성 generation의 chunk 검색,
-- limit, similarity 보정, source/input 범위 필터링을 함께 검증합니다.
SELECT plan(14);

-- 테스트마다 독립적인 사용자/모델/소스 식별자를 사용합니다.
SELECT set_config('test.ai_match_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_match_model_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_match_source_a', gen_random_uuid()::text, true);
SELECT set_config('test.ai_match_source_b', gen_random_uuid()::text, true);

-- source A의 비활성 과거 generation과 활성 현재 generation,
-- source B의 활성 generation을 각각 준비합니다.
SELECT set_config(
  'test.ai_match_generation_a_old',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_match_generation_a_active',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_match_generation_b_active',
  gen_random_uuid()::text,
  true
);

-- Models 단계부터 ai_embeddings.model_config_id가 ai_model_configs를
-- 참조하므로 테스트 전용 Embedding 모델 fixture를 생성합니다.
INSERT INTO public.ai_model_configs (
  id,
  display_name,
  provider,
  model,
  capability,
  dimensions,
  distance_metric
)
VALUES (
  current_setting('test.ai_match_model_id')::uuid,
  'AI Match Test Embedding Model',
  'test',
  'ai-match-test-embedding-model',
  'embedding',
  1536,
  'cosine'
);

-- ai_embeddings.owner_user_id Foreign Key를 만족시키기 위한
-- 테스트 전용 Auth 사용자 fixture를 생성합니다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at
)
VALUES (
  current_setting('test.ai_match_user_id')::uuid,
  'ai_match_' || current_setting('test.ai_match_user_id') || '@example.com',
  now()
);

-- match_ai_embeddings RPC가 예상한 시그니처로 생성되었는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.match_ai_embeddings(
  extensions.vector,
  uuid,
  text,
  uuid,
  text,
  integer,
  double precision,
  uuid
)'
  ) IS NOT NULL,
  'match_ai_embeddings() should exist'
);

-- 임베딩 검색 RPC는 서버 측 실행 전용이므로
-- anon 역할에는 EXECUTE 권한이 없어야 합니다.
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.match_ai_embeddings(
  extensions.vector,
  uuid,
  text,
  uuid,
  text,
  integer,
  double precision,
  uuid
)',
    'EXECUTE'
  ),
  'anon should not execute match_ai_embeddings()'
);

-- authenticated 역할에서도 직접 실행할 수 없도록 제한합니다.
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.match_ai_embeddings(
  extensions.vector,
  uuid,
  text,
  uuid,
  text,
  integer,
  double precision,
  uuid
)',
    'EXECUTE'
  ),
  'authenticated should not execute match_ai_embeddings()'
);

-- 서버 내부 실행 주체인 service_role에는 EXECUTE 권한이 있어야 합니다.
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.match_ai_embeddings(
  extensions.vector,
  uuid,
  text,
  uuid,
  text,
  integer,
  double precision,
  uuid
)',
    'EXECUTE'
  ),
  'service_role should execute match_ai_embeddings()'
);

-- source A에는 비활성 과거 세대와 활성 현재 세대를 함께 저장하고,
-- source B에도 활성 세대를 저장해 활성 세대 필터와 chunk 거리 정렬을 검증합니다.
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
  chunk_index,
  chunk_count,
  generation_id,
  created_at
)
VALUES
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_a')::uuid,
  current_setting('test.ai_match_model_id')::uuid,
  'rag_note_content',
  'source-a-old',
  'source-a-old-input',
  'source a old',
  'source a old',
  (
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  0,
  1,
  current_setting('test.ai_match_generation_a_old')::uuid,
  now() - interval '1 minute'
),
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_a')::uuid,
  current_setting('test.ai_match_model_id')::uuid,
  'rag_note_content',
  'source-a-active-0',
  'source-a-active-0-input',
  'source a active chunk 0',
  'source a active chunk 0',
  (
    '[0,1,'
    || array_to_string(array_fill(0, ARRAY[1534]), ',')
    || ']'
  )::extensions.vector,
  0,
  2,
  current_setting('test.ai_match_generation_a_active')::uuid,
  now()
),
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_a')::uuid,
  current_setting('test.ai_match_model_id')::uuid,
  'rag_note_content',
  'source-a-active-1',
  'source-a-active-1-input',
  'source a active chunk 1',
  'source a active chunk 1',
  (
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  1,
  2,
  current_setting('test.ai_match_generation_a_active')::uuid,
  now()
),
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_b')::uuid,
  current_setting('test.ai_match_model_id')::uuid,
  'rag_note_content',
  'source-b',
  'source-b-input',
  'source b',
  'source b',
  (
    '[0.9,0.1,'
    || array_to_string(array_fill(0, ARRAY[1534]), ',')
    || ']'
  )::extensions.vector,
  0,
  1,
  current_setting('test.ai_match_generation_b_active')::uuid,
  now()
);

-- source A/B의 현재 활성 model/generation을 등록합니다.
INSERT INTO public.ai_embedding_active_generations (
  owner_user_id,
  source_type,
  source_id,
  input_kind,
  active_model_config_id,
  active_generation_id
)
VALUES
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_a')::uuid,
  'rag_note_content',
  current_setting('test.ai_match_model_id')::uuid,
  current_setting('test.ai_match_generation_a_active')::uuid
),
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_b')::uuid,
  'rag_note_content',
  current_setting('test.ai_match_model_id')::uuid,
  current_setting('test.ai_match_generation_b_active')::uuid
);

-- 비활성 generation은 제외하고,
-- 각 source의 활성 generation에 속한 모든 chunk가 검색되는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      NULL
    )
  ),
  3::bigint,
  'match should return chunks only from active generations'
);

-- 같은 source의 비활성 과거 generation은 검색 결과에서 제외되는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      NULL
    ) AS matched
    JOIN public.ai_embeddings AS embedding
      ON embedding.id = matched.embedding_id
    WHERE embedding.generation_id =
      current_setting('test.ai_match_generation_a_old')::uuid
  ),
  0::bigint,
  'match should exclude chunks from inactive generations'
);

-- 동일 source의 활성 generation에 여러 chunk가 있어도
-- source 단위로 합치지 않고 각각의 chunk를 검색 결과로 반환하는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      NULL
    )
    WHERE source_id =
      current_setting('test.ai_match_source_a')::uuid
  ),
  2::bigint,
  'match should return multiple active chunks from the same source'
);

-- 가장 가까운 embedding과 함께 해당 청크의 chunk_index가 반환되는지 검증합니다.
SELECT is(
  (
    SELECT chunk_index
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      1,
      NULL
    )
  ),
  1,
  'match should return the matched chunk index'
);

-- limit이 거리 정렬 이후 반환할 chunk 개수를 제한하는지 검증합니다.
SELECT is(
  (
    SELECT embedding_id
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      1,
      NULL
    )
  ),
  (
    SELECT id
    FROM public.ai_embeddings
    WHERE generation_id =
      current_setting('test.ai_match_generation_a_active')::uuid
      AND chunk_index = 1
  ),
  'limit should restrict chunk results ordered by distance'
);

-- p_exclude_source_id가 NULL이면 기존 검색과 동일하게
-- 모든 활성 source의 chunk가 검색되는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      NULL,
      NULL
    )
  ),
  3::bigint,
  'null excluded source should preserve existing matching behavior'
);

-- 특정 source를 제외하면 해당 source의 모든 chunk를
-- ranking 및 LIMIT 적용 전에 검색 대상에서 제거하는지 검증합니다.
--
-- query vector와 가장 가까운 chunk는 source A의 chunk 1이지만
-- source A 자체를 제외하므로 limit 1 결과는 source B가 되어야 합니다.
SELECT is(
  (
    SELECT source_id
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      1,
      NULL,
      current_setting('test.ai_match_source_a')::uuid
    )
  ),
  current_setting('test.ai_match_source_b')::uuid,
  'excluded source should be removed before ranking and limit'
);

-- min_similarity가 허용 범위인 1을 초과하면
-- 내부에서 1로 보정되는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      1.1
    )
  ),
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      1
    )
  ),
  'min similarity above 1 should be clamped to 1'
);

-- source_type이 다른 embedding은 검색 결과에서 제외되는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'other-source-type',
      current_setting('test.ai_match_model_id')::uuid,
      'rag_note_content',
      10,
      NULL
    )
  ),
  0::bigint,
  'source_type should scope matching'
);

-- input_kind가 다른 embedding도 검색 결과에서 제외되는지 검증합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.match_ai_embeddings(
      (
        '[1,'
        || array_to_string(array_fill(0, ARRAY[1535]), ',')
        || ']'
      )::extensions.vector,
      current_setting('test.ai_match_user_id')::uuid,
      'note',
      current_setting('test.ai_match_model_id')::uuid,
      'other-input-kind',
      10,
      NULL
    )
  ),
  0::bigint,
  'input_kind should scope matching'
);

SELECT * FROM finish();

-- 테스트 fixture와 설정값을 모두 롤백해 실제 로컬 DB 상태를 보존합니다.
ROLLBACK;