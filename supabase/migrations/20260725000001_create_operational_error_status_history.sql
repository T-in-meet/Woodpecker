-- Status change history for operational errors.
-- operational_errors keeps the current state; this table preserves the
-- operator actions that led to it.

CREATE TABLE IF NOT EXISTS "public"."operational_error_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operational_error_id" "uuid" NOT NULL,
    "from_status" character varying(20),
    "to_status" character varying(20) NOT NULL,
    "note" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "operational_error_status_history_from_status_check"
        CHECK (
            "from_status" IS NULL
            OR ("from_status")::"text" = ANY ((ARRAY[
                'OPEN'::character varying,
                'RESOLVED'::character varying,
                'IGNORED'::character varying
            ])::"text"[])
        ),

    CONSTRAINT "operational_error_status_history_to_status_check"
        CHECK (("to_status")::"text" = ANY ((ARRAY[
            'OPEN'::character varying,
            'RESOLVED'::character varying,
            'IGNORED'::character varying
        ])::"text"[]))
);


ALTER TABLE "public"."operational_error_status_history" OWNER TO "postgres";


ALTER TABLE ONLY "public"."operational_error_status_history"
    ADD CONSTRAINT "operational_error_status_history_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."operational_error_status_history"
    ADD CONSTRAINT "operational_error_status_history_error_id_fkey"
    FOREIGN KEY ("operational_error_id")
    REFERENCES "public"."operational_errors"("id")
    ON DELETE CASCADE;


ALTER TABLE ONLY "public"."operational_error_status_history"
    ADD CONSTRAINT "operational_error_status_history_changed_by_fkey"
    FOREIGN KEY ("changed_by")
    REFERENCES "auth"."users"("id")
    ON DELETE SET NULL;


CREATE INDEX "operational_error_status_history_error_created_at_idx"
    ON "public"."operational_error_status_history"
    ("operational_error_id", "created_at" DESC);


ALTER TABLE "public"."operational_error_status_history" ENABLE ROW LEVEL SECURITY;


-- No authenticated RLS policy is defined. Application code reads and writes
-- history through trusted server code after explicit admin authorization.


-- Status history may include operator notes, so only trusted server code should
-- use the service role to read or write it.
REVOKE ALL ON TABLE "public"."operational_error_status_history" FROM "anon";
REVOKE ALL ON TABLE "public"."operational_error_status_history" FROM "authenticated";
GRANT ALL ON TABLE "public"."operational_error_status_history" TO "service_role";
