-- 1:1 문의에 "영역" 축을 추가한다.
--
-- 기존 category는 유형(버그/제안/기타)만 구분해서, 관리자 화면에서 어느 기능의
-- 문제인지 알려면 본문을 열어봐야 했다. category는 그대로 두고 영역을 별도
-- 컬럼으로 분리해, 유형 x 영역 두 축으로 교차 필터할 수 있게 한다.
--
-- 기존 행은 영역을 알 수 없으므로 default 'ETC'로 백필된다.

ALTER TABLE "public"."feedbacks"
  ADD COLUMN IF NOT EXISTS "area" character varying(20) DEFAULT 'ETC'::character varying NOT NULL;

ALTER TABLE "public"."feedbacks"
  DROP CONSTRAINT IF EXISTS "feedbacks_area_check";

ALTER TABLE "public"."feedbacks"
  ADD CONSTRAINT "feedbacks_area_check" CHECK ((("area")::"text" = ANY ((ARRAY[
    'NOTE'::character varying,
    'REVIEW'::character varying,
    'AI'::character varying,
    'NOTIFICATION'::character varying,
    'ACCOUNT'::character varying,
    'ETC'::character varying
  ])::"text"[])));

-- 관리자 목록은 area를 multi-select 필터로 쓰고 created_at DESC로 정렬한다.
CREATE INDEX IF NOT EXISTS "feedbacks_area_created_at_idx"
  ON "public"."feedbacks" USING "btree" ("area", "created_at" DESC);

COMMENT ON COLUMN "public"."feedbacks"."area" IS
  '문의가 가리키는 기능 영역. 유형(category)과 직교하는 축이다.';
