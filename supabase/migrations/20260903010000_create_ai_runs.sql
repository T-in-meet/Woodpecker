-- AI 기능의 공통 실행 이력을 저장합니다.
-- Execution Claim은 실행 제어·중복 방지·쿼터를 담당하고,
-- ai_runs는 실제 AI 실행 이력과 이후 분석에 필요한 Snapshot을 보존하는 역할만 담당합니다.
CREATE TABLE "public"."ai_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,

    -- 실행 주체 사용자입니다. 사용자가 삭제되면 해당 사용자의 실행 이력도 함께 삭제합니다.
    "user_id" "uuid" NOT NULL,

    -- 실행된 AI 기능을 식별합니다.
    -- 실제 프로젝트의 기능 식별 명칭을 사용하며 PostgreSQL enum 대신 text + CHECK로 제한합니다.
    "feature_type" "text" NOT NULL,

    -- 해당 Run이 생성한 사용자 노출 결과 row의 ID를 저장합니다.
    -- Related Notes처럼 한 번의 실행에서 여러 결과가 생성될 수 있으므로 uuid[]를 사용합니다.
    -- AI 실행 성공과 이후 결과 저장 성공은 별개의 관심사이므로 빈 배열도 유효합니다.
    "feature_result_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,

    -- AI Run의 현재 상태입니다.
    -- running은 비종료 상태이며 succeeded, failed, stale은 종료 상태입니다.
    "status" "text" DEFAULT 'running'::"text" NOT NULL,

    -- 기능별 AI 실행 과정에서 확보된 입력·설정·중간 결과·출력·실패 정보를 저장합니다.
    -- 여러 단계 Snapshot을 하나의 최상위 JSON object 컨테이너 안에 보존합니다.
    -- 기능별 세부 구조는 애플리케이션의 Snapshot Schema에서 검증하며,
    -- DB에서는 최상위 JSON object 여부만 검증합니다.
    "snapshots" "jsonb" NOT NULL,

    -- 실제 AI 실행이 시작된 시각입니다.
    -- DB row 생성 시각과 구분하기 위해 기본값을 두지 않습니다.
    "started_at" timestamp with time zone NOT NULL,

    -- Run이 succeeded, failed 또는 stale 상태로 종료된 시각입니다.
    -- running 상태에서는 반드시 NULL이어야 합니다.
    "completed_at" timestamp with time zone,

    -- ai_runs row가 DB에 생성된 시각입니다.
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "ai_runs_pkey"
        PRIMARY KEY ("id"),

    -- ai_runs에서 추적하는 AI 기능만 허용합니다.
    CONSTRAINT "ai_runs_feature_type_check"
        CHECK ("feature_type" IN (
            'note-chat',
            'related-notes',
            'quiz-generation',
            'review-grading'
        )),

    -- 공통 AI Run lifecycle에서 정의한 상태만 허용합니다.
    CONSTRAINT "ai_runs_status_check"
        CHECK ("status" IN (
            'running',
            'succeeded',
            'failed',
            'stale'
        )),

    -- running은 아직 종료되지 않은 상태이므로 completed_at이 없어야 하며,
    -- 모든 종료 상태는 종료 시각을 반드시 가져야 합니다.
    CONSTRAINT "ai_runs_status_completed_at_check"
        CHECK (
            (
                "status" = 'running'
                AND "completed_at" IS NULL
            )
            OR (
                "status" IN ('succeeded', 'failed', 'stale')
                AND "completed_at" IS NOT NULL
            )
        ),

    -- 종료 시각이 존재하는 경우 실제 실행 시작 시각보다 빠를 수 없습니다.
    CONSTRAINT "ai_runs_completed_at_order_check"
        CHECK (
            "completed_at" IS NULL
            OR "completed_at" >= "started_at"
        ),

    -- 기능별 Snapshot 구조는 애플리케이션에서 검증하고,
    -- DB에서는 Snapshot 전체가 JSON object인지 여부만 보장합니다.
    CONSTRAINT "ai_runs_snapshots_object_check"
        CHECK (jsonb_typeof("snapshots") = 'object')
);

