# 딱다구리 (Woodpecker)

> 기록이 기억이 되는 공간 — 인지 과학 기반 간격 반복 학습 플랫폼

노트를 저장하는 순간 복습 일정이 자동으로 잡히고, 잊어버릴 즈음 알림이 오며, 백지 테스트와 퀴즈를 통해 실제로 기억하고 있는지 확인합니다.

🔗 **[서비스 바로가기](https://woodpecker-blue.vercel.app)**

<!-- TODO: 데모 GIF 또는 대표 스크린샷 추가 -->

---

## 팀

<!-- TODO: 팀원 및 역할 -->

## 왜 만들었나

사람은 학습한 내용을 시간이 지나면서 빠르게 잊어버립니다 (Ebbinghaus, 1885).
반면, 단순히 다시 읽는 것보다 기억에서 직접 정보를 꺼내보는 **인출 연습(retrieval practice)**이 장기적인 학습과 기억 유지에 효과적이라는 연구 결과가 있습니다 (Karpicke & Blunt, _Science_, 2011).

문제는 "복습해야지"라는 생각만으로는 실제 복습으로 이어지기 어렵다는 점입니다.
딱다구리는 노트를 기록하면 복습 시점을 자동으로 관리하고, 적절한 시점에 인출 훈련까지 이어질 수 있도록 돕습니다.

## 핵심 학습 흐름

| 단계             | 내용                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **1. 기록**      | 노트를 저장하면 복습 일정이 자동으로 생성됩니다. 별도로 캘린더나 알림을 설정할 필요가 없습니다.  |
| **2. 알림**      | 1일 → 3일 → 7일 간격으로 복습 시점에 웹 푸시 알림을 보냅니다.                                    |
| **3. 인출 훈련** | 백지 테스트로 직접 내용을 떠올려 작성하거나, AI가 노트에서 생성한 퀴즈를 풀며 기억을 확인합니다. |

복습을 완료하면 다음 복습 일정이 자동으로 예약됩니다.

## 주요 기능

- **자동 복습 스케줄링** — 노트 저장 시 1일 → 3일 → 7일 복습 일정 자동 생성
- **백지 테스트** — 기억에서 직접 내용을 인출해 작성하면 AI가 원문과 비교해 채점하고, 놓친 개념·오기억 포인트를 피드백으로 제공하며, 완료 시 다음 복습 자동 예약
- **AI 퀴즈** — 노트 내용을 기반으로 OX·객관식·빈칸 퀴즈를 자동 생성
- **웹 푸시 알림** — 사용자가 설정한 시간대에 복습 알림 발송
- **노트 에디터** — 마크다운, 코드 블록 하이라이트, 표, 체크리스트, 이미지, 슬래시 명령을 지원하는 TipTap 기반 에디터

### 기타 기능

이메일 인증 가입 · OAuth 로그인 · 오늘의 복습 · 마이페이지(프로필, 학습 통계) · 고객센터(1:1 문의, FAQ) · 관리자(사용자·문의 관리, 운영 오류 추적, 관리자 알림, 실험 화면)

<!-- TODO: 기능별 스크린샷 -->

## 기술 스택

| 영역       | 사용 기술                                     |
| ---------- | --------------------------------------------- |
| 프레임워크 | Next.js 15 (App Router), React 19, TypeScript |
| 백엔드/DB  | Supabase (Postgres, Auth, Storage, RLS, RPC)  |
| 상태 관리  | TanStack Query (서버 상태)                    |
| UI         | Tailwind CSS v4, shadcn/ui, lucide            |
| 에디터     | TipTap                                        |
| 알림       | Web Push (serwist), cron-job.org              |
| 검증       | Zod                                           |
| 이메일     | Resend / Nodemailer                           |
| 테스트     | Vitest, Testing Library, Playwright           |
| 배포/CI    | Vercel, GitHub Actions                        |

## 아키텍처 개요

```text
src/
├── app/          # 라우팅 전용 (App Router) — (auth) · (main) · (legal) · admin · api
├── features/     # 도메인 모듈 — auth · notes · review · quiz · notifications · mypage · editor · landing · admin
├── components/   # 공용 UI (ui · layout · providers)
├── hooks/        # 전역 훅
├── lib/          # Supabase 클라이언트, 상수, 검증, Web Push, 로거
└── types/        # DB·도메인 타입

supabase/migrations/   # DB 마이그레이션
tests/e2e/             # Playwright E2E
```

- 화면 보호와 데이터 접근에는 Supabase Auth 세션과 RLS를 기본으로 사용하고, cron·계정 삭제처럼 service role이 필요한 작업에만 admin 클라이언트를 사용합니다.
- 복습 완료와 다음 일정 생성은 Postgres RPC(`complete_review_and_schedule_next`)를 통해 원자적으로 처리합니다.
- 알림은 외부 스케줄러(cron-job.org)가 `/api/cron/dispatch-notifications`를 주기적으로 호출하고, 서버가 발송 대상을 조회해 Web Push를 전송하는 구조입니다.

## 기술적 고민

<!-- TODO: 추가 기술적 고민 정리 -->

## 빠른 시작

```bash
git clone https://github.com/T-in-meet/Woodpecker.git
cd woodpecker
npm install
cp .env.example .env.local   # 환경 변수 값 입력 필요
npm run dev
```

`http://localhost:3000`에 접속합니다.
Node.js 버전, 환경 변수, Git Hook 등 상세한 개발 환경 설정은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 문서

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 환경 설정, 커밋·브랜치 규칙, CI, 코드 스타일
- [src/features/review/README.md](./src/features/review/README.md) — 복습 플로우 상세
- [supabase/migrations/](./supabase/migrations/) — DB 스키마 변경 이력
