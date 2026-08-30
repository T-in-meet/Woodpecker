-- =========================================
-- ai / activate_ai_embedding_generation
-- =========================================

BEGIN;

-- activate_ai_embedding_generation RPC의 권한과
-- 완성된 generation 활성화, 이전 generation 정리,
-- stale source generation과 불완전 generation 거부,
-- 실패 시 기존 활성 세대 보존을 검증합니다.
SELECT plan(23);

-- =========================================
-- Test fixtures
-- =========================================

SELECT set_config(
  'test.ai_activation_user_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_source_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_model_a_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_model_b_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_old_generation_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_new_generation_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_incomplete_generation_id',
  gen_random_uuid()::text,
  true
);

SELECT set_config(
  'test.ai_activation_cleanup_generation_id',
  gen_random_uuid()::text,
  true
);

-- activation 시 Note 최신 버전 여부를 검증하기 위한 updated_at fixture입니다.
SELECT set_config(
  'test.ai_activation_source_updated_at',
  '2026-08-17T00:00:00+00',
  true
);

-- ai_embeddings.owner_user_id FK를 만족시키기 위한 사용자 fixture입니다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at
)
VALUES (
  current_setting('test.ai_activation_user_id')::uuid,
  'ai_activation_'
    || current_setting('test.ai_activation_user_id')
    || '@example.com',
  now()
);

-- activation RPC가 Note의 최신 updated_at을 검증할 수 있도록
-- embedding source와 동일한 ID의 Note fixture를 생성합니다.
INSERT INTO public.notes (
  id,
  user_id,
  title,
  content,
  updated_at
)
VALUES (
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_user_id')::uuid,
  'AI activation test note',
  'AI activation test content',
  current_setting('test.ai_activation_source_updated_at')::timestamptz
);

-- 모델 전환까지 함께 검증할 수 있도록
-- 서로 다른 두 개의 Embedding Model fixture를 준비합니다.
INSERT INTO public.ai_model_configs (
  id,
  display_name,
  provider,
  model,
  capability,
  dimensions,
  distance_metric
)
VALUES
(
  current_setting('test.ai_activation_model_a_id')::uuid,
  'Activation Test Embedding Model A',
  'test',
  'activation-test-embedding-model-a',
  'embedding',
  1536,
  'cosine'
),
(
  current_setting('test.ai_activation_model_b_id')::uuid,
  'Activation Test Embedding Model B',
  'test',
  'activation-test-embedding-model-b',
  'embedding',
  1536,
  'cosine'
);

-- 현재 활성 상태인 기존 generation을 생성합니다.
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
  generation_id
)
VALUES
(
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_a_id')::uuid,
  'rag_note_content',
  'old-generation-chunk-0',
  'old-generation-input-0',
  'old generation chunk 0',
  'old generation chunk 0',
  (
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  0,
  2,
  current_setting('test.ai_activation_old_generation_id')::uuid
),
(
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_a_id')::uuid,
  'rag_note_content',
  'old-generation-chunk-1',
  'old-generation-input-1',
  'old generation chunk 1',
  'old generation chunk 1',
  (
    '[0,1,'
    || array_to_string(array_fill(0, ARRAY[1534]), ',')
    || ']'
  )::extensions.vector,
  1,
  2,
  current_setting('test.ai_activation_old_generation_id')::uuid
);

-- 기존 generation을 현재 활성 세트로 등록합니다.
INSERT INTO public.ai_embedding_active_generations (
  owner_user_id,
  source_type,
  source_id,
  input_kind,
  active_model_config_id,
  active_generation_id
)
VALUES (
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  'rag_note_content',
  current_setting('test.ai_activation_model_a_id')::uuid,
  current_setting('test.ai_activation_old_generation_id')::uuid
);

-- 새 모델로 생성된 완성된 새 generation을 준비합니다.
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
  generation_id
)
VALUES
(
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_b_id')::uuid,
  'rag_note_content',
  'new-generation-chunk-0',
  'new-generation-input-0',
  'new generation chunk 0',
  'new generation chunk 0',
  (
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  0,
  2,
  current_setting('test.ai_activation_new_generation_id')::uuid
),
(
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_b_id')::uuid,
  'rag_note_content',
  'new-generation-chunk-1',
  'new-generation-input-1',
  'new generation chunk 1',
  'new generation chunk 1',
  (
    '[0,1,'
    || array_to_string(array_fill(0, ARRAY[1534]), ',')
    || ']'
  )::extensions.vector,
  1,
  2,
  current_setting('test.ai_activation_new_generation_id')::uuid
);


-- =========================================
-- RPC / permissions
-- =========================================

SELECT ok(
  to_regprocedure(
    'public.activate_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid,timestamp with time zone)'
  ) IS NOT NULL,
  'activate_ai_embedding_generation() should exist'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.activate_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'anon should not execute activate_ai_embedding_generation()'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.activate_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated should not execute activate_ai_embedding_generation()'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.activate_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid,timestamp with time zone)',
    'EXECUTE'
  ),
  'service_role should execute activate_ai_embedding_generation()'
);

