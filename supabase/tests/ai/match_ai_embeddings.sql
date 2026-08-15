-- =========================================
-- ai / match_ai_embeddings
-- =========================================

BEGIN;

-- 이 테스트는 match_ai_embeddings RPC의 권한, 최신 embedding 선택,
-- limit, similarity 보정, source/input 범위 필터링을 함께 검증합니다.
SELECT plan(10);

-- 테스트마다 독립적인 사용자/모델/소스 식별자를 사용합니다.
-- Models 단계부터 ai_embeddings.model_config_id가 ai_model_configs를
-- 참조하므로 테스트 전용 모델 식별자를 준비합니다.
SELECT set_config('test.ai_match_user_id', gen_random_uuid()::text, true);
SELECT set_config('test.ai_match_model_id', gen_random_uuid()::text, true);

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

SELECT set_config('test.ai_match_source_a', gen_random_uuid()::text, true);
SELECT set_config('test.ai_match_source_b', gen_random_uuid()::text, true);

-- ai_embeddings.owner_user_id Foreign Key를 만족시키기 위한
-- 테스트 전용 Auth 사용자 fixture를 생성합니다.
INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES (
  current_setting('test.ai_match_user_id')::uuid,
  'ai_match_' || current_setting('test.ai_match_user_id') || '@example.com',
  now()
);

-- match_ai_embeddings RPC가 예상한 시그니처로 생성되었는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.match_ai_embeddings(extensions.vector,uuid,text,uuid,text,integer,double precision)'
  ) IS NOT NULL,
  'match_ai_embeddings() should exist'
);

-- 임베딩 검색 RPC는 서버 측 실행 전용이므로
-- anon 역할에는 EXECUTE 권한이 없어야 합니다.
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.match_ai_embeddings(extensions.vector,uuid,text,uuid,text,integer,double precision)',
    'EXECUTE'
  ),
  'anon should not execute match_ai_embeddings()'
);

-- authenticated 역할에서도 직접 실행할 수 없도록 제한합니다.
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.match_ai_embeddings(extensions.vector,uuid,text,uuid,text,integer,double precision)',
    'EXECUTE'
  ),
  'authenticated should not execute match_ai_embeddings()'
);

-- 서버 내부 실행 주체인 service_role에는 EXECUTE 권한이 있어야 합니다.
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.match_ai_embeddings(extensions.vector,uuid,text,uuid,text,integer,double precision)',
    'EXECUTE'
  ),
  'service_role should execute match_ai_embeddings()'
);

-- 동일 source에 과거/최신 embedding을 함께 저장하고,
-- 다른 source의 embedding도 추가해 최신본 선택과 거리 정렬을 검증합니다.
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
  now() - interval '1 minute'
),
(
  current_setting('test.ai_match_user_id')::uuid,
  'note',
  current_setting('test.ai_match_source_a')::uuid,
  current_setting('test.ai_match_model_id')::uuid,
  'rag_note_content',
  'source-a-new',
  'source-a-new-input',
  'source a new',
  'source a new',
  (
    '[0,1,'
    || array_to_string(array_fill(0, ARRAY[1534]), ',')
    || ']'
  )::extensions.vector,
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
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  now()
);

-- source별로 가장 최신 embedding 하나만 후보에 포함되는지 검증합니다.
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
  2::bigint,
  'match should return at most one latest embedding per source'
);

-- 같은 source에 여러 embedding이 있을 때 created_at/id 기준
-- 최신 embedding이 실제 검색 결과로 선택되는지 검증합니다.
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
      10,
      NULL
    )
    WHERE source_id = current_setting('test.ai_match_source_a')::uuid
  ),
  (
    SELECT id
    FROM public.ai_embeddings
    WHERE source_id = current_setting('test.ai_match_source_a')::uuid
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ),
  'match should use the latest embedding for a source'
);

-- limit이 거리 정렬 이후의 최종 결과 개수를 제한하는지 검증합니다.
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
      NULL
    )
  ),
  current_setting('test.ai_match_source_b')::uuid,
  'limit should restrict results ordered by distance'
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