# review

## 목적

백지 테스트(복습) 플로우를 담당한다. 사용자는 노트 본문을 보지 않고 기억나는 내용을 입력(답안 작성) → 원본과 비교 → 복습 완료 처리 → 다음 회차 스케줄링까지 진행한다.

## 데이터 흐름

1. `/notes/[noteId]/review` 페이지 진입 시:
   - 세션 확인 → 미로그인이면 `/login`으로 redirect
   - 이메일 인증 확인 → `email_confirmed_at`이 없으면 (`null`/`undefined`) `/resend-email`로 redirect
   - `getReviewableNote`, `getPendingReviewLog` 병렬 조회
   - pending 리뷰 로그가 없으면 안내 카드(완료 노트 / 진행 중 아님) 노출
   - 이미 채점을 받은 회차면 `getGradingByReviewLog` + `getNoteContentForComparison`으로 답안·채점·원본을 복원해 비교 화면부터 보여준다 (아래 "재진입 시 복원" 참고)
2. `BlankTestPage`에서 답안을 작성하고 `submitAnswerAction` 호출:
   - 세션/이메일 인증/소유권 + pending 리뷰 로그 존재 확인
   - 성공 시 원본 콘텐츠, 원본 본문 해시(`hashNoteContent`), 사용자 답안, `reviewLogId`를 반환 → `ComparisonView`로 전달
3. (선택) `GradingPanel`에서 `gradeAnswerAction` 호출 — AI 채점:
   - 세션/이메일 인증/소유권 + `pendingReviewLog.id === reviewLogId` 일치 확인
   - 복습 1회당 채점 1회: `review_gradings`에 기존 채점이 있으면 AI 호출 없이 재사용. 저장된 `user_answer`가 지금 답안과 다르면 결과와 함께 `gradedOtherAnswer: true`를 돌려 화면에서 기준이 다르다고 알리고, 기준이 된 답안(`gradedAnswer`)도 함께 돌려 접기로 펼쳐 볼 수 있게 한다
   - 기존 채점이 없으면 화면이 보여준 원본 해시(`originalContentHash`)와 지금 읽은 본문의 해시를 대조 (아래 "채점 기준 원본 고정" 참고)
   - **AI 호출 전에** `claim_review_grading` RPC로 채점 권한을 원자적으로 선점하고 사용자 단위 한도를 검사 (아래 "동시 요청과 비용 통제" 참고)
   - Cloudflare Workers AI(`@cf/openai/gpt-oss-120b`)로 회상률 점수(0~100)·빠뜨린 개념·잘못 기억한 내용을 JSON으로 받아 Zod 검증 후 `finalize_review_grading` RPC로 저장. 응답 구조는 `response_format.json_schema`(퀴즈와 같은 `toCloudflareResponseSchema`)로 디코딩 단계에서 한 번 더 강제한다 — 형식 이탈은 곧 사용자 에러 + 선점이 풀릴 때까지의 대기이기 때문이다
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
- `@/lib/ai/client` — AI 채점용 Cloudflare Workers AI 클라이언트 (`CLOUDFLARE_ACCOUNT_ID`·`CLOUDFLARE_API_TOKEN` 필요)
- `@/lib/ai/failureReason` — 실패 원인(`CloudflareAiError`의 `kind`·`code`)을 사용자 문구로 옮길 때 쓰는 판별 함수
- Supabase RPC `complete_review_and_schedule_next` — 완료 처리 및 다음 회차 스케줄링을 원자적으로 수행
- Supabase RPC `claim_review_grading` / `finalize_review_grading` — 채점 권한 선점 및 결과 확정. **`service_role` 전용**이라 `@/lib/supabase/admin`의 admin 클라이언트로 호출한다
- 테이블 `review_gradings` — AI 채점 결과 저장 (RLS: 본인 데이터 SELECT만 허용. INSERT/UPDATE/DELETE 정책 없음 — 쓰기는 위 두 SECURITY DEFINER 함수만 가능)
- 테이블 `review_grading_generations` — AI 채점 사용량 기록 (RLS: 본인 데이터 SELECT만 허용. 쓰기는 `claim_review_grading`만 가능)

## 주의사항

### 왜 완료 토큰(HMAC) 없이 충분한가

이전에는 `submitAnswerAction`에서 HMAC-SHA256 + 10분 TTL의 `completionToken`을 발급하고 `completeReviewAction`에서 검증하는 이중 구조였다. 현재는 다음 세 가지 검증만으로 대체한다:

