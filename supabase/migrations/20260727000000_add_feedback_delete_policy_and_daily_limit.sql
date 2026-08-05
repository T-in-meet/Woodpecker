-- 사용자 피드백 삭제 정책, 하루 1개 제출 제한, updated_at 트리거 (#266)
--
-- 삭제 정책:
--   관리자 답변(feedback_replies)이 달리기 전까지만 본인 피드백을 삭제할 수 있다.
--   답변이 달린 피드백은 운영 기록 보존을 위해 사용자가 삭제할 수 없다.
--   (스토리지 이미지는 Server Action에서 함께 정리한다.
--    feedbacks 버킷에는 본인 폴더 DELETE 정책이 이미 존재한다.)
--
-- 하루 1개 제한:
--   KST 날짜 기준 사용자당 하루 1건만 제출할 수 있다.
--   Server Action에서 사전 체크로 안내 메시지를 주고,
--   동시 요청 경합은 unique index가 최종적으로 막는다.
--   당일 피드백을 삭제한 경우에는 같은 날 다시 제출할 수 있다.
--   하루 1건 제한이 없던 기간에 쌓인 중복 데이터가 있으면 아래 unique index
--   생성이 unique_violation으로 실패한다. 원인을 바로 알 수 있도록 인덱스
--   생성 전에 중복 여부를 미리 검사해 명확한 에러 메시지로 막는다.

CREATE POLICY "feedbacks_delete_own_before_reply"
    ON "public"."feedbacks"
    FOR DELETE
    TO "authenticated"
    USING (
        "auth"."uid"() = "user_id"
        AND NOT EXISTS (
            SELECT 1
            FROM "public"."feedback_replies"
            WHERE "feedback_replies"."feedback_id" = "feedbacks"."id"
        )
    );


DO $$
DECLARE
    duplicate_count integer;
BEGIN
    SELECT count(*) INTO duplicate_count
    FROM (
        SELECT "user_id", "public"."kst_date"("created_at")
        FROM "public"."feedbacks"
        GROUP BY "user_id", "public"."kst_date"("created_at")
        HAVING count(*) > 1
    ) AS "duplicates";

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            '% 명의 사용자가 하루 1건 제한 도입 전 같은 KST 날짜에 여러 건의 피드백을 남겨 unique index를 생성할 수 없습니다. '
            '중복 행을 정리(삭제 또는 병합)한 뒤 마이그레이션을 다시 실행하세요.',
            duplicate_count;
    END IF;
END $$;

CREATE UNIQUE INDEX "feedbacks_one_per_user_per_kst_day_idx"
    ON "public"."feedbacks"
    USING "btree" ("user_id", "public"."kst_date"("created_at"));


-- feedbacks에는 updated_at 자동 갱신 트리거가 누락되어 있었다.
-- 관리자가 상태를 변경(OPEN → RESOLVED)할 때 updated_at이 갱신되도록 추가한다.
CREATE OR REPLACE TRIGGER "tr_feedbacks_updated_at"
    BEFORE UPDATE ON "public"."feedbacks"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();
