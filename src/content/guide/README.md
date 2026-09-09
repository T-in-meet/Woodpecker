# 학습 가이드 본문 작성 메모

이 디렉터리의 `<slug>.md`는 `/guide/<slug>` 페이지 본문이다. 이 README는 slug가 아니라서 렌더링되지 않는다.

## 규칙

- **HTML 주석(`<!-- -->`)을 쓰지 않는다.** 렌더러에 rehype-raw가 없어 원시 HTML이 걸러지지 않고 화면에 그대로 나온다. 작성 메모는 이 파일에 남긴다.
- **H1을 두지 않는다.** 페이지 컴포넌트가 `GUIDE_DOCUMENTS`의 `heading`으로 렌더링하므로 본문은 H2부터 시작한다.
- **닫는 `**`앞에 문장부호를 두지 않는다.** CommonMark에서 닫는`**`는 앞 글자가 문장부호이고 뒤 글자가 문자면 강조를 닫지 못해 `**`가 화면에 그대로 남는다. 한국어는 조사가 바로 붙어서 자주 걸린다. `**간격 반복(spaced repetition)**이라고`는 깨지고 `**간격 반복**(spaced repetition)이라고`는 정상이다.
- 표·자동 링크·취소선은 `remark-gfm`이 처리한다. 원시 HTML은 여전히 걸러지지 않는다.
- 오래 유지할 앵커는 제목 끝에 `{#id}`로 명시한다. 한국어 제목에서 id를 자동 생성하지 않는다.
- 본문을 채웠으면 `GUIDE_DOCUMENTS`의 `revisedOn`에 개정일(KST)을 적는다. 이 값 하나로 sitemap 등록·색인 허용·내부 링크가 함께 열린다.

## 문서별 역할 (겹치면 canonical 클러스터로 묶일 수 있다)

- `spaced-repetition` — **왜** 다시 공부하는가. 원리와 근거.
- `review-cycle` — **언제** 다시 하는가. 간격 값과 조정.
- `blank-test` — 복습할 때 **무엇을** 하는가. 절차와 채점.

## 문서별 메모

### spaced-repetition

- "무엇을 반복해야 할까" 섹션에 `{#retrieval-practice}` 앵커가 있다. 인출 연습을 독립 페이지로 뺄지 여기서 먼저 검증한다. Search Console에서 "인출 연습" 계열 쿼리가 잡히면 `/guide/retrieval-practice`로 분리하고, 이 섹션에는 요약과 새 페이지 링크만 남긴다.
- URL fragment는 서버로 전송되지 않아 이 앵커를 301 대상으로 쓸 수 없다. 분리할 때는 내부 링크를 새 URL로 교체하는 방식으로 옮긴다.
- "복습 간격은 어떻게 정해야 할까"와 "기억에서 꺼내는 복습은 어떻게 할까"는 결론 2~3문단까지만 쓰고 자식 문서로 넘긴다.

### review-cycle

- 간격 값의 근거는 `src/lib/constants/reviewIntervals.ts`의 `REVIEW_INTERVALS_DAYS`.
- 인덱스는 완료 횟수가 아니라 "복습한 서로 다른 KST 날짜 수"다. 하루에 몰아서 완료해도 한 칸만 진행하고 다음 일정도 옮기지 않는다.
- 시퀀스를 넘어가면 마지막 값(30일)을 반복한다. 누적 복습 횟수에는 상한이 없다.
- 복습이 끝나는 유일한 경로는 사용자의 자율 완료 표시(`notes.review_completed_at`)다. 회차를 채워 자동으로 완료되는 상태는 없다.

### blank-test

- 채점 규칙의 근거는 `src/features/review/lib/gradingPrompt.ts`. 표현·어순·맞춤법 차이는 감점하지 않고 의미가 같으면 회상으로 인정하며, 채점 기준은 노트에 적힌 내용이라 외부 지식으로 보정하지 않는다.
- 피드백 항목 상한(각 5개)은 `src/features/review/schema.ts`의 `FEEDBACK_ITEMS_MAX`.
- 형제 문서가 공개되면 본문 링크를 두 곳에 건다: "백지 테스트란 무엇인가" 끝(→ spaced-repetition), "다음 복습은 어떻게 이어질까" 끝(→ review-cycle).
