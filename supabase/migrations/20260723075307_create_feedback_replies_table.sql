-- 관리자 피드백 답변 테이블
--
-- 하나의 feedback에는 하나의 관리자 답변만 존재한다.
-- 관리자 생성/수정/삭제는 createAdminClient(RLS 우회)로 처리한다.
-- 일반 사용자는 자신이 작성한 feedback에 연결된 답변만 조회할 수 있다.
--
-- 답변 이미지의 DB 저장값은 전체 URL이 아닌
-- feedback_replies Storage 버킷 내부 경로이다.
--
-- 파일 경로 규칙:
--   {feedback_id}/{파일명}

CREATE TABLE IF NOT EXISTS "public"."feedback_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "title" character varying(100) NOT NULL,
    "content" "text" NOT NULL,
    "image_paths" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "feedback_replies_title_check"
        CHECK (char_length(btrim(("title")::"text")) > 0),

    CONSTRAINT "feedback_replies_content_check"
        CHECK (char_length(btrim("content")) > 0)
);


ALTER TABLE "public"."feedback_replies" OWNER TO "postgres";


ALTER TABLE ONLY "public"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_pkey"
    PRIMARY KEY ("id");


-- feedback 하나당 답변 하나만 허용한다.
ALTER TABLE ONLY "public"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_feedback_id_key"
    UNIQUE ("feedback_id");


-- feedback가 삭제되면 연결된 관리자 답변도 함께 삭제한다.
ALTER TABLE ONLY "public"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_feedback_id_fkey"
    FOREIGN KEY ("feedback_id")
    REFERENCES "public"."feedbacks"("id")
    ON DELETE CASCADE;


-- 답변 작성 관리자는 Supabase Auth 사용자 ID로 저장한다.
--
-- 관리자 계정이 삭제되더라도 기존 답변 기록은 유지해야 하므로
-- ON DELETE RESTRICT를 사용한다.
ALTER TABLE ONLY "public"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_created_by_fkey"
    FOREIGN KEY ("created_by")
    REFERENCES "auth"."users"("id")
    ON DELETE RESTRICT;


-- feedback_id에는 UNIQUE 제약으로 인덱스가 자동 생성된다.
-- 특정 관리자가 작성한 답변 조회를 위해 created_by 인덱스를 추가한다.
CREATE INDEX "feedback_replies_created_by_idx"
    ON "public"."feedback_replies"
    USING "btree" ("created_by");


CREATE OR REPLACE TRIGGER "tr_feedback_replies_updated_at"
    BEFORE UPDATE ON "public"."feedback_replies"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


ALTER TABLE "public"."feedback_replies"
    ENABLE ROW LEVEL SECURITY;


-- 일반 사용자는 자신이 작성한 feedback에 연결된 답변만 조회할 수 있다.
--
-- 관리자 조회는 createAdminClient(service_role)를 사용하므로
-- 별도의 관리자 SELECT 정책은 정의하지 않는다.
CREATE POLICY "feedback_replies_select_own"
    ON "public"."feedback_replies"
    FOR SELECT
    TO "authenticated"
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."feedbacks"
            WHERE "feedbacks"."id" = "feedback_replies"."feedback_id"
              AND "feedbacks"."user_id" = "auth"."uid"()
        )
    );


-- INSERT/UPDATE/DELETE 정책은 정의하지 않는다.
-- 관리자 Server Action에서 createAdminClient를 사용해 RLS를 우회한다.


GRANT ALL ON TABLE "public"."feedback_replies" TO "anon";
GRANT ALL ON TABLE "public"."feedback_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_replies" TO "service_role";
