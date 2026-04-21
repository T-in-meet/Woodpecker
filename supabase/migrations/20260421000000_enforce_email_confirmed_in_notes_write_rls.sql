DROP POLICY IF EXISTS "notes_insert_own" ON "public"."notes";
DROP POLICY IF EXISTS "notes_update_own" ON "public"."notes";
DROP POLICY IF EXISTS "notes_delete_own" ON "public"."notes";

CREATE OR REPLACE FUNCTION "public"."is_current_user_email_confirmed"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "auth"."users"
    WHERE "id" = "auth"."uid"()
      AND "email_confirmed_at" IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION "public"."is_current_user_email_confirmed"() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION "public"."is_current_user_email_confirmed"() TO authenticated;

CREATE POLICY "notes_insert_own"
ON "public"."notes"
FOR INSERT
TO "authenticated"
WITH CHECK (
  ("auth"."uid"() = "user_id")
  AND "public"."is_current_user_email_confirmed"()
);

CREATE POLICY "notes_update_own"
ON "public"."notes"
FOR UPDATE
TO "authenticated"
USING (
  ("auth"."uid"() = "user_id")
  AND "public"."is_current_user_email_confirmed"()
)
WITH CHECK (
  ("auth"."uid"() = "user_id")
  AND "public"."is_current_user_email_confirmed"()
);

CREATE POLICY "notes_delete_own"
ON "public"."notes"
FOR DELETE
TO "authenticated"
USING (
  ("auth"."uid"() = "user_id")
  AND "public"."is_current_user_email_confirmed"()
);