-- 실행 이력은 사용자에게 귀속되며 사용자 삭제 시 함께 정리합니다.
ALTER TABLE ONLY "public"."ai_runs"
    ADD CONSTRAINT "ai_runs_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "auth"."users"("id")
    ON DELETE CASCADE;

-- 관리자 실행 이력 화면에서 전체 Run을 최신 실행순으로 조회하기 위한 인덱스입니다.
CREATE INDEX "ai_runs_started_at_idx"
    ON "public"."ai_runs" ("started_at" DESC);

-- 특정 사용자의 Run을 최신 실행순으로 조회하기 위한 인덱스입니다.
CREATE INDEX "ai_runs_user_started_at_idx"
    ON "public"."ai_runs" ("user_id", "started_at" DESC);

-- 특정 AI 기능의 Run을 최신 실행순으로 조회하기 위한 인덱스입니다.
CREATE INDEX "ai_runs_feature_type_started_at_idx"
    ON "public"."ai_runs" ("feature_type", "started_at" DESC);

-- 사용자 노출 결과 row ID를 기준으로 해당 결과를 생성한 Run을 역조회하기 위한 인덱스입니다.
CREATE INDEX "ai_runs_feature_result_ids_idx"
    ON "public"."ai_runs"
    USING "gin" ("feature_result_ids");

-- 비정상 종료 후 running 상태에 남은 Run을 stale 후보로 탐색하기 위한 부분 인덱스입니다.
CREATE INDEX "ai_runs_running_started_at_idx"
    ON "public"."ai_runs" ("started_at")
    WHERE "status" = 'running';

-- ai_runs에는 내부 Prompt, 입력, Retrieval 결과, Provider 응답 등
-- 일반 사용자에게 직접 노출하면 안 되는 실행 정보가 포함될 수 있으므로 RLS를 활성화합니다.
ALTER TABLE "public"."ai_runs"
    ENABLE ROW LEVEL SECURITY;

-- ai_runs는 일반 클라이언트에서 직접 접근하지 않고 신뢰된 서버 경로에서만 사용합니다.
-- anon/authenticated의 table privilege를 제거하고 service_role에만 직접 접근 권한을 부여합니다.
REVOKE ALL ON TABLE "public"."ai_runs" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."ai_runs" TO "service_role";

COMMENT ON TABLE "public"."ai_runs" IS
    'AI 기능의 공통 실행 이력입니다. Execution Claim과 분리하여 실행 상태와 기능별 Snapshot을 보존합니다.';

COMMENT ON COLUMN "public"."ai_runs"."id" IS
    'AI Run 자체를 식별하는 독립 UUID입니다.';

COMMENT ON COLUMN "public"."ai_runs"."user_id" IS
    'AI Run을 실행한 사용자 ID입니다.';

COMMENT ON COLUMN "public"."ai_runs"."feature_type" IS
    'AI Run이 수행한 기능의 식별값입니다.';

COMMENT ON COLUMN "public"."ai_runs"."feature_result_ids" IS
    '해당 Run이 생성한 사용자 노출 결과 row의 UUID 목록입니다. 결과 저장 여부와 AI 실행 성공 여부는 분리되므로 빈 배열도 유효합니다.';

COMMENT ON COLUMN "public"."ai_runs"."status" IS
    'AI Run의 lifecycle 상태입니다. running, succeeded, failed, stale 중 하나입니다.';

COMMENT ON COLUMN "public"."ai_runs"."snapshots" IS
    'AI 실행 중 실제 확보된 입력, 설정, 중간 결과, 출력, 실패 정보를 기능별 Snapshot Schema 구조의 단일 JSON object 컨테이너로 저장합니다.';

COMMENT ON COLUMN "public"."ai_runs"."started_at" IS
    '실제 AI 실행이 시작된 시각입니다.';

COMMENT ON COLUMN "public"."ai_runs"."completed_at" IS
    'AI Run이 종료 상태로 확정된 시각입니다. running 상태에서는 NULL입니다.';

COMMENT ON COLUMN "public"."ai_runs"."created_at" IS
    'ai_runs row가 DB에 생성된 시각입니다.';
