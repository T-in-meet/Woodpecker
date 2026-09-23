# 딱다구리 (Woodpecker)

> 기록이 기억이 되는 공간 — 인지 과학 기반 간격 반복 학습 플랫폼

노트를 저장하면 복습 일정이 자동으로 생성되고, 잊어버릴 즈음 알림을 받습니다.
백지 테스트와 AI 퀴즈를 통해 학습한 내용을 직접 떠올리며 실제로 기억하고 있는지 확인할 수 있습니다.

🔗 **[서비스 바로가기](https://woodpecker-blue.vercel.app)**

<!-- TODO: 데모 GIF 또는 대표 스크린샷 추가 -->

---

## 프로젝트 시작 배경

학습한 내용은 복습하지 않을 경우 시간이 지나면서 점차 잊히게 됩니다 (Ebbinghaus, 1885).

반면 단순히 내용을 다시 읽는 것보다, 기억에서 직접 정보를 꺼내보는 인출 연습(retrieval practice)​이 장기적인 학습과 기억 유지에 효과적이라는 연구 결과가 있습니다 (Karpicke & Blunt, Science, 2011).

하지만 실제 학습에서는 "나중에 복습해야지"라는 생각만으로 복습 시점을 꾸준히 관리하기 어렵습니다.

딱다구리는 노트 기록 → 복습 일정 생성 → 알림 → 인출 훈련으로 이어지는 흐름을 자동화해, 사용자가 복습 시점을 직접 관리하지 않아도 학습을 이어갈 수 있도록 만들었습니다.

## 핵심 학습 흐름

| 단계             | 내용                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| **1. 기록**      | 노트를 저장하면 복습 일정이 자동으로 생성됩니다. 별도로 캘린더나 알림을 설정할 필요가 없습니다.          |
| **2. 알림**      | 1일 → 3일 → 7일 → 14일 → 30일 간격으로 복습 시점에 웹 푸시 알림을 보냅니다.                              |
| **3. 인출 훈련** | 백지 테스트로 직접 내용을 떠올려 작성하거나, AI가 노트에서 생성한 퀴즈를 풀며 기억을 확인합니다.         |
| **4. 재예약**    | 복습을 완료하면 다음 복습 일정이 자동으로 예약됩니다. 충분히 익힌 노트는 직접 학습을 종료할 수 있습니다. |

## 주요 기능

- **자동 복습 스케줄링** — 노트 저장 시 복습 일정을 자동 생성하고, 복습한 날짜 수에 따라 1일 → 3일 → 7일 → 14일 → 30일로 간격을 늘립니다(이후 30일 반복). 같은 노트의 복습 완료는 하루(KST)에 한 번만 반영되며, 원할 때 학습을 종료하거나 다시 시작할 수 있습니다.
- **백지 테스트** — 노트를 보지 않고 기억나는 대로 적어 제출하면, AI가 원본과 비교해 점수를 매기고 놓친 개념·잘못 기억한 내용을 피드백
- **AI 퀴즈** — 노트 내용을 기반으로 OX·객관식·빈칸 퀴즈를 자동 생성
- **웹 푸시 알림** — 노트별로 지정한 날짜·시간에 복습 알림 발송
- **노트 챗봇** — 내 노트를 근거로 답하는 AI 대화(RAG, 스트리밍 응답)
- **관련 노트** — 노트끼리 연결 이유와 함께 직접 연결하거나, AI 추천으로 관련 노트를 찾기(일일 사용량 제한)
- **노트 에디터** — 마크다운, 코드 블록 하이라이트, 표, 체크리스트, 이미지, 슬래시 명령을 지원하는 TipTap 기반 에디터

### 기타 기능

이메일 OTP 인증 가입 · OAuth 로그인 · 비밀번호 설정·재설정 · 인증 요청 제한(rate limit) · 약관 개정 시 재동의 · 오늘의 복습 · 공개 학습 가이드 · 마이페이지(프로필, 학습 통계) · 고객센터(1:1 문의, FAQ) · 관리자(사용자·문의 관리, AI 모델·프롬프트 관리, 운영 오류 추적, 관리자 알림, 실험 화면)

<!-- TODO: 기능별 스크린샷 -->

## 기술 스택

| 영역       | 사용 기술                                       |
| ---------- | ----------------------------------------------- |
| 프레임워크 | Next.js 15 (App Router), React 19, TypeScript   |
| 백엔드/DB  | Supabase (Postgres, Auth, Storage, RLS, RPC)    |
| 상태 관리  | TanStack Query (서버 상태)                      |
| UI         | Tailwind CSS v4, shadcn/ui, lucide              |
| 에디터     | TipTap (읽기 화면은 happy-dom으로 서버 렌더)    |
| AI         | Cloudflare Workers AI, OpenAI, Google, pgvector |
| 알림       | Web Push (serwist), cron-job.org                |
| 폼·검증    | React Hook Form, Zod                            |
| 이메일     | Resend / Nodemailer                             |
| 테스트     | Vitest, Testing Library, Playwright             |
| 배포/CI    | Vercel, GitHub Actions                          |

## 아키텍처 개요

```text
src/
├── app/          # 라우팅 전용 (App Router) — (auth) · (main) · (legal) · (content) · admin · api
├── features/     # 도메인 모듈 — auth · notes · review · quiz · notifications · note-chats · related-notes
│                 #   · ai · editor · mypage · guide · landing · admin · operational-errors
├── components/   # 공용 UI (ui · layout · providers)
├── hooks/        # 전역 훅
├── lib/          # Supabase 클라이언트, 상수, 검증, Web Push, 로거
└── types/        # DB·도메인 타입

supabase/migrations/   # DB 마이그레이션
tests/e2e/             # Playwright E2E
```

- 화면 보호와 사용자 데이터 접근에는 Supabase Auth 세션과 RLS를 기본으로 사용합니다. RLS를 우회하는 admin 클라이언트는 관리자 기능, cron, AI 실행 관리처럼 관리자·시스템 작업에서 권한 확인을 거친 뒤에만 사용합니다.
- 복습 완료와 다음 일정 생성은 Postgres RPC(`complete_review_and_schedule_next`)를 통해 원자적으로 처리합니다.
- AI는 용도별로 프로바이더를 나눕니다. 퀴즈 생성과 백지 테스트 채점은 Cloudflare Workers AI를, 노트 챗봇·관련 노트 추천·임베딩은 관리자 화면에서 설정한 모델(OpenAI·Google)을 사용합니다.
- 알림은 외부 스케줄러(cron-job.org)가 `/api/cron/dispatch-notifications`를 주기적으로 호출하고, 서버가 발송 대상을 조회해 Web Push를 전송하는 구조입니다.

## 사전 요구사항

- Node.js 24.14.0 (nvm 사용 권장 — 상세는 [CONTRIBUTING.md](./CONTRIBUTING.md#1-nodejs-버전-설정))
- Supabase 프로젝트 (URL, anon key, service role key)
- Cloudflare 계정 ID와 Workers AI 실행 권한이 있는 API 토큰 (AI 퀴즈 생성 · 백지 테스트 채점에 사용)
- OpenAI 또는 Google AI API 키 (노트 챗봇 · 관련 노트 추천 · 임베딩 로컬 검증 시 필요)
- VAPID 키 페어 (Web Push 알림 로컬 검증 시 필요, `mailto:` subject 필수)
- 이메일 발송용 SMTP 계정 또는 Resend API 키
- Google OAuth 클라이언트 ID/Secret (OAuth 로그인 로컬 검증 시 필요)
- 서버 서명·인증용 비밀값 (`CRON_SECRET`, `EMAIL_TICKET_SECRET`, `PASSWORD_INTENT_SIGNING_SECRET` 등)

각 값의 전체 목록과 설명은 [.env.example](./.env.example)을 참고하세요.

## 빠른 시작

```bash
git clone https://github.com/T-in-meet/Woodpecker.git
cd Woodpecker
npm install
cp .env.example .env.local   # 환경 변수 값 입력 필요
npm run dev
```

`http://localhost:3000`에 접속합니다.
Node.js 버전, 환경 변수, Git Hook 등 상세한 개발 환경 설정은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 문제 해결

자주 발생하는 문제(Web Push 로컬 미동작, `VAPID_SUBJECT` 에러, CSS 변경 미반영, Format Check 실패, PowerShell 경로 이슈 등)와 원인·해결법은 [CONTRIBUTING.md의 트러블슈팅](./CONTRIBUTING.md#14-트러블슈팅)에 정리되어 있습니다.

## 지원 창구

버그 제보나 기능 제안은 [GitHub Issues](https://github.com/T-in-meet/Woodpecker/issues)로 남겨주세요.

## 문서

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 환경 설정, 커밋·브랜치 규칙, CI, 코드 스타일
- [supabase/migrations/](./supabase/migrations/) — DB 스키마 변경 이력
