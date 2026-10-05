# 딱다구리 (Woodpecker)

> 기록이 기억이 되는 공간 — 노트 기록과 복습을 연결하는 학습 플랫폼

노트를 저장하면 복습 일정이 자동으로 생성되고, 웹 푸시를 통해 복습 시점에 알림을 받을 수 있습니다.
백지 테스트와 AI 퀴즈로 학습 내용을 직접 떠올리며 얼마나 기억하고 있는지 확인할 수 있습니다.

🔗 **[서비스 바로가기](https://woodpecker-blue.vercel.app)**

<!-- TODO: 데모 GIF 또는 대표 스크린샷 추가 -->

---

## 프로젝트 시작 배경

공부한 내용을 노트에 정리해도 다시 꺼내보지 않으면 기록으로만 남기 쉽습니다.
노트가 쌓일수록 무엇을 언제 복습해야 할지 직접 관리하는 일도 번거로워집니다.

딱다구리는 노트를 단순히 저장하는 데서 끝나지 않고, 기록한 내용을 적절한 시점에 다시 떠올리는 과정까지 연결하기 위해 만들었습니다.
사용자가 복습 일정을 직접 관리하는 부담을 줄이고, 기억에서 내용을 꺼내보는 학습에 집중할 수 있도록 하는 것이 목표입니다.

## 핵심 학습 흐름

| 단계             | 내용                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **1. 기록**      | 노트를 저장하면 복습 일정이 자동으로 생성됩니다. 별도로 캘린더에 일정을 등록할 필요가 없습니다.            |
| **2. 알림**      | 브라우저에서 알림을 허용하고 웹 푸시를 구독하면 복습 시점에 알림을 받을 수 있습니다.                       |
| **3. 인출 훈련** | 백지 테스트로 기억나는 내용을 직접 작성하거나, AI가 생성한 퀴즈를 풀며 기억 상태를 확인합니다.             |
| **4. 다음 복습** | 복습을 완료하면 다음 복습 일정이 자동으로 생성됩니다. 충분히 익힌 노트는 언제든 학습을 종료할 수 있습니다. |

## 주요 기능

- **자동 복습 스케줄링** — 노트를 저장하면 복습 일정이 생성되며, 복습을 완료한 날짜 수(KST 기준)에 따라 간격이 1일 → 3일 → 7일 → 14일 → 30일로 늘어납니다. 이후에는 30일 간격으로 반복되며, 학습은 언제든 종료하거나 다시 시작할 수 있습니다. 같은 노트의 복습 완료는 KST 기준 하루 한 번만 반영됩니다.
- **백지 테스트** — 노트를 보지 않고 기억나는 내용을 작성해 제출하면, AI가 원본 노트와 비교해 답안을 채점하고 놓친 개념이나 잘못 기억한 내용을 피드백합니다.
- **AI 퀴즈** — 노트를 기반으로 OX·객관식·빈칸 퀴즈를 자동 생성합니다.
- **웹 푸시 알림** — 노트별로 지정한 날짜와 시간을 기준으로, 알림을 허용하고 구독한 브라우저에 복습 알림을 보냅니다.
- **노트 챗봇** — 사용자의 노트를 근거로 답변하는 AI 대화를 지원합니다. RAG 기반 검색과 스트리밍 응답을 사용합니다.
- **관련 노트** — 노트 간 연결 관계와 이유를 직접 설정하거나, AI 추천을 통해 관련된 노트를 찾을 수 있습니다.
- **노트 에디터** — 마크다운, 코드 블록 하이라이트, 표, 체크리스트, 이미지, 슬래시 명령을 지원하는 TipTap 기반 에디터를 제공합니다.

AI 기능에는 기능별 사용량 제한이 적용됩니다.

### 기타 기능

- **인증** — 이메일 OTP 가입, OAuth 로그인, 비밀번호 설정·재설정, 인증 요청 제한(rate limit)
- **학습** — 오늘의 복습, 공개 학습 가이드, 마이페이지(프로필, 학습 통계)
- **운영** — 약관 개정 시 재동의, 고객센터(1:1 문의, FAQ)
- **관리자** — 사용자·문의 관리, AI 모델·프롬프트 관리, 운영 오류 추적, 관리자 알림, 실험 화면

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

이메일 발송은 현재 Nodemailer 기반 SMTP 방식을 사용합니다. Resend 연동 코드는 존재하지만 비활성화되어 있습니다.

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

- 사용자 인증에는 Supabase Auth를, 데이터 접근 제어에는 RLS를 사용합니다. RLS를 우회하는 admin 클라이언트는 관리자 기능, cron, AI 실행 관리 등 서버 권한이 필요한 작업에서만 사용하며, 실행 전 별도의 권한 검증을 거칩니다.
- 복습 완료와 다음 일정 생성은 Postgres RPC(`complete_review_and_schedule_next`)를 통해 원자적으로 처리합니다.
- AI 모델은 기능에 따라 서로 다른 프로바이더를 사용합니다. 퀴즈 생성과 백지 테스트 채점에는 Cloudflare Workers AI를 사용하며, 노트 챗봇·관련 노트 추천·임베딩에는 관리자 화면에서 설정한 OpenAI 또는 Google 모델을 사용합니다.
- 복습 알림은 외부 스케줄러(cron-job.org)가 발송 작업을 주기적으로 실행하고, 서버가 알림 대상과 시간을 확인해 Web Push로 전송합니다.

## 사전 요구사항

### 개발 환경

- Node.js 24.14.0 (nvm 사용 권장 — 상세는 [CONTRIBUTING.md](./CONTRIBUTING.md#1-nodejs-버전-설정))
- DB 마이그레이션과 인증 설정이 적용된 Supabase 프로젝트(URL, anon key, service role key)
- 인증 이메일 발송용 SMTP 계정
- 이메일 인증·비밀번호 설정에 필요한 서버 비밀값(`EMAIL_TICKET_SECRET`, `PASSWORD_INTENT_SIGNING_SECRET`)

### 기능별 추가 설정

| 기능                            | 필요한 설정                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| AI 퀴즈 생성·백지 테스트 채점   | Cloudflare 계정 ID와 Workers AI 실행 권한이 있는 API 토큰         |
| 노트 챗봇·관련 노트 추천·임베딩 | 기능별 모델 설정에 맞는 OpenAI·Google AI API 키                   |
| Web Push                        | VAPID 키 페어와 `subject` 설정. 로컬 검증 시 `mailto:` 형식 사용  |
| Google OAuth 로그인             | Supabase Google provider 설정과 Google OAuth 클라이언트 ID/Secret |

각 값의 전체 목록과 설명은 [.env.example](./.env.example)을 참고하세요.

## 빠른 시작

아래 절차는 DB 마이그레이션과 인증 설정이 적용된 Supabase 프로젝트를 전제로 합니다.
새 Supabase 프로젝트를 사용하는 경우 환경변수 설정과 함께 DB 스키마·RLS·RPC·Storage 구성이 필요합니다. 관련 내용은 [DB 마이그레이션 안내](./CONTRIBUTING.md#13-db-마이그레이션)와 [마이그레이션 디렉터리](./supabase/migrations/)를 참고하세요.

```bash
git clone https://github.com/T-in-meet/Woodpecker.git
cd Woodpecker
npm install
cp .env.example .env.local   # 환경변수 값 입력 필요
npm run dev
```

`http://localhost:3000`에 접속합니다.

### Web Push 로컬 검증

기본 개발 서버(`npm run dev`)에서는 Service Worker가 비활성화됩니다.
Web Push를 검증하려면 VAPID 환경변수를 설정한 뒤 다음 명령으로 실행하세요.

```bash
npm run dev:sw
```

실행 후 사용할 브라우저에서 알림을 허용하고 Web Push를 구독해야 합니다.
실제 알림 발송을 검증하는 방법은 [CONTRIBUTING.md의 알림 발송 Cron](./CONTRIBUTING.md#알림-발송-cron)을 참고하세요.

Node.js 버전, 환경변수, Git Hook 등 상세한 개발 환경 설정은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 문제 해결

자주 발생하는 문제(Web Push 로컬 미동작, `VAPID_SUBJECT` 오류, CSS 변경 미반영, Format Check 실패, PowerShell 경로 문제 등)의 원인과 해결 방법은 [CONTRIBUTING.md의 트러블슈팅](./CONTRIBUTING.md#14-트러블슈팅)에 정리되어 있습니다.

## 지원 창구

버그 제보나 기능 제안은 [GitHub Issues](https://github.com/T-in-meet/Woodpecker/issues)로 남겨주세요.

## 문서

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 환경 설정, 커밋·브랜치 규칙, CI, 코드 스타일
- [.env.example](./.env.example) — 환경변수 목록과 설정 설명
- [supabase/migrations/](./supabase/migrations/) — DB 스키마 변경 이력
- [supabase/tests/](./supabase/tests/) — DB 제약·RLS·RPC 테스트
