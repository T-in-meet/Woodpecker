# 딱다구리 (Woodpecker)

> 기록이 기억이 되는 공간 — 인지 과학 기반 간격 반복 학습 플랫폼

노트를 저장하는 순간 복습 일정이 자동으로 잡히고, 잊어버릴 즈음 알림이 오고, 백지 테스트로 실제로 기억하는지 확인합니다.

🔗 **[서비스 바로가기](https://woodpecker-blue.vercel.app)**

<!-- TODO: 데모 GIF 또는 대표 스크린샷 추가 -->

---

## 왜 만들었나

공부한 내용의 **67%는 24시간 안에 잊힙니다** (Ebbinghaus, 1885).
다시 읽는 것보다 **직접 꺼내보는 인출 연습이 1주일 후 기억 유지량을 50% 이상 높입니다** (Karpicke & Blunt, 2011).

문제는 "복습해야지"라는 생각만으로는 실제로 복습하지 않는다는 점입니다.
딱다구리는 기록만 하면 복습 시점과 인출 훈련을 서비스가 대신 챙겨줍니다.

## 핵심 학습 흐름

| 단계               | 내용                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| **1. 기록**        | 노트를 저장하면 복습 일정이 자동 생성됩니다. 캘린더나 알림 설정이 필요 없습니다. |
| **2. 알림**        | 1일 → 3일 → 7일 간격으로 복습 시점에 웹 푸시 알림을 보냅니다.                    |
| **3. 백지 테스트** | 빈 화면에 기억나는 내용을 직접 쓰고, 원문과 나란히 비교합니다.                   |

복습을 완료하면 다음 회차(`review_round` 0 → 1 → 2 → 3)가 원자적으로 예약됩니다.

## 주요 기능

- **노트 작성** — TipTap 기반 에디터 (마크다운, 코드 블록 하이라이트, 표, 체크리스트, 이미지, 슬래시 명령)
- **오늘의 복습** — 오늘 복습할 노트만 모아보기
- **백지 테스트** — 인출 연습 후 원문과 비교, 완료 시 다음 회차 자동 예약
- **웹 푸시 알림** — 알림 수신 시간대 설정, 구독 관리
- **계정** — 이메일 인증 가입, OAuth 로그인, 비밀번호 재설정, 계정 삭제
- **마이페이지** — 프로필, 학습 통계
- **고객센터** — 1:1 문의(이미지 첨부), FAQ
- **관리자** — 사용자·문의 관리, 운영 오류 추적, 관리자 알림, 실험 화면

<!-- TODO: 기능별 스크린샷 -->

## 기술 스택

| 영역       | 사용 기술                                     |
| ---------- | --------------------------------------------- |
| 프레임워크 | Next.js 15 (App Router), React 19, TypeScript |
| 백엔드/DB  | Supabase (Postgres, Auth, Storage, RLS, RPC)  |
| 상태 관리  | TanStack Query (서버 상태)                    |
| UI         | Tailwind CSS v4, shadcn/ui, lucide            |
| 에디터     | TipTap                                        |
| 알림       | Web Push (serwist), cron-job.org 스케줄러     |
| 검증       | Zod                                           |
| 이메일     | Resend / Nodemailer                           |
| 테스트     | Vitest, Testing Library, Playwright           |
| 배포/CI    | Vercel, GitHub Actions                        |

## 아키텍처 개요

```text
src/
├── app/          # 라우팅 전용 (App Router) — (auth) · (main) · (legal) · admin · api
├── features/     # 도메인 모듈 — auth · notes · review · notifications · mypage · editor · landing · admin
├── components/   # 공용 UI (ui · layout · providers)
├── hooks/        # 전역 훅
├── lib/          # Supabase 클라이언트, 상수, 검증, Web Push, 로거
└── types/        # DB·도메인 타입

supabase/migrations/   # DB 마이그레이션
tests/e2e/             # Playwright E2E
```

- 화면 보호와 데이터 접근은 Supabase Auth 세션 + RLS를 기본으로 하고, cron·계정 삭제처럼 service role이 필요한 작업만 admin 클라이언트를 사용합니다.
- 복습 완료 처리는 Postgres RPC(`complete_review_and_schedule_next`)로 원자적으로 수행합니다.
- 알림 발송은 `/api/cron/dispatch-notifications`를 외부 스케줄러(cron-job.org)가 주기적으로 호출하는 구조입니다.

## 빠른 시작

```bash
git clone https://github.com/T-in-meet/Woodpecker.git
cd woodpecker
npm install
cp .env.example .env.local   # 환경 변수 값 입력 필요
npm run dev
```

`http://localhost:3000` 접속. Node.js 버전, 환경 변수, Git Hook 등 상세 세팅은 [CONTRIBUTING.md](./CONTRIBUTING.md)를 참고하세요.

## 문서

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 환경 세팅, 커밋·브랜치 규칙, CI, 코드 스타일
- [src/features/review/README.md](./src/features/review/README.md) — 복습 플로우 상세
- [supabase/migrations/](./supabase/migrations/) — DB 스키마 변경 이력

## 팀

<!-- TODO: 팀원 및 역할 -->

## 라이선스

<!-- TODO: 라이선스 결정 후 명시 -->