-- 실패 cleanup 전용 RPC가 예상한 시그니처로 생성되었는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.delete_inactive_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid)'
  ) IS NOT NULL,
  'delete_inactive_ai_embedding_generation() should exist'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.delete_inactive_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'anon should not execute delete_inactive_ai_embedding_generation()'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.delete_inactive_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'authenticated should not execute delete_inactive_ai_embedding_generation()'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.delete_inactive_ai_embedding_generation(uuid,text,uuid,uuid,text,uuid)',
    'EXECUTE'
  ),
  'service_role should execute delete_inactive_ai_embedding_generation()'
);


-- =========================================
-- Complete generation activation
-- =========================================

-- chunk_count와 실제 chunk_index 구성이 완전한 새 generation은
-- 오류 없이 활성화할 수 있어야 합니다.
SELECT lives_ok(
  format(
    $sql$
      SELECT public.activate_ai_embedding_generation(
        '%s'::uuid,
        'note',
        '%s'::uuid,
        '%s'::uuid,
        'rag_note_content',
        '%s'::uuid,
        '%s'::timestamptz
      );
    $sql$,
    current_setting('test.ai_activation_user_id'),
    current_setting('test.ai_activation_source_id'),
    current_setting('test.ai_activation_model_b_id'),
    current_setting('test.ai_activation_new_generation_id'),
    current_setting('test.ai_activation_source_updated_at')
  ),
  'complete generation should be activated'
);

-- 활성 generation 포인터가 새 generation으로 변경되는지 검증합니다.
SELECT is(
  (
    SELECT active_generation_id
    FROM public.ai_embedding_active_generations
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND input_kind = 'rag_note_content'
  ),
  current_setting('test.ai_activation_new_generation_id')::uuid,
  'active generation should switch to the new generation'
);

-- 모델이 변경된 generation을 활성화하면
-- active_model_config_id도 새 모델로 변경되어야 합니다.
SELECT is(
  (
    SELECT active_model_config_id
    FROM public.ai_embedding_active_generations
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND input_kind = 'rag_note_content'
  ),
  current_setting('test.ai_activation_model_b_id')::uuid,
  'active model should switch with the new generation'
);

-- 활성화 성공 이후 직전 활성 generation만 정리되어야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.ai_embeddings
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND model_config_id =
        current_setting('test.ai_activation_model_a_id')::uuid
      AND input_kind = 'rag_note_content'
      AND generation_id =
        current_setting('test.ai_activation_old_generation_id')::uuid
  ),
  0::bigint,
  'previous active generation should be deleted after activation'
);

-- 새로 활성화된 generation의 모든 chunk는 그대로 유지되어야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.ai_embeddings
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND model_config_id =
        current_setting('test.ai_activation_model_b_id')::uuid
      AND input_kind = 'rag_note_content'
      AND generation_id =
        current_setting('test.ai_activation_new_generation_id')::uuid
  ),
  2::bigint,
  'new active generation chunks should remain after activation'
);

-- =========================================
-- Stale source generation rejection
-- =========================================

-- Note가 embedding 작업 시작 이후 다시 수정된 상황을 가정하여,
-- 현재 Note updated_at과 다른 오래된 version token으로 activation을 시도합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.activate_ai_embedding_generation(
        '%s'::uuid,
        'note',
        '%s'::uuid,
        '%s'::uuid,
        'rag_note_content',
        '%s'::uuid,
        '2000-01-01T00:00:00+00'::timestamptz
      );
    $sql$,
    current_setting('test.ai_activation_user_id'),
    current_setting('test.ai_activation_source_id'),
    current_setting('test.ai_activation_model_b_id'),
    current_setting('test.ai_activation_new_generation_id')
  ),
  '40001',
  NULL,
  'stale source version should not be activated'
);

-- =========================================
-- Inactive generation cleanup
-- =========================================

-- 현재 active generation과 별개로 cleanup 대상이 될
-- 완성된 비활성 generation을 준비합니다.
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
  generation_id
)
VALUES
(
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_b_id')::uuid,
  'rag_note_content',
  'cleanup-generation-chunk-0',
  'cleanup-generation-input-0',
  'cleanup generation chunk 0',
  'cleanup generation chunk 0',
  (
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  0,
  2,
  current_setting('test.ai_activation_cleanup_generation_id')::uuid
),
(
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_b_id')::uuid,
  'rag_note_content',
  'cleanup-generation-chunk-1',
  'cleanup-generation-input-1',
  'cleanup generation chunk 1',
  'cleanup generation chunk 1',
  (
    '[0,1,'
    || array_to_string(array_fill(0, ARRAY[1534]), ',')
    || ']'
  )::extensions.vector,
  1,
  2,
  current_setting('test.ai_activation_cleanup_generation_id')::uuid
);

-- active가 아닌 generation은 cleanup RPC로 전체 chunk를 삭제할 수 있어야 합니다.
SELECT is(
  public.delete_inactive_ai_embedding_generation(
    current_setting('test.ai_activation_user_id')::uuid,
    'note',
    current_setting('test.ai_activation_source_id')::uuid,
    current_setting('test.ai_activation_model_b_id')::uuid,
    'rag_note_content',
    current_setting('test.ai_activation_cleanup_generation_id')::uuid
  ),
  2,
  'inactive generation cleanup should delete all generation chunks'
);

-- cleanup 이후 비활성 generation의 row가 남지 않아야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.ai_embeddings
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND model_config_id =
        current_setting('test.ai_activation_model_b_id')::uuid
      AND input_kind = 'rag_note_content'
      AND generation_id =
        current_setting('test.ai_activation_cleanup_generation_id')::uuid
  ),
  0::bigint,
  'inactive generation chunks should be removed after cleanup'
);

