begin;

select plan(7);

--------------------------------------------------------------------------------
-- Fixtures
--------------------------------------------------------------------------------

insert into public.ai_settings (
  id,
  key,
  display_name,
  description,
  created_at,
  updated_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  'test-ai-setting',
  'Test AI Setting',
  'AI 설정 DB 테스트용 데이터입니다.',
  '2000-01-01 00:00:00+00',
  '2000-01-01 00:00:00+00'
);

--------------------------------------------------------------------------------
-- ai_settings
--------------------------------------------------------------------------------

select is(
  (
    select display_name
    from public.ai_settings
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'Test AI Setting',
  'ai_settings에 AI 설정을 생성할 수 있다'
);


select throws_ok(
  $$
    insert into public.ai_settings (
      key,
      display_name,
      description
    )
    values (
      'test-ai-setting',
      'Duplicate AI Setting',
      '중복 key 테스트입니다.'
    )
  $$,
  '23505',
  null,
  'ai_settings.key는 중복될 수 없다'
);


update public.ai_settings
set display_name = 'Updated AI Setting'
where id = '11111111-1111-4111-8111-111111111111';

select ok(
  (
    select updated_at > '2000-01-01 00:00:00+00'::timestamptz
    from public.ai_settings
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'ai_settings 수정 시 updated_at이 자동 갱신된다'
);

--------------------------------------------------------------------------------
-- ai_setting_configurations
--------------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.ai_setting_configurations (
      id,
      setting_id,
      role_key,
      kind,
      model_config_id
    )
    values (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'primary-embedding',
      'embedding',
      (
        select id
        from public.ai_model_configs
        where provider = 'openai'
          and model = 'text-embedding-3-small'
          and capability = 'embedding'
        limit 1
      )
    )
  $$,
  'AI 설정에 Embedding 구성을 생성할 수 있다'
);

select is(
  (
    select sort_order
    from public.ai_setting_configurations
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  0,
  'AI 구성의 sort_order 기본값은 0이다'
);


select throws_ok(
  $$
    insert into public.ai_setting_configurations (
      setting_id,
      role_key,
      kind,
      model_config_id
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      'primary-embedding',
      'embedding',
      (
        select id
        from public.ai_model_configs
        where provider = 'openai'
          and model = 'text-embedding-3-small'
          and capability = 'embedding'
        limit 1
      )
    )
  $$,
  '23503',
  null,
  '존재하지 않는 AI 설정에는 구성을 생성할 수 없다'
);


delete from public.ai_settings
where id = '11111111-1111-4111-8111-111111111111';

select is(
  (
    select count(*)
    from public.ai_setting_configurations
    where id = '22222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'AI 설정 삭제 시 연결된 AI 구성도 함께 삭제된다'
);


select * from finish();

rollback;
