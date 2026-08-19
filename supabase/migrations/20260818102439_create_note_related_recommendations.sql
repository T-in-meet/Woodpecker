-- ============================================================================
-- Related Notes
-- ============================================================================

/*
 * Note 사이의 Related Notes 관계를 개별 row 단위로 저장합니다.
 *
 * 기존의 추천 결과 JSON snapshot 방식과 달리 하나의 관련 Note 관계를
 * 하나의 row로 관리하여 다음 동작을 지원합니다.
 *
 * - 사용자가 직접 관련 Note를 연결할 수 있습니다.
 * - AI가 생성한 추천과 사용자가 직접 생성한 관계를 구분할 수 있습니다.
 * - AI 추천만 선택적으로 갱신할 수 있습니다.
 * - 사용자가 거부한 AI 추천을 dismissed 상태로 보존할 수 있습니다.
 *
 * note_id는 Related Notes를 보유하는 기준 Note이며,
 * related_note_id는 해당 Note와 연결된 Related Note입니다.
 *
 * 두 Note 중 하나라도 삭제되면 관계 역시 더 이상 유효하지 않으므로
 * 두 Foreign Key 모두 ON DELETE CASCADE를 사용합니다.
 */
CREATE TABLE IF NOT EXISTS "public"."note_related_notes" (
    "note_id" uuid
        NOT NULL
        REFERENCES "public"."notes"("id")
        ON DELETE CASCADE,

    "related_note_id" uuid
        NOT NULL
        REFERENCES "public"."notes"("id")
        ON DELETE CASCADE,

    /*
     * 관계가 생성된 출처입니다.
     *
     * manual:
     * 사용자가 직접 생성한 관계입니다.
     *
     * ai:
     * Related Notes 추천 실행을 통해 생성된 관계입니다.
     */
    "origin" text
        NOT NULL,

    /*
     * 현재 관계의 상태입니다.
     *
     * active:
     * 현재 Related Notes로 표시되는 관계입니다.
     *
     * dismissed:
     * 사용자가 거부한 AI 추천입니다.
     * 화면에는 표시하지 않으며 이후 추천 검색에서도 제외합니다.
     *
     * 사용자가 직접 생성한 manual 관계는 거부 상태를 보존할 필요가 없으므로
     * 삭제 시 row 자체를 삭제합니다.
     */
    "status" text
        NOT NULL
        DEFAULT 'active',

    /*
     * 관계 생성 과정에서 발생하는 가변적인 부가 정보를 저장합니다.
     *
     * AI 추천의 reason, rank 등 추천 결과에 종속되는 정보는
     * 별도 컬럼으로 고정하지 않고 metadata에 저장하여
     * 향후 필드 확장 시 불필요한 schema migration을 줄입니다.
     *
     * manual 관계는 기본적으로 빈 객체를 사용합니다.
     */
    "metadata" jsonb
        NOT NULL
        DEFAULT '{}'::jsonb,

    "created_at" timestamp with time zone
        DEFAULT "now"()
        NOT NULL,

    "updated_at" timestamp with time zone
        DEFAULT "now"()
        NOT NULL,

    /*
     * 동일한 기준 Note와 Related Note 사이에는 하나의 관계만 존재합니다.
     *
     * AI가 이미 추천한 Note를 사용자가 직접 연결하는 경우에도
     * 중복 row를 만들지 않고 기존 관계를 manual로 전환할 수 있습니다.
     */
    CONSTRAINT "note_related_notes_pkey"
        PRIMARY KEY (
            "note_id",
            "related_note_id"
        ),

    /*
     * 자기 자신을 Related Note로 연결할 수 없습니다.
     */
    CONSTRAINT "note_related_notes_not_self_check"
        CHECK (
            "note_id" <> "related_note_id"
        ),

    /*
     * 현재 지원하는 관계 생성 출처만 허용합니다.
     */
    CONSTRAINT "note_related_notes_origin_check"
        CHECK (
            "origin" IN (
                'manual',
                'ai'
            )
        ),

    /*
     * 현재 지원하는 관계 상태만 허용합니다.
     */
    CONSTRAINT "note_related_notes_status_check"
        CHECK (
            "status" IN (
                'active',
                'dismissed'
            )
        ),

    /*
     * dismissed 상태는 AI 추천에만 사용합니다.
     *
     * manual 관계는 사용자가 제거할 경우 실제 row를 삭제하므로
     * manual + dismissed 조합이 저장되는 것을 방지합니다.
     */
    CONSTRAINT "note_related_notes_dismissed_origin_check"
        CHECK (
            "status" <> 'dismissed'
            OR "origin" = 'ai'
        ),

    /*
     * metadata는 항상 JSON object여야 합니다.
     */
    CONSTRAINT "note_related_notes_metadata_object_check"
        CHECK (
            jsonb_typeof("metadata") = 'object'
        )
);


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE "public"."note_related_notes" IS
    'Note 사이의 Related Notes 관계를 저장합니다. 사용자 직접 연결과 AI 추천 및 AI 추천 거부 상태를 구분합니다.';

