# 딱다구리 (Woodpecker)

> 기록이 기억이 되는 공간 — 노트 기록과 복습을 연결하는 학습 플랫폼

노트를 저장하면 복습 일정이 자동으로 생성되고, 웹 푸시를 구독하면 복습 시점에 알림을 받을 수 있습니다.
백지 테스트와 AI 퀴즈를 통해 학습한 내용을 직접 떠올리며 실제로 기억하고 있는지 확인할 수 있습니다.

🔗 **[서비스 바로가기](https://woodpecker-blue.vercel.app)**

<!-- TODO: 데모 GIF 또는 대표 스크린샷 추가 -->

---

## 프로젝트 시작 배경

공부한 내용을 노트에 정리해도, 다시 꺼내보지 않으면 기록으로만 남기 쉽습니다.
노트가 쌓일수록 무엇을 언제 복습해야 할지 관리하는 일도 번거로워집니다.

딱다구리는 기록한 내용을 꾸준히 돌아보고, 얼마나 기억하고 있는지 확인할 수 있도록 만들었습니다.
노트를 저장하면 복습 일정을 자동으로 생성하고, 백지 테스트와 AI 퀴즈로 내용을 떠올려볼 수 있습니다.
웹 푸시를 구독하면 복습 시점에 알림도 받을 수 있습니다.

## 핵심 학습 흐름

| 단계             | 내용                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| **1. 기록**      | 노트를 저장하면 복습 일정이 자동으로 생성됩니다. 별도로 캘린더에 일정을 등록할 필요가 없습니다.          |
| **2. 알림**      | 브라우저에서 알림을 허용하고 웹 푸시를 구독하면 복습 시점에 알림을 받을 수 있습니다.                     |
| **3. 인출 훈련** | 백지 테스트로 직접 내용을 떠올려 작성하거나, AI가 노트에서 생성한 퀴즈를 풀며 기억을 확인합니다.         |
| **4. 재예약**    | 복습을 완료하면 다음 복습 일정이 자동으로 예약됩니다. 충분히 익힌 노트는 직접 학습을 종료할 수 있습니다. |

## 주요 기능

- **자동 복습 스케줄링** — 노트 저장 시 복습 일정을 자동 생성하고, 복습한 날짜 수에 따라 1일 → 3일 → 7일 → 14일 → 30일로 간격을 늘립니다(이후 30일 반복). 같은 노트의 복습 완료는 하루(KST)에 한 번만 반영되며, 원할 때 학습을 종료하거나 다시 시작할 수 있습니다.
- **백지 테스트** — 노트를 보지 않고 기억나는 대로 적어 제출하면, AI가 원본과 비교해 점수를 매기고 놓친 개념·잘못 기억한 내용을 피드백합니다.
- **AI 퀴즈** — 노트 내용을 기반으로 OX·객관식·빈칸 퀴즈를 자동 생성합니다.
- **웹 푸시 알림** — 노트별로 지정한 날짜·시간을 기준으로, 알림을 허용하고 구독한 브라우저에 복습 알림을 보냅니다.
- **노트 챗봇** — 내 노트를 근거로 답하는 AI 대화를 지원합니다(RAG, 스트리밍 응답).
- **관련 노트** — 연결 이유와 함께 노트를 직접 연결하거나, AI 추천으로 관련 노트를 찾을 수 있습니다.
- **노트 에디터** — 마크다운, 코드 블록 하이라이트, 표, 체크리스트, 이미지, 슬래시 명령을 지원하는 TipTap 기반 에디터를 제공합니다.

AI 기능에는 기능별 사용량 제한이 적용됩니다.

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
| 이메일     | Nodemailer (SMTP)                               |
| 테스트     | Vitest, Testing Library, Playwright, pgTAP      |
| 배포/CI    | Vercel, GitHub Actions                          |

이메일은 현재 모든 환경에서 Nodemailer로 발송합니다. Resend 연동 코드는 있으나 비활성화되어 있으며, `AUTH_EMAIL_PROVIDER` 값으로 발송 방식을 변경할 수 없습니다.

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

supabase/
├── migrations/   # DB 마이그레이션
└── tests/        # pgTAP 기반 DB 제약·RLS·RPC 테스트

tests/e2e/        # Playwright E2E
```

- 화면 보호와 사용자 데이터 접근에는 Supabase Auth 세션과 RLS를 기본으로 사용합니다. RLS를 우회하는 admin 클라이언트는 관리자 기능, cron, AI 실행 관리처럼 관리자·시스템 작업에서 권한 확인을 거친 뒤에만 사용합니다.
- 복습 완료와 다음 일정 생성은 Postgres RPC(`complete_review_and_schedule_next`)를 통해 원자적으로 처리합니다.
- AI는 용도별로 프로바이더를 나눕니다. 퀴즈 생성과 백지 테스트 채점은 Cloudflare Workers AI를, 노트 챗봇·관련 노트 추천·임베딩은 관리자 화면에서 설정한 모델(OpenAI·Google)을 사용합니다.
- 알림은 외부 스케줄러(cron-job.org)가 `/api/cron/dispatch-notifications`를 주기적으로 호출하고, 서버가 발송 대상을 조회해 Web Push를 전송하는 구조입니다. 호출에는 `Authorization: Bearer <CRON_SECRET>` 헤더가 필요하며, 실제 실행 주기는 cron-job.org 대시보드에서 관리합니다.

## 사전 요구사항

### 개발 환경

- Node.js 24.14.0 (nvm 사용 권장 — 상세는 [CONTRIBUTING.md](./CONTRIBUTING.md#1-nodejs-버전-설정))
- 프로젝트의 DB 마이그레이션과 인증 설정이 준비된 Supabase 환경(URL, anon key, service role key)
- 인증 이메일 발송용 SMTP 계정
- 이메일 인증·비밀번호 설정에 필요한 서버 비밀값(`EMAIL_TICKET_SECRET`, `PASSWORD_INTENT_SIGNING_SECRET`)

### 기능별 추가 설정

| 기능                            | 필요한 설정                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| AI 퀴즈 생성·백지 테스트 채점   | Cloudflare 계정 ID와 Workers AI 실행 권한이 있는 API 토큰         |
| 노트 챗봇·관련 노트 추천·임베딩 | 기능별 모델 설정에 맞는 OpenAI·Google AI API 키                   |
| Web Push                        | VAPID 키 페어와 subject. 로컬 검증에는 `mailto:` subject 사용     |
| 알림 발송 엔드포인트            | `CRON_SECRET`과 엔드포인트 호출 설정                              |
| Google OAuth 로그인             | Supabase Google provider 설정과 Google OAuth 클라이언트 ID/Secret |

각 값의 전체 목록과 설명은 [.env.example](./.env.example)을 참고하세요.

## 빠른 시작

아래 절차는 프로젝트의 DB 마이그레이션과 인증 설정이 준비된 Supabase 환경을 전제로 합니다.
새 Supabase 프로젝트를 사용하는 경우 환경변수 입력 외에도 DB 스키마·RLS·RPC·Storage 등 프로젝트 구성을 준비해야 합니다. 관련 내용은 [DB 마이그레이션 안내](./CONTRIBUTING.md#13-db-마이그레이션)와 [마이그레이션 디렉터리](./supabase/migrations/)를 참고하세요.

```bash
git clone https://github.com/T-in-meet/Woodpecker.git
cd Woodpecker
npm install
cp .env.example .env.local   # 환경변수 값 입력 필요
npm run dev
```

`http://localhost:3000`에 접속합니다.

### Web Push 로컬 검증

기본 개발 서버(`npm run dev`)는 Service Worker를 비활성화합니다.
Web Push를 검증하려면 VAPID 환경변수를 설정한 뒤 다음 명령으로 실행하세요.

```bash
npm run dev:sw
```

실행 후 사용할 브라우저에서 알림을 허용하고 구독해야 합니다.
실제 복습 알림 발송까지 검증하려면 `/api/cron/dispatch-notifications`에 인증 헤더를 포함한 호출도 필요합니다. 개발 서버 실행만으로 외부 스케줄러가 설정되지는 않습니다.

Node.js 버전, 환경변수, Git Hook 등 상세한 개발 환경 설정은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 문제 해결

자주 발생하는 문제(Web Push 로컬 미동작, `VAPID_SUBJECT` 에러, CSS 변경 미반영, Format Check 실패, PowerShell 경로 이슈 등)와 원인·해결법은 [CONTRIBUTING.md의 트러블슈팅](./CONTRIBUTING.md#14-트러블슈팅)에 정리되어 있습니다.

## 지원 창구

버그 제보나 기능 제안은 [GitHub Issues](https://github.com/T-in-meet/Woodpecker/issues)로 남겨주세요.

## 문서

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 환경 설정, 커밋·브랜치 규칙, CI, 코드 스타일
- [.env.example](./.env.example) — 환경변수 목록과 설정 설명
- [supabase/migrations/](./supabase/migrations/) — DB 스키마 변경 이력
- [supabase/tests/](./supabase/tests/) — DB 제약·RLS·RPC 테스트
