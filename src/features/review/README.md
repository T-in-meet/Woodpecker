# review

## 목적

백지 테스트(복습) 플로우를 담당한다. 사용자는 노트 본문을 보지 않고 기억나는 내용을 입력(답안 작성) → 원본과 비교 → 복습 완료 처리 → 다음 회차 스케줄링까지 진행한다.

## 데이터 흐름

1. `/notes/[noteId]/review` 페이지 진입 시:
   - 세션 확인 → 미로그인이면 `/login`으로 redirect
   - 이메일 인증 확인 → `email_confirmed_at`이 없으면 (`null`/`undefined`) `/verify-email`로 redirect
   - `getReviewableNote`, `getPendingReviewLog` 병렬 조회
   - pending 리뷰 로그가 없으면 안내 카드(완료 노트 / 진행 중 아님) 노출
2. `BlankTestPage`에서 답안을 작성하고 `submitAnswerAction` 호출:
   - 세션/이메일 인증/소유권 + pending 리뷰 로그 존재 확인
   - 성공 시 원본 콘텐츠, 사용자 답안, `reviewLogId`를 반환 → `ComparisonView`로 전달
3. 비교를 마치면 `ReviewCompleteButton`의 `completeReviewAction` 호출:
   - 세션/이메일 인증 확인
   - `getReviewableNote`(소유권 포함) + `getPendingReviewLog`를 병렬 조회
   - `pendingReviewLog.id === reviewLogId` 일치 확인 (중간에 상태가 변하지 않았는지)
   - `complete_review_and_schedule_next` RPC 호출 → 완료 처리 및 다음 회차 스케줄링
   - `revalidatePath` 후 노트 상세로 redirect

## 의존성

- `@/lib/supabase/server` — 서버 Supabase 클라이언트
- `@/lib/constants/routes` — `ROUTES.VERIFY_EMAIL`, `ROUTES.LOGIN`, `getNoteDetailRoute`, `getNoteReviewRoute`
- `@/lib/constants/noteLanguages`, `@/lib/constants/reviewIntervals` — 도메인 상수
- Supabase RPC `complete_review_and_schedule_next` — 완료 처리 및 다음 회차 스케줄링을 원자적으로 수행

## 주의사항

### 왜 완료 토큰(HMAC) 없이 충분한가

이전에는 `submitAnswerAction`에서 HMAC-SHA256 + 10분 TTL의 `completionToken`을 발급하고 `completeReviewAction`에서 검증하는 이중 구조였다. 현재는 다음 세 가지 검증만으로 대체한다:

1. **세션** — `supabase.auth.getUser()`로 로그인 사용자 확인
2. **소유권** — `getReviewableNote(noteId, user.id)` (user_id 필터 포함)
3. **pending 리뷰 로그 일치** — `pendingReviewLog.id === reviewLogId`

토큰이 실질적으로 막던 시나리오는 "본인이 자기 노트의 비교 단계를 건너뛰고 완료 처리"로, 자기 데이터에 대한 학습 흐름 강제 성격이었다. 보안 경계가 아니며, 대신 환경변수 배포 의존/TTL로 인한 UX 악화/유지보수 비용을 발생시켰다.

타인 데이터 조작은 소유권 검증이, 결제/공유 자원은 해당 없음, 재시도/중복 완료는 pending 리뷰 로그 일치 검증이 각각 커버한다.

### 이메일 인증

회원가입 플로우에서 magiclink 클릭 전까지 `email_confirmed_at`이 비어 있다. Supabase `User` shape에서는 이 값이 `null` 또는 `undefined`일 수 있으므로, 복습 관련 모든 엔트리포인트(페이지, `submitAnswerAction`, `completeReviewAction`)에서 `email_confirmed_at == null` 기준으로 `/verify-email`로 redirect한다.
