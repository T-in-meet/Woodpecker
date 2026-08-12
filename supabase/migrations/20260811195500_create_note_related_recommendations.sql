CREATE TABLE IF NOT EXISTS "public"."note_related_recommendations" (
  "note_id" uuid PRIMARY KEY REFERENCES "public"."notes"("id") ON DELETE CASCADE,
  "recommendations" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "note_related_recommendations_recommendations_array_check"
    CHECK (jsonb_typeof("recommendations") = 'array')
);

CREATE OR REPLACE TRIGGER "tr_note_related_recommendations_updated_at"
  BEFORE UPDATE ON "public"."note_related_recommendations"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."note_related_recommendations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_related_recommendations_select_own"
  ON "public"."note_related_recommendations"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."notes"
      WHERE "notes"."id" = "note_related_recommendations"."note_id"
        AND "notes"."user_id" = "auth"."uid"()
    )
  );

REVOKE ALL ON TABLE "public"."note_related_recommendations"
  FROM "anon", "authenticated";

GRANT SELECT ON TABLE "public"."note_related_recommendations"
  TO "authenticated";

GRANT ALL ON TABLE "public"."note_related_recommendations"
  TO "service_role";
