CREATE OR REPLACE FUNCTION public.finalize_ai_run(
    p_run_id uuid,
    p_user_id uuid,
    p_feature_type text,
    p_started_at timestamptz,
    p_terminal_status text,
    p_completed_at timestamptz,
    p_snapshots jsonb,
    p_feature_result_ids uuid[]
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid;
    current_feature_type text;
    current_status text;
BEGIN
    IF p_terminal_status NOT IN ('succeeded', 'failed') THEN
        RAISE EXCEPTION 'invalid AI Run terminal status';
    END IF;

    /*
     * Create persistence가 확립되지 않은 경우를 복구한다.
     *
     * 동일 Run ID가 이미 존재하면 아무것도 덮어쓰지 않고
     * 아래 lifecycle 판정으로 넘어간다.
     */
    INSERT INTO public.ai_runs (
        id,
        user_id,
        feature_type,
        feature_result_ids,
        status,
        snapshots,
        started_at,
        completed_at
    )
    VALUES (
        p_run_id,
        p_user_id,
        p_feature_type,
        COALESCE(p_feature_result_ids, '{}'::uuid[]),
        p_terminal_status,
        p_snapshots,
        p_started_at,
        p_completed_at
    )
    ON CONFLICT (id) DO NOTHING;

    IF FOUND THEN
        RETURN 'inserted';
    END IF;

    /*
     * 기존 row를 lock한 상태에서 identity와 lifecycle을 판정한다.
     * stale sweeper 또는 다른 terminal finalizer와 경쟁하더라도
     * 이미 확립된 terminal 상태를 덮어쓰지 않는다.
     */
    SELECT
        user_id,
        feature_type,
        status
    INTO
        current_user_id,
        current_feature_type,
        current_status
    FROM public.ai_runs
    WHERE id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        /*
         * ON CONFLICT 이후 row가 사라지는 비정상적인 경쟁 상태에서는
         * 기존 값을 추정하거나 별도 복구를 수행하지 않는다.
         */
        RETURN 'conflict';
    END IF;

    IF current_user_id <> p_user_id
       OR current_feature_type <> p_feature_type THEN
        RETURN 'conflict';
    END IF;

    IF current_status = 'running' THEN
        UPDATE public.ai_runs
        SET
            feature_result_ids =
                COALESCE(p_feature_result_ids, '{}'::uuid[]),
            status = p_terminal_status,
            snapshots = p_snapshots,
            completed_at = p_completed_at
        WHERE id = p_run_id
          AND user_id = p_user_id
          AND feature_type = p_feature_type
          AND status = 'running';

        IF FOUND THEN
            RETURN 'updated';
        END IF;

        RETURN 'conflict';
    END IF;

    IF current_status = p_terminal_status THEN
        /*
         * 첫 요청 commit 뒤 response가 유실되어 같은 finalize가
         * 재호출된 경우 기존 terminal 데이터를 덮어쓰지 않는다.
         */
        RETURN 'already_terminal';
    END IF;

    /*
     * stale 또는 다른 terminal 상태는 late finalizer가 덮어쓰지 않는다.
     */
    RETURN 'conflict';
END;
$$;

REVOKE ALL
ON FUNCTION public.finalize_ai_run(
    uuid,
    uuid,
    text,
    timestamptz,
    text,
    timestamptz,
    jsonb,
    uuid[]
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.finalize_ai_run(
    uuid,
    uuid,
    text,
    timestamptz,
    text,
    timestamptz,
    jsonb,
    uuid[]
)
TO service_role;