COMMENT ON COLUMN "public"."note_related_notes"."note_id" IS
    'Related Notes를 보유하는 기준 Note ID입니다.';

COMMENT ON COLUMN "public"."note_related_notes"."related_note_id" IS
    '기준 Note와 연결된 Related Note ID입니다.';

COMMENT ON COLUMN "public"."note_related_notes"."origin" IS
    '관계 생성 출처입니다. manual은 사용자 직접 연결, ai는 Related Notes 추천으로 생성된 관계입니다.';

COMMENT ON COLUMN "public"."note_related_notes"."status" IS
    '관계 상태입니다. active는 현재 표시되는 관계, dismissed는 사용자가 거부하여 이후 AI 추천에서도 제외할 관계입니다.';

COMMENT ON COLUMN "public"."note_related_notes"."metadata" IS
    'AI 추천 reason, rank 등 관계에 대한 가변적인 부가 정보를 저장하는 JSON object입니다.';


-- ============================================================================
-- Indexes
-- ============================================================================

/*
 * Related Notes 조회 및 AI 추천 재생성 시
 * 기준 Note별 origin/status 필터링을 지원합니다.
 *
 * 다음과 같은 조회에 사용됩니다.
 *
 * - 현재 active Related Notes 조회
 * - 기존 AI 추천 조회/교체
 * - dismissed AI 추천 ID 조회
 */
CREATE INDEX "note_related_notes_note_origin_status_idx"
    ON "public"."note_related_notes" (
        "note_id",
        "origin",
        "status"
    );

/*
 * related_note_id를 기준으로 관계를 조회해야 하는 경우를 지원합니다.
 *
 * Foreign Key의 ON DELETE CASCADE 처리에서도 related_note_id 조회에
 * 사용할 수 있도록 별도 index를 둡니다.
 */
CREATE INDEX "note_related_notes_related_note_id_idx"
    ON "public"."note_related_notes" (
        "related_note_id"
    );


-- ============================================================================
-- Updated At Trigger
-- ============================================================================

/*
 * 관계의 origin, status, metadata 등이 변경될 때
 * updated_at을 자동으로 현재 시각으로 변경합니다.
 *
 * 프로젝트 공통 update_updated_at_column trigger function을 재사용합니다.
 */
CREATE OR REPLACE TRIGGER "tr_note_related_notes_updated_at"
    BEFORE UPDATE
    ON "public"."note_related_notes"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


-- ============================================================================
-- Row Level Security
-- ============================================================================

/*
 * Related Notes는 기준 Note(note_id)의 소유권을 기준으로 조회를 제한합니다.
 *
 * authenticated 사용자는 자신의 Note에 연결된 Related Notes만
 * 직접 조회할 수 있습니다.
 *
 * 생성/수정/삭제는 애플리케이션 서버의 service_role 경로에서 수행하며,
 * 해당 쓰기 계층에서 note_id와 related_note_id 모두 같은 사용자의
 * Note인지 검증합니다.
 */
ALTER TABLE "public"."note_related_notes"
    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_related_notes_select_own"
    ON "public"."note_related_notes"
    FOR SELECT
    TO "authenticated"
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."notes"
            WHERE "notes"."id" =
                    "note_related_notes"."note_id"
              AND "notes"."user_id" = "auth"."uid"()
        )
    );


-- ============================================================================
-- Table Permissions
-- ============================================================================

/*
 * anon에는 어떤 권한도 부여하지 않습니다.
 *
 * authenticated는 RLS를 통과한 자신의 Related Notes만 조회할 수 있습니다.
 *
 * INSERT/UPDATE/DELETE는 Related Notes 서버 실행 계층 및
 * 사용자 수동 연결/삭제 Server Action에서 service_role을 통해 수행합니다.
 */
REVOKE ALL
ON TABLE "public"."note_related_notes"
FROM "anon", "authenticated";

GRANT SELECT
ON TABLE "public"."note_related_notes"
TO "authenticated";

GRANT ALL
ON TABLE "public"."note_related_notes"
TO "service_role";
