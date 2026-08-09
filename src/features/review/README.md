# review

## 목적

백지 테스트(복습) 플로우를 담당한다. 사용자는 노트 본문을 보지 않고 기억나는 내용을 입력(답안 작성) → 원본과 비교 → 복습 완료 처리 → 다음 회차 스케줄링까지 진행한다.

## 데이터 흐름

1. `/notes/[noteId]/review` 페이지 진입 시:
   - 세션 확인 → 미로그인이면 `/login`으로 redirect
   - 이메일 인증 확인 → `email_confirmed_at`이 없으면 (`null`/`undefined`) `/resend-email`로 redirect
   - `getReviewableNote`, `getPendingReviewLog` 병렬 조회
   - pending 리뷰 로그가 없으면 안내 카드(완료 노트 / 진행 중 아님) 노출
2. `BlankTestPage`에서 답안을 작성하고 `submitAnswerAction` 호출:
   - 세션/이메일 인증/소유권 + pending 리뷰 로그 존재 확인
   - 성공 시 원본 콘텐츠, 사용자 답안, `reviewLogId`를 반환 → `ComparisonView`로 전달
3. (선택) `GradingPanel`에서 `gradeAnswerAction` 호출 — AI 채점:
   - 세션/이메일 인증/소유권 + `pendingReviewLog.id === reviewLogId` 일치 확인
   - 복습 1회당 채점 1회: `review_gradings`에 기존 채점이 있으면 Gemini 호출 없이 재사용. 저장된 `user_answer`가 지금 답안과 다르면 결과와 함께 `gradedOtherAnswer: true`를 돌려 화면에서 기준이 다르다고 알린다
   - 기존 채점이 없으면 **Gemini 호출 전에** `claim_review_grading` RPC로 채점 권한을 원자적으로 선점 (아래 "동시 요청과 비용 통제" 참고)
   - Gemini(`gemini-3.1-flash-lite`)로 회상률 점수(0~100)·빠뜨린 개념·잘못 기억한 내용을 JSON으로 받아 Zod 검증 후 `finalize_review_grading` RPC로 저장
   - 저장에 실패하면 결과를 보여주지 않고 에러를 반환한다. 저장되지 않은 행은 `score = NULL`이라 새로고침하면 사라지고 기록에도 남지 않으므로, 성공으로 보여주면 화면과 DB가 어긋난다
   - 채점은 부가 기능: 채점 실패/저장 실패가 복습 완료를 막지 않으며, 점수는 스케줄링(1/3/7일 고정)에 개입하지 않는다
   - 저장된 채점 기록은 노트 상세 페이지의 `GradingHistorySection`에서 회차별로 조회
4. 비교를 마치면 `ReviewCompleteButton`의 `completeReviewAction` 호출:
   - 세션/이메일 인증 확인
   - `getReviewableNote`(소유권 포함) + `getPendingReviewLog`를 병렬 조회
   - `pendingReviewLog.id === reviewLogId` 일치 확인 (중간에 상태가 변하지 않았는지)
   - `complete_review_and_schedule_next` RPC 호출 → 완료 처리 및 다음 회차 스케줄링
   - `revalidatePath` 후 노트 상세로 redirect

## 의존성

- `@/lib/supabase/server` — 서버 Supabase 클라이언트
- `@/lib/constants/routes` — `${ROUTES.RESEND_EMAIL}?purpose=signup`, `ROUTES.LOGIN`, `getNoteDetailRoute`, `getNoteReviewRoute`
- `@/lib/constants/reviewIntervals` — 도메인 상수
- `@/lib/gemini/client` — AI 채점용 Gemini 클라이언트 (`GEMINI_API_KEY` 필요)
- Supabase RPC `complete_review_and_schedule_next` — 완료 처리 및 다음 회차 스케줄링을 원자적으로 수행
- Supabase RPC `claim_review_grading` / `finalize_review_grading` — 채점 권한 선점 및 결과 확정. **`service_role` 전용**이라 `@/lib/supabase/admin`의 admin 클라이언트로 호출한다
- 테이블 `review_gradings` — AI 채점 결과 저장 (RLS: 본인 데이터 SELECT만 허용. INSERT/UPDATE/DELETE 정책 없음 — 쓰기는 위 두 SECURITY DEFINER 함수만 가능)

## 주의사항

### 왜 완료 토큰(HMAC) 없이 충분한가

이전에는 `submitAnswerAction`에서 HMAC-SHA256 + 10분 TTL의 `completionToken`을 발급하고 `completeReviewAction`에서 검증하는 이중 구조였다. 현재는 다음 세 가지 검증만으로 대체한다:

1. **세션** — `supabase.auth.getUser()`로 로그인 사용자 확인
2. **소유권** — `getReviewableNote(noteId, user.id)` (user_id 필터 포함)
3. **pending 리뷰 로그 일치** — `pendingReviewLog.id === reviewLogId`

토큰이 실질적으로 막던 시나리오는 "본인이 자기 노트의 비교 단계를 건너뛰고 완료 처리"로, 자기 데이터에 대한 학습 흐름 강제 성격이었다. 보안 경계가 아니며, 대신 환경변수 배포 의존/TTL로 인한 UX 악화/유지보수 비용을 발생시켰다.

타인 데이터 조작은 소유권 검증이, 결제/공유 자원은 해당 없음, 재시도/중복 완료는 pending 리뷰 로그 일치 검증이 각각 커버한다.

### 동시 요청과 비용 통제 (AI 채점)