1. **세션** — `supabase.auth.getUser()`로 로그인 사용자 확인
2. **소유권** — `getReviewableNote(noteId, user.id)` (user_id 필터 포함)
3. **pending 리뷰 로그 일치** — `pendingReviewLog.id === reviewLogId`

토큰이 실질적으로 막던 시나리오는 "본인이 자기 노트의 비교 단계를 건너뛰고 완료 처리"로, 자기 데이터에 대한 학습 흐름 강제 성격이었다. 보안 경계가 아니며, 대신 환경변수 배포 의존/TTL로 인한 UX 악화/유지보수 비용을 발생시켰다.

타인 데이터 조작은 소유권 검증이, 결제/공유 자원은 해당 없음, 재시도/중복 완료는 pending 리뷰 로그 일치 검증이 각각 커버한다.

### 재진입 시 복원

답안과 채점은 `review_gradings`에 남지만 비교 화면의 상태는 `useActionState`라 새로고침하면 사라진다.
복원이 없으면 채점까지 마치고 완료 버튼을 누르러 다시 들어온 사용자가 **완료 버튼을 보려고 답안을 한 번 더
써야 하고**, 그 답안은 저장된 채점 기준과 달라 "다른 답안을 채점한 결과" 안내로 이어진다.

그래서 `page.tsx`가 pending 회차의 채점을 조회해 있으면 답안·채점·원본을 `restoredSession`으로 내려주고,
`BlankTestPage`가 편집기 대신 비교 화면부터 그린다. 채점 결과는 `GradingPanel`의 `initialGrading`으로
버튼 없이 바로 표시한다. 이 조회는 fail-open이다 — 실패해도 백지 테스트 자체는 진행할 수 있어야 한다.

복원 화면의 **원본은 현재 본문**이고 **채점은 과거 시점의 결과**다. 채점을 받은 뒤 노트를 고쳤다면 둘의
기준이 갈리므로, 저장해 둔 `graded_content_hash`와 현재 본문의 해시를 비교해 `basisContentChanged`로
내려보내고 `GradingPanel`이 안내를 띄운다. 이게 없으면 사용자는 현재 원본을 기준으로 한 피드백이라고
읽게 된다. 전문 스냅샷을 저장하지 않는 이유는 비교하고 싶은 대상이 어차피 현재 본문이기 때문이다 —
필요한 정보는 "기준이 달라졌다"는 사실뿐이라 해시로 충분하다.

복원 화면에는 "답안 다시 작성" 버튼을 둔다. 복원을 넣으면서 기존에 새로고침으로 가능하던 "다시 쓰기"가
막히기 때문이다. 다시 쓴 답안은 회차당 채점 1회 규칙 때문에 새로 채점되지 않고, 채점을 누르면 저장된
결과가 경고와 함께 나온다. 이때 기준이 된 답안을 접기로 함께 보여준다.

이 경로에서는 화면이 `restoredSession`을 버리고 `submitAnswerAction`의 결과를 그리므로 **페이지가 계산한
`basisContentChanged`가 닿지 않는다.** 그래서 `gradeAnswerAction`도 저장된 채점을 돌려줄 때 같은 판단을
응답에 실어 보내고, `GradingPanel`은 액션 응답이 있으면 그쪽을 우선한다. 이게 없으면 "본문 수정 → 답안
다시 작성 → 채점"에서 바뀐 원본 옆에 과거 기준 피드백이 아무 경고 없이 놓인다(답안까지 같으면
`gradedOtherAnswer` 경고도 뜨지 않는다).

채점 점수·총평 자체는 노트 상세의 `GradingHistorySection`에서도 볼 수 있다. 복습 페이지의 복원이 채우는
것은 그쪽에 없는 **답안 원문과 원본 비교**, 그리고 완료 버튼까지 이어지는 흐름이다.

### 채점 기준 원본 고정

비교 화면은 `submitAnswerAction` 시점의 노트 본문을 보여주고, `gradeAnswerAction`은 채점할 때 본문을
다시 읽는다. 클라이언트가 보낸 본문을 그대로 믿으면 사용자가 원본을 바꿔 보내 점수를 조작할 수 있어서
재조회가 맞지만, 그 사이 다른 탭에서 노트를 고치면 **화면은 구 본문, AI는 신 본문**으로 갈린다.

그래서 `submitAnswerAction`이 본문 해시(`hashNoteContent`, sha256 hex)를 함께 돌려주고,
`GradingPanel`이 이를 `originalContentHash` hidden field로 되돌려 보내며, 채점 직전에 다시 읽은 본문의
해시와 다르면 채점하지 않고 새로고침을 안내한다.

