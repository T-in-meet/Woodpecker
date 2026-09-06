/*
 * AI Run을 실제 실행 결과에 따라 succeeded 또는 failed로 최종 확정합니다.
 *
 * create persistence 누락을 복구하고, 동일 Run의 finalize를 직렬화하며,
 * timeout 기반 stale 상태는 늦게 도착한 실제 terminal 결과로 교정합니다.
 * 이미 확립된 succeeded/failed 상태와 Run identity는 덮어쓰지 않습니다.
 */
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
SET search_path = ''
AS $$
DECLARE
    current_user_id uuid;
    current_feature_type text;
    current_status text;
BEGIN
    /*
     * finalize는 실제 실행 결과만 terminal 상태로 확정한다.
     * stale은 sweeper가 timeout을 근거로 설정하는 상태이므로
     * 이 함수의 terminal 입력으로는 허용하지 않는다.
     */
    IF p_terminal_status NOT IN ('succeeded', 'failed') THEN
        RAISE EXCEPTION 'invalid AI Run terminal status';
    END IF;

    /*
     * Create persistence가 확립되지 않은 경우를 terminal payload로 복구한다.
     *
     * AI Run persistence는 best-effort 비동기 작업이므로 create row가 없어도
     * 실제 실행이 완료될 수 있다. 이 경우 finalize가 같은 Run identity로
     * terminal row를 직접 생성해 최종 실행 기록을 보존한다.
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
     * 동일 Run에 대한 sweeper와 여러 finalizer의 lifecycle 판정을 직렬화한다.
     *
     * row lock 이후 확인한 identity와 status만을 기준으로 전이하여
     * 실제 terminal 상태(succeeded/failed)가 한 번 확립된 뒤에는
     * 다른 terminal 결과가 이를 덮어쓰지 못하게 한다.
     *
     * stale은 실제 실행 결과가 아니라 timeout 기반 정리 상태이므로
     * 늦게 도착한 실제 terminal 결과가 이를 교정할 수 있다.
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

    /*
     * Run ID만으로 다른 사용자 또는 다른 기능의 Run을 finalize하지 못하도록
     * 최초 생성 시 확립된 Run identity를 보존한다.
     */
    IF current_user_id <> p_user_id
       OR current_feature_type <> p_feature_type THEN
        RETURN 'conflict';
    END IF;

    /*
     * running은 정상적인 finalize 대상이다.
     *
     * stale은 sweeper가 terminal persistence를 관찰하지 못한 상태일 뿐
     * 실제 실행 실패를 확정한 상태가 아니므로 late finalizer를 허용한다.
     * 이 경우 sweeper가 기록한 stale payload와 completed_at을 보존하지 않고
     * 실제 실행의 terminal payload 전체로 교체한다.
     */
    IF current_status IN ('running', 'stale') THEN
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
          AND status IN ('running', 'stale');

        IF FOUND THEN
            RETURN 'updated';
        END IF;

        /*
         * lock 이후 예상한 lifecycle 조건으로 UPDATE하지 못한 경우에는
         * terminal 데이터를 추정하거나 강제로 덮어쓰지 않는다.
         */
        RETURN 'conflict';
    END IF;

    IF current_status = p_terminal_status THEN
        /*
         * 첫 finalize가 commit된 뒤 response만 유실되면 동일 요청이
         * 재시도될 수 있다. 이미 같은 terminal 상태라면 성공으로 취급하되
         * 최초 확정된 Snapshot, result ID, completed_at은 덮어쓰지 않는다.
         */
        RETURN 'already_terminal';
    END IF;

    /*
     * succeeded와 failed는 실제 실행 결과를 나타내는 확정 terminal 상태다.
     * 서로 다른 terminal 결과가 뒤늦게 도착해도 최초 확정 결과를 보존한다.
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