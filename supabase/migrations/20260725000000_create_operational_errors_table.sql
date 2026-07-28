-- Operational errors captured at explicit, actionable failure points.
-- This table is intentionally feature-agnostic: feature-specific entity IDs
-- should be stored in context JSON until they prove they need first-class
-- filtering or FK constraints.

CREATE TABLE IF NOT EXISTS "public"."operational_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature" character varying(80) NOT NULL,
    "operation" character varying(120) NOT NULL,
    "stage" character varying(120) NOT NULL,
    "error_code" character varying(120) NOT NULL,
    "severity" character varying(10) NOT NULL,
    "status" character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    "message" "text" NOT NULL,
    "user_id" "uuid",
    "actor_user_id" "uuid",
    "fingerprint" "text" NOT NULL,
    "occurrence_count" integer DEFAULT 1 NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "operational_errors_context_object_check"
        CHECK (jsonb_typeof("context") = 'object'),

    CONSTRAINT "operational_errors_message_check"
        CHECK (char_length(btrim("message")) > 0),

    CONSTRAINT "operational_errors_occurrence_count_check"
        CHECK ("occurrence_count" > 0),

    CONSTRAINT "operational_errors_severity_check"
        CHECK (("severity")::"text" = ANY ((ARRAY[
            'INFO'::character varying,
            'WARN'::character varying,
            'ERROR'::character varying
        ])::"text"[])),

    CONSTRAINT "operational_errors_status_check"
        CHECK (("status")::"text" = ANY ((ARRAY[
            'OPEN'::character varying,
            'RESOLVED'::character varying,
            'IGNORED'::character varying
        ])::"text"[]))
);


ALTER TABLE "public"."operational_errors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."operational_errors"
    ADD CONSTRAINT "operational_errors_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."operational_errors"
    ADD CONSTRAINT "operational_errors_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."operational_errors"
    ADD CONSTRAINT "operational_errors_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


ALTER TABLE ONLY "public"."operational_errors"
    ADD CONSTRAINT "operational_errors_resolved_by_fkey"
    FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


CREATE INDEX "operational_errors_status_last_seen_at_idx"
    ON "public"."operational_errors" ("status", "last_seen_at" DESC);


CREATE INDEX "operational_errors_feature_operation_stage_idx"
    ON "public"."operational_errors" ("feature", "operation", "stage");


CREATE INDEX "operational_errors_error_code_idx"
    ON "public"."operational_errors" ("error_code");


CREATE INDEX "operational_errors_user_id_idx"
    ON "public"."operational_errors" ("user_id")
    WHERE "user_id" IS NOT NULL;


CREATE INDEX "operational_errors_actor_user_id_idx"
    ON "public"."operational_errors" ("actor_user_id")
    WHERE "actor_user_id" IS NOT NULL;


CREATE UNIQUE INDEX "operational_errors_open_fingerprint_key"
    ON "public"."operational_errors" ("fingerprint")
    WHERE "status" = 'OPEN';


CREATE OR REPLACE TRIGGER "tr_operational_errors_updated_at"
    BEFORE UPDATE ON "public"."operational_errors"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();


ALTER TABLE "public"."operational_errors" ENABLE ROW LEVEL SECURITY;


-- No authenticated RLS policy is defined. Application code records and manages
-- operational errors through trusted server code after explicit authorization.


GRANT ALL ON TABLE "public"."operational_errors" TO "anon";
GRANT ALL ON TABLE "public"."operational_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."operational_errors" TO "service_role";