-- 현재 active generation을 cleanup 대상으로 전달하더라도
-- 어떤 chunk도 삭제해서는 안 됩니다.
SELECT is(
  public.delete_inactive_ai_embedding_generation(
    current_setting('test.ai_activation_user_id')::uuid,
    'note',
    current_setting('test.ai_activation_source_id')::uuid,
    current_setting('test.ai_activation_model_b_id')::uuid,
    'rag_note_content',
    current_setting('test.ai_activation_new_generation_id')::uuid
  ),
  0,
  'active generation cleanup should delete no chunks'
);

-- cleanup 시도가 있었더라도 active generation의 모든 chunk는 유지되어야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.ai_embeddings
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND model_config_id =
        current_setting('test.ai_activation_model_b_id')::uuid
      AND input_kind = 'rag_note_content'
      AND generation_id =
        current_setting('test.ai_activation_new_generation_id')::uuid
  ),
  2::bigint,
  'active generation chunks should remain after cleanup attempt'
);

-- cleanup 시도는 active pointer 자체에도 영향을 주지 않아야 합니다.
SELECT is(
  (
    SELECT active_generation_id
    FROM public.ai_embedding_active_generations
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND input_kind = 'rag_note_content'
  ),
  current_setting('test.ai_activation_new_generation_id')::uuid,
  'active generation pointer should remain after cleanup attempt'
);


-- =========================================
-- Incomplete generation rejection
-- =========================================

-- chunk_count = 2지만 chunk_index = 0 하나만 존재하는
-- 불완전 generation을 준비합니다.
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
  generation_id
)
VALUES (
  current_setting('test.ai_activation_user_id')::uuid,
  'note',
  current_setting('test.ai_activation_source_id')::uuid,
  current_setting('test.ai_activation_model_b_id')::uuid,
  'rag_note_content',
  'incomplete-generation-chunk-0',
  'incomplete-generation-input-0',
  'incomplete generation chunk 0',
  'incomplete generation chunk 0',
  (
    '[1,'
    || array_to_string(array_fill(0, ARRAY[1535]), ',')
    || ']'
  )::extensions.vector,
  0,
  2,
  current_setting('test.ai_activation_incomplete_generation_id')::uuid
);

-- 전체 chunk가 준비되지 않은 generation은 활성화할 수 없어야 합니다.
SELECT throws_ok(
  format(
    $sql$
      SELECT public.activate_ai_embedding_generation(
        '%s'::uuid,
        'note',
        '%s'::uuid,
        '%s'::uuid,
        'rag_note_content',
        '%s'::uuid,
        '%s'::timestamptz
      );
    $sql$,
    current_setting('test.ai_activation_user_id'),
    current_setting('test.ai_activation_source_id'),
    current_setting('test.ai_activation_model_b_id'),
    current_setting('test.ai_activation_incomplete_generation_id'),
    current_setting('test.ai_activation_source_updated_at')
  ),
  '23514',
  NULL,
  'incomplete generation should not be activated'
);

-- 활성화 실패 후에도 기존 활성 generation 포인터는
-- 직전에 성공적으로 활성화된 generation을 계속 가리켜야 합니다.
SELECT is(
  (
    SELECT active_generation_id
    FROM public.ai_embedding_active_generations
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND input_kind = 'rag_note_content'
  ),
  current_setting('test.ai_activation_new_generation_id')::uuid,
  'failed activation should preserve the current active generation'
);

-- 모델 포인터 역시 실패한 activation 때문에 변경되면 안 됩니다.
SELECT is(
  (
    SELECT active_model_config_id
    FROM public.ai_embedding_active_generations
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND input_kind = 'rag_note_content'
  ),
  current_setting('test.ai_activation_model_b_id')::uuid,
  'failed activation should preserve the current active model'
);

-- activation 실패 시 현재 활성 generation의 chunk도 삭제되지 않아야 합니다.
SELECT is(
  (
    SELECT count(*)
    FROM public.ai_embeddings
    WHERE owner_user_id =
      current_setting('test.ai_activation_user_id')::uuid
      AND source_type = 'note'
      AND source_id =
        current_setting('test.ai_activation_source_id')::uuid
      AND model_config_id =
        current_setting('test.ai_activation_model_b_id')::uuid
      AND input_kind = 'rag_note_content'
      AND generation_id =
        current_setting('test.ai_activation_new_generation_id')::uuid
  ),
  2::bigint,
  'failed activation should preserve current active generation chunks'
);


SELECT * FROM finish();

-- 테스트 fixture를 실제 로컬 DB에 남기지 않습니다.
ROLLBACK;