`review_log_id` 유니크 제약은 **저장 중복만** 막는다. 이미 나간 Gemini 호출 비용은 되돌리지 못하므로,
"조회 → Gemini 호출 → INSERT" 순서로는 동시 요청 N건이 모두 과금된다. 그래서 순서를 뒤집는다.

1. `claim_review_grading(user_id, review_log_id, user_answer)` — `score`/`feedback`이 `NULL`인 선점 행을 넣고
   그 선점을 식별하는 `claim_token`(uuid)을 발급한다.
   `review_log_id` 단위 `pg_advisory_xact_lock`으로 "조회 → 선점"의 경합을 막는다.
   반환값은 `{ status, claimToken }` jsonb이고, `status`가 `ok`일 때만 Gemini를 호출한다.
   (`ok` / `already_graded` / `in_flight` / `not_found`)
2. Gemini 호출 및 Zod 검증.
3. `finalize_review_grading(user_id, review_log_id, claim_token, score, feedback)` — 선점 행에 결과를 채운다.
   저장된 `claim_token`과 다르면 `stale_claim`을 돌려주고 아무것도 쓰지 않는다.

선점을 되돌리는 함수는 두지 않는다. 선점 → 해제를 반복하면 Gemini를 무제한으로 호출할 수 있기 때문이다.
대신 60초가 지난 선점 행은 자동으로 재선점 대상이 되고, Gemini 호출이 실패하면 사용자는 그만큼 기다린 뒤 재시도한다.

#### 타임아웃 순서 (바꿀 때 셋을 함께 본다)

| 값                      | 현재 | 위치                                                        |
| ----------------------- | ---- | ----------------------------------------------------------- |
| Gemini 호출 타임아웃    | 45초 | `GEMINI_TIMEOUT_MS` (`actions.ts`)                          |
| 함수 실행 상한          | 55초 | `maxDuration` (`app/(main)/notes/[noteId]/review/page.tsx`) |
| 선점 만료(stale window) | 60초 | `c_stale_window` (`claim_review_grading`)                   |

**Gemini 타임아웃 < maxDuration < 선점 만료** 순서를 유지한다.

- Gemini 타임아웃이 maxDuration보다 크면 느린 호출이 함수와 함께 죽어서 원인을 남기지 않는다.
- maxDuration이 선점 만료보다 크면, 호출이 진행 중인 사이 선점이 만료돼 사용자의 재시도가
  선점을 이어받고 원래 결과는 `stale_claim`으로 버려진다. 채점 1건에 Gemini를 두 번 부르는 셈이다.

`maxDuration`은 Vercel 플랜별 기본값이 다르고 그 기본값이 60초를 넘는 구성도 있다.
명시하지 않으면 위 순서가 배포 환경에 따라 깨지므로 페이지에 항상 적어 둔다.

`claim_token`은 이 "60초 뒤 이어받기"의 짝이다. 요청 A가 60초를 넘겨 요청 B가 선점을 이어받으면
`user_answer`는 B의 답안으로 덮이는데, 확인 없이 두면 늦게 도착한 A도 결과를 확정할 수 있어
"답안 B + A 기준 피드백"이 한 행에 남는다. finalize가 토큰을 compare-and-set으로 확인해 이를 막는다.

두 함수의 EXECUTE 권한은 `service_role`에만 있다. `authenticated`에 열어 두면 사용자가 PostgREST로
`claim → finalize(100점)`을 직접 호출해 AI를 거치지 않고 점수를 확정할 수 있다.
그래서 `user_id`를 `auth.uid()`가 아니라 인자로 받는다(service_role 호출에서는 `auth.uid()`가 `NULL`이다).
서버 액션이 세션·이메일 인증·노트 소유권·pending 복습 로그 일치를 모두 확인한 뒤에만 호출한다.

쓰기 권한은 위 두 SECURITY DEFINER 함수에만 있다. INSERT 정책을 열어 두면
사용자가 `feedback = '{}'` 같은 행을 직접 넣어 조회 Zod 파싱을 `null`로 떨어뜨리고,
액션이 미채점으로 오판해 Gemini를 다시 부르지만 저장은 계속 실패하는 상태를 만들 수 있다.
DELETE 정책도 같은 이유로 없앴다(삭제 후 재채점 반복).
상세는 `20260809000000_harden_review_gradings.sql`과 `20260809010000_secure_review_grading_rpcs.sql`.

선점 행은 `getGradingByReviewLog`·`getGradingsByNote`에서 `score IS NOT NULL` 필터로 제외한다.

### 이메일 인증

회원가입 플로우에서 magiclink 클릭 전까지 `email_confirmed_at`이 비어 있다. Supabase `User` shape에서는 이 값이 `null` 또는 `undefined`일 수 있으므로, 복습 관련 모든 엔트리포인트(페이지, `submitAnswerAction`, `completeReviewAction`)에서 `email_confirmed_at == null` 기준으로 `/resend-email`로 redirect한다.

이메일 인증 가드는 두 층으로 구성된다:

- **앱 레벨 (UX)**: 페이지/서버 액션에서 `email_confirmed_at == null` 시 `/resend-email` redirect. 사용자가 UI를 통해 복습 플로우에 진입하는 경우를 담당.
- **DB 레벨 (쓰기 차단)**: `complete_review_and_schedule_next` RPC 본문에서 `auth.users.email_confirmed_at`이 `NULL`이면 `email not confirmed` 예외로 쓰기 자체를 차단. 서버 액션을 우회해 RPC/REST로 직접 호출하는 경로를 방어.

RPC 에러는 `completeReviewAction`에서 기존 공통 실패 메시지로 변환되므로 사용자-facing 메시지 정책은 불변. 이슈 #138 참고.