**채점 입력은 본문과 답안뿐이다.** 해시가 지키는 범위와 채점에 들어가는 범위가 어긋나면 검사에 구멍이
생긴다. 노트 제목을 프롬프트에 넣었을 때가 그랬다 — 제목만 바꾸면 본문 해시 검사를 그대로 통과하면서
화면에 없던 제목으로 채점되고, 채점 후 제목만 고쳐 다시 들어와도 기준 변경 안내가 뜨지 않았다. 제목은
백지 테스트 화면에 이미 노출되는 힌트라 회상 평가 대상도 아니어서 `buildGradingPrompt`에서 뺐다.
채점 입력에 무언가를 더할 때는 해시 범위도 함께 넓혀야 한다.

**`notes.updated_at`을 쓰지 않는 이유.** `tr_notes_updated_at`은 notes 행의 _모든_ UPDATE에 붙는
BEFORE UPDATE 트리거다. `update_notification_time_of_day`가 `notification_time_of_day`·`next_review_at`을
쓰기만 해도 값이 올라가서, 본문이 그대로인데 채점이 거부된다. 그때 사용자는 새로고침을 하게 되고
아직 어디에도 저장되지 않은 답안(최대 5만 자)을 통째로 잃는다. 본문만 보는 해시에는 이 오탐이 없다.

이 검사는 **이미 확정된 채점을 읽는 경로보다 뒤**에 둔다. 저장된 결과를 돌려주는 건 새 채점이 아니므로
노트가 수정됐다고 해서 막을 이유가 없다. 값은 위조할 수 있지만 자기 노트를 자기가 채점받는 흐름이라
보안 경계가 아니라 정합성 장치다.

같은 해시를 `claim_review_grading`이 `review_gradings.graded_content_hash`에 저장한다. 그래야 채점을
받은 뒤 노트를 고치고 다시 들어왔을 때 "이 채점의 기준 본문이 지금 화면의 본문과 다르다"를 판단할 수
있다(위 "재진입 시 복원"의 `basisContentChanged`). 이 컬럼이 없으면 현재 본문과 과거 채점이 아무 안내
없이 한 화면에 놓인다. 이 컬럼이 없던 시절에 저장된 행은 `NULL`이고, 근거가 없으므로 경고하지 않는다.

### 동시 요청과 비용 통제 (AI 채점)

`review_log_id` 유니크 제약은 **저장 중복만** 막는다. 이미 나간 AI 호출 비용은 되돌리지 못하므로,
"조회 → AI 호출 → INSERT" 순서로는 동시 요청 N건이 모두 과금된다. 그래서 순서를 뒤집는다.

1. `claim_review_grading(user_id, review_log_id, user_answer, content_hash)` — `score`/`feedback`이 `NULL`인
   선점 행을 넣고 그 선점을 식별하는 `claim_token`(uuid)을 발급한다.
   `review_log_id` 단위 `pg_advisory_xact_lock`으로 "조회 → 선점"의 경합을 막는다.
   반환값은 `{ status, claimToken }` jsonb이고, `status`가 `ok`일 때만 AI를 호출한다.
   (`ok` / `already_graded` / `in_flight` / `too_many_requests` / `daily_exceeded` / `not_found`)
2. AI 호출 및 Zod 검증.
3. `finalize_review_grading(user_id, review_log_id, claim_token, score, feedback)` — 선점 행에 결과를 채운다.
   저장된 `claim_token`과 다르면 `stale_claim`을 돌려주고 아무것도 쓰지 않는다.

선점을 되돌리는 함수는 두지 않는다. 선점 → 해제를 반복하면 AI를 무제한으로 호출할 수 있기 때문이다.
대신 60초가 지난 선점 행은 자동으로 재선점 대상이 되고, AI 호출이 실패하면 사용자는 그만큼 기다린 뒤 재시도한다.

#### 타임아웃 순서 (바꿀 때 셋을 함께 본다)

| 값                      | 현재  | 위치                                                        |
| ----------------------- | ----- | ----------------------------------------------------------- |
| 채점 deadline           | 240초 | `GRADING_DEADLINE_MS` (`actions.ts`)                        |
| 최소 AI 예산            | 30초  | `MIN_AI_BUDGET_MS` (`actions.ts`)                           |
| 함수 실행 상한          | 280초 | `maxDuration` (`app/(main)/notes/[noteId]/review/page.tsx`) |
| 선점 만료(stale window) | 300초 | `c_stale_window` (`claim_review_grading`)                   |

**채점 deadline < maxDuration < 선점 만료** 순서를 유지한다.

