-- 사용자 피드백 제출 테이블
-- 로그인 사용자가 의견/버그/개선요청을 남기면 저장한다.
-- 관리자 조회/상태 변경은 createAdminClient(RLS 우회)로 처리하므로
-- 여기서는 사용자 본인 insert/select 정책만 정의한다.

CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "note_id" "uuid",
    "category" character varying(20) NOT NULL,
    "title" character varying(100) NOT NULL,
    "content" "text" NOT NULL,
    "image_urls" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['BUG'::character varying, 'FEATURE'::character varying, 'ETC'::character varying])::"text"[]))),
    CONSTRAINT "feedback_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['OPEN'::character varying, 'RESOLVED'::character varying])::"text"[])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE SET NULL;


CREATE INDEX "feedback_user_id_idx" ON "public"."feedback" USING "btree" ("user_id");


CREATE INDEX "feedback_status_created_at_idx" ON "public"."feedback" USING "btree" ("status", "created_at" DESC);


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_insert_own" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));


CREATE POLICY "feedback_select_own" ON "public"."feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));


GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";