이 값들은 원래 45초/55초/60초였다. Cloudflare Workers AI(gpt-oss-120b)로 교체한 뒤 canary로
실측한 채점 지연이 프로덕션 규모 입력(노트 10,000~30,000자)에서 최대 119.7초까지 나와,
기존 값으로는 정상 채점도 timeout에 걸렸다. Vercel Hobby 플랜이 Fluid Compute 기본 활성화로
함수 실행 상한 300초를 지원해 이 범위로 늘릴 수 있었다(`20260812130000_widen_review_grading_stale_window.sql`).

- 채점 deadline은 **액션 진입 시각**부터 잰다. AI 호출 직전에 타이머를 걸면 앞의 인증·조회·선점이
  느릴 때 abort보다 maxDuration이 먼저 걸려서, 선점만 잡힌 채 함수가 죽고 그 회차의 채점이
  선점 만료까지 막힌다. 그래서 선점 직전에 남은 예산을 계산하고, `MIN_AI_BUDGET_MS`보다
  적게 남았으면 선점하지 않고 실패시킨다. `AbortSignal`의 값도 호출 직전에 **다시** 계산한다 —
  선점 전에 잰 예산을 그대로 쓰면 타이머가 선점 RPC 이후부터 흘러서 종료 시각이 그만큼 밀린다.
- maxDuration이 선점 만료보다 크면, 호출이 진행 중인 사이 선점이 만료돼 사용자의 재시도가
  선점을 이어받고 원래 결과는 `stale_claim`으로 버려진다. 채점 1건에 AI를 두 번 부르는 셈이다.

`AbortSignal`은 이쪽 요청만 끊는다. Cloudflare가 서버 쪽 추론과 Neurons 소비를 즉시 멈춘다는
보장은 문서에 없다 — 공식 문서는 오류 `3008`(Aborted)과 실사용량 기준만 설명한다. 타임아웃으로
중복 과금을 막을 수 있다고 가정하지 않고, 비용은 "선점을 잡기 전에 못 쓸 호출을 걸러내는 것"으로 통제한다.

`maxDuration`은 Vercel 플랜별 기본값이 다르다. 명시하지 않으면 위 순서가 배포 환경에 따라
깨지므로 페이지에 항상 적어 둔다.

`claim_token`은 이 "60초 뒤 이어받기"의 짝이다. 요청 A가 60초를 넘겨 요청 B가 선점을 이어받으면
`user_answer`는 B의 답안으로 덮이는데, 확인 없이 두면 늦게 도착한 A도 결과를 확정할 수 있어
"답안 B + A 기준 피드백"이 한 행에 남는다. finalize가 토큰을 compare-and-set으로 확인해 이를 막는다.

두 함수의 EXECUTE 권한은 `service_role`에만 있다. `authenticated`에 열어 두면 사용자가 PostgREST로
`claim → finalize(100점)`을 직접 호출해 AI를 거치지 않고 점수를 확정할 수 있다.
그래서 `user_id`를 `auth.uid()`가 아니라 인자로 받는다(service_role 호출에서는 `auth.uid()`가 `NULL`이다).
서버 액션이 세션·이메일 인증·노트 소유권·pending 복습 로그 일치를 모두 확인한 뒤에만 호출한다.

쓰기 권한은 위 두 SECURITY DEFINER 함수에만 있다. INSERT 정책을 열어 두면
사용자가 `feedback = '{}'` 같은 행을 직접 넣어 조회 Zod 파싱을 `null`로 떨어뜨리고,
액션이 미채점으로 오판해 AI를 다시 부르지만 저장은 계속 실패하는 상태를 만들 수 있다.
DELETE 정책도 같은 이유로 없앴다(삭제 후 재채점 반복).
상세는 `20260808000000_create_review_gradings.sql`.

선점 행은 `getGradingByReviewLog`·`getGradingsByNote`에서 `score IS NOT NULL` 필터로 제외한다.

#### 사용자 단위 한도

`review_log_id` 유니크 제약은 **복습 1회당 1번**만 막는다. 사용자 총량은 막지 못한다.
노트 생성은 무제한이고 `create_note_with_initial_review_log`가 노트마다 즉시 1차 로그를 만들어서
"노트 N개 = 채점 N회"가 그대로 가능하고, advisory lock도 review_log 단위라 서로 다른 노트로
동시에 쏘면 전부 통과한다. 채점 프롬프트는 노트 5만 자 + 답안 5만 자라 호출 1회의 비용도 크다.

그래서 `claim_review_grading`이 `review_grading_generations`에 사용 기록을 남기고
**하루 30회 / 60초 10회**를 검사한다(값은 함수 안 상수 — 인자로 받으면 호출자가 우회할 수 있다).
퀴즈의 `claim_quiz_generation`(20260806000002)과 같은 구조다.

- 기록은 **AI를 부르는 경로에서만** 남긴다. `already_graded`·`in_flight`는 저장된 결과를 읽거나
  기다릴 뿐이므로 사용량을 깎지 않는다. 60초 뒤 선점을 이어받는 경로는 AI를 한 번 더 부르므로 깎는다.
- `review_log_id`는 `on delete set null`이다. `cascade`로 두면 노트를 지워 사용 기록까지 없앨 수 있다.
  `review_gradings` 자체를 카운터로 쓸 수 없는 이유도 같다(노트 삭제 시 cascade로 사라진다).
- 락 순서는 **review_log → user**로 고정한다. `finalize_review_grading`은 앞의 것만 잡으므로
  이 순서를 지키는 한 두 함수 사이에 교착이 생기지 않는다.
- 사용자 문구는 `constants.ts`의 `GRADING_ERROR_MESSAGES`에 있다. 한도 값은 여기 적지 않는다.

#### 피드백 항목 개수 (생성은 엄격하게, 수신은 관대하게)

프롬프트가 `missedConcepts`·`incorrectPoints`를 최대 `FEEDBACK_ITEMS_MAX`(5)개로 요청한다.
이 상한을 지키는 층이 셋이고 역할이 다르다.

1. **생성** — `gradingGenerationSchema`(`.max()`)를 `toCloudflareResponseSchema`에 넘겨
   `response_format.json_schema`에 `maxItems: 5`를 싣는다. 다만 Cloudflare는 모델이 스키마를
   지킨다고 보장하지 않는다고 문서에 명시하므로, 여기서 끝난다고 보지 않고 아래 두 층을 함께 둔다.
2. **수신** — `gradingResponseSchema`는 개수를 **제한하지 않는다.** 타입 검증(문자열 배열)만 한다.
3. **정규화** — 파싱에 성공한 값을 `normalizeGradingResponse`가 `slice(0, 5)`로 자른 뒤 저장·표시한다.

2번이 관대한 이유는 실패 비용의 비대칭이다. 개수 초과로 응답 전체를 거부하면
`review_grading_generations` 행이 이미 선점 시점에 들어가 있고 되돌리는 함수가 없으므로 **하루 한도
1회가 영구 소모**되고, 선점이 만료될 때까지 60초간 재시도가 막히며, 이미 나간 AI 비용은 재시도 때
다시 든다. 얻는 것은 "항목이 6개 대신 5개로 보인다"뿐이라 값이 맞지 않는다.

`slice`는 은폐가 아니다. 프롬프트가 제품 계약으로 선언한 개수를 집행하는 것이고, 1번이 예외적으로
깨졌을 때만 동작한다. 반대로 배열에 숫자·객체가 섞인 응답은 2번에서 그대로 거부한다 —
`unknown`을 먼저 자르면 타입을 확인하지 않은 값을 저장하게 되므로 **검증 → 절단** 순서를 지킨다.

DB CHECK(`review_gradings_feedback_shape_check`)에는 개수 제약을 넣지 않는다.
기존 행 호환성을 깨고, 신규 저장값은 이미 3번이 보장한다.

### 이메일 인증

회원가입 플로우에서 magiclink 클릭 전까지 `email_confirmed_at`이 비어 있다. Supabase `User` shape에서는 이 값이 `null` 또는 `undefined`일 수 있으므로, 복습 관련 모든 엔트리포인트(페이지, `submitAnswerAction`, `completeReviewAction`)에서 `email_confirmed_at == null` 기준으로 `/resend-email`로 redirect한다.

이메일 인증 가드는 두 층으로 구성된다:

- **앱 레벨 (UX)**: 페이지/서버 액션에서 `email_confirmed_at == null` 시 `/resend-email` redirect. 사용자가 UI를 통해 복습 플로우에 진입하는 경우를 담당.
- **DB 레벨 (쓰기 차단)**: `complete_review_and_schedule_next` RPC 본문에서 `auth.users.email_confirmed_at`이 `NULL`이면 `email not confirmed` 예외로 쓰기 자체를 차단. 서버 액션을 우회해 RPC/REST로 직접 호출하는 경로를 방어.

RPC 에러는 `completeReviewAction`에서 기존 공통 실패 메시지로 변환되므로 사용자-facing 메시지 정책은 불변. 이슈 #138 참고.
