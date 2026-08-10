# 기여 가이드 (개발 환경 세팅)

딱다구리 개발에 참여하기 위한 로컬 환경 세팅과 협업 규칙을 정리한 문서입니다.
서비스 소개는 [README.md](./README.md)를 참고하세요.

## 기술 스택

| 항목         | 버전                          |
| ------------ | ----------------------------- |
| Node.js      | 24.14.0 (LTS)                 |
| Next.js      | ^15.5.14                      |
| React        | 19.1.0                        |
| TypeScript   | ^5                            |
| Tailwind CSS | ^4                            |
| Supabase     | @supabase/supabase-js ^2.99.1 |

---

## 1. Node.js 버전 설정

nvm을 사용해 Node.js 버전을 맞춰야 합니다.

### nvm 설치 (없는 경우)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

설치 후 터미널 재시작 또는:

```bash
source ~/.zshrc  # zsh 사용 시
source ~/.bashrc # bash 사용 시
```

### Node.js 24.14.0 설치 및 적용

```bash
nvm install 24.14.0
nvm use 24.14.0
nvm alias default 24.14.0
```

### 버전 확인

```bash
node -v  # v24.14.0
npm -v
```

> 프로젝트에 `.nvmrc`는 없으므로 버전을 직접 지정해 전환합니다.
> GitHub Actions CI는 Node 20에서 실행되므로, 로컬에서만 재현되는 문제가 있으면 Node 버전 차이를 먼저 의심하세요.

---

## 2. 프로젝트 클론 및 의존성 설치

```bash
git clone https://github.com/T-in-meet/Woodpecker.git
cd woodpecker
npm install
```

> `npm install` 시 `prepare` 스크립트가 자동 실행되어 **husky(Git Hook)가 활성화**됩니다.

---

## 3. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성합니다.

```bash
cp .env.example .env.local
```

팀 공유 채널에서 환경 변수 값을 받아 `.env.local`에 입력하세요.
새 환경 변수를 추가하면 `.env.example`에도 반드시 추가합니다.

`NEXT_PUBLIC_*`만 클라이언트 번들에 노출됩니다. 그 외(`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `EMAIL_TICKET_SECRET`, `SUPABASE_HOOK_SECRET`, `RESEND_API_KEY`, `SMTP_*`)는 서버 전용이므로 클라이언트 코드에서 참조하지 않습니다.

### 알림 발송 Cron

복습 알림은 `/api/cron/dispatch-notifications` Route Handler가 발송합니다. 스케줄러는 저장소 밖의 외부 서비스 **cron-job.org**이며, 이 엔드포인트를 주기적으로 호출하는 방식입니다. `vercel.json`에는 crons 설정이 없으므로 실행 주기는 cron-job.org 대시보드에서 확인하세요.

호출에는 `Authorization: Bearer <CRON_SECRET>` 헤더가 필요하고 Route Handler가 이를 검증합니다. 엔드포인트 경로나 `CRON_SECRET`을 바꾸면 cron-job.org 설정도 함께 변경해야 합니다.

---

## 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 5. 주요 스크립트

| 명령어                        | 설명                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `npm run dev`                 | 개발 서버 실행 (Turbopack, Service Worker 비활성화)          |
| `npm run dev:sw`              | 개발 서버 실행 (Service Worker 활성화, Web Push 로컬 검증용) |
| `npm run build`               | 프로덕션 빌드                                                |
| `npm run start`               | 프로덕션 서버 실행                                           |
| `npm run lint`                | ESLint 검사                                                  |
| `npm run type-check`          | TypeScript 타입 검사                                         |
| `npx vitest run`              | 단위/컴포넌트 테스트 1회 실행                                |
| `npx playwright test`         | E2E 테스트 (`tests/e2e/`)                                    |
| `npx prettier --write <경로>` | 포맷 (CI가 `--check`로 검사)                                 |

> **`dev:sw` 보충 설명**
>
> - 일반 `npm run dev` 는 Turbopack + Serwist 호환 이슈를 피하기 위해 개발 환경에서 Service Worker(`/sw.js`) 를 비활성화한 상태로 실행됩니다 (`next.config.ts` 의 `disable` 조건 참고).
> - Web Push 알림 흐름을 로컬에서 검증하려면 SW 가 등록되어야 하므로, `dev:sw` 스크립트가 `ENABLE_SW=true` 환경변수를 주입해 Serwist 를 활성화합니다.
> - 환경변수 설정에 `cross-env` 를 사용하는 이유: Windows cmd/PowerShell 에서는 `ENABLE_SW=true next dev` 같은 인라인 문법이 동작하지 않습니다. 모든 셸에서 동일하게 동작시키기 위해 `cross-env` 를 거칩니다.

---

## 6. 테스트

- 단위/컴포넌트 테스트는 Vitest(`jsdom` 환경)를 사용하며 파일 이름은 `*.test.ts(x)`로 둡니다. 배치는 도메인 로직·유틸·컴포넌트는 대상 파일 옆 `tests/` 폴더를 기본으로 하고, App Router 페이지 테스트(`page.test.tsx`)와 `src/middleware.test.ts`는 대상 파일 옆에 직접 둡니다.
- 공용 Supabase 쿼리 mock은 `src/tests/supabaseQueryMock.ts`를 사용합니다.
- E2E는 `tests/e2e/`의 Playwright 테스트입니다.
- 변경 범위가 작아도 관련 테스트는 실행하고 PR을 올립니다.

---

## 7. Git Hook (husky)

커밋 시 자동으로 아래가 실행됩니다.

- **pre-commit**: `lint-staged` 실행 (ESLint + Prettier 자동 수정)
- **commit-msg**: `commitlint` 실행 (커밋 메시지 규칙 검사)

### 커밋 메시지 규칙

```
타입: #<issue번호> - 설명 (한글)
```

| 타입     | 용도             |
| -------- | ---------------- |
| feat     | 새 기능          |
| fix      | 버그 수정        |
| refactor | 리팩터링         |
| style    | 코드 포맷팅      |
| docs     | 문서 수정        |
| test     | 테스트 추가/수정 |
| chore    | 빌드/설정 변경   |

commitlint가 `@commitlint/config-conventional`을 사용하므로 위 타입 외에 `perf`, `build`, `ci`, `revert`도 허용됩니다. **`hotfix`는 허용 타입이 아니라 commit-msg 훅에서 거부됩니다** — 긴급 수정도 `fix`를 쓰고 브랜치 이름(`hotfix/...`)으로 구분하세요.

**예시:**

```
feat: #12 - 로그인 UI 구현
fix: #34 - 토큰 만료 처리 누락 수정
```

---

## 8. 브랜치 전략

```
feat/<issue>-<kebab-summary>  →  development  →  main
fix/<issue>-<kebab-summary>   →  development  →  main
hotfix/<kebab-summary>         →  main (+ development 반영)
```

- `main`, `development` 브랜치 직접 push 금지
- PR 머지 방식: **Squash Merge**
- 머지 후 브랜치 삭제
- PR에는 변경 개요, 관련 이슈, 테스트 방법, UI 변경 시 스크린샷을 포함합니다 (`.github/PULL_REQUEST_TEMPLATE.md`)
- DB/RLS를 변경했다면 migration 파일과 정책 영향 요약을 PR에 함께 적습니다

---

## 9. CI/CD

`development` 또는 `main`으로 PR을 열면 GitHub Actions(`.github/workflows/ci.yml`)가 자동 실행됩니다.

| Job               | 명령                                    |
| ----------------- | --------------------------------------- |
| Lint              | `npm run lint`                          |
| Format Check      | `npx prettier --check .`                |
| Dependency Review | `actions/dependency-review-action`      |
| Type Check        | `npx tsc --noEmit`                      |
| Test              | `npx vitest run`                        |
| Supabase SQL Test | `supabase start` 후 `supabase test db`  |
| Build             | `npm run build` (앞의 5개 통과 후 실행) |

**CI 실패 시 머지 불가**

> Format Check가 가장 자주 깨집니다. 파일을 수정했으면 커밋 전에 `npx prettier --write <수정한 파일>`을 실행하세요.

---

## 10. 코드 스타일

- **Prettier**: 설정 파일 없이 기본값을 사용합니다.
- **ESLint**: `eslint.config.mjs` — `next/core-web-vitals` + `next/typescript` + `simple-import-sort`
- **import 정렬 순서**:
  1. 외부 라이브러리 (`react`, `next`, 서드파티)
  2. 내부 절대경로 (`@/lib`, `@/components`, `@/features`)
  3. 상대경로 (`./`, `../`)
  4. 스타일/에셋
- 클릭 가능한 요소에는 `cursor-pointer`를 적용합니다.
- 라우트 경로는 문자열을 직접 쓰지 말고 `@/lib/constants/routes`의 상수/헬퍼를 사용합니다.

---

## 11. TypeScript 정책 요약

- `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` 적용
- `type`만 사용 (`interface` 사용 금지)
- `any` 사용 금지
- 외부 데이터는 `unknown`으로 받고 Zod로 검증
- `enum` 금지 → `as const union` 패턴 사용

---

## 12. 코드 배치 기준

| 종류                                   | 위치                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| 특정 도메인 전용 컴포넌트/훅/로직      | `src/features/[domain]/`                                           |
| 도메인의 Server Action / 조회 / 스키마 | `src/features/[domain]/`의 `actions.ts`, `queries.ts`, `schema.ts` |
| 여러 도메인이 쓰는 컴포넌트            | `src/components/` (ui·layout·providers)                            |
| 여러 도메인이 쓰는 훅                  | `src/hooks/`                                                       |
| 외부 서비스 어댑터, 순수 유틸(UI 없음) | `src/lib/`                                                         |
| 전역 DB·도메인 타입                    | `src/types/`                                                       |
| 라우팅                                 | `src/app/` — 비즈니스 로직을 두지 않습니다                         |

Server Action은 Zod `safeParse`로 입력을 검증하고 `{ data: T } | { error: string | fieldErrors }` 형태로 반환합니다. 인증이 필요한 작업은 `supabase.auth.getUser()`로 사용자를 확인한 뒤 수행합니다.

DB를 변경할 때는 `supabase/migrations/`에 `YYYYMMDDHHMMSS_설명.sql` 형식으로 migration을 추가하고, RLS·제약·RPC에 영향이 있으면 `supabase/tests/`도 함께 갱신합니다.

마이그레이션 적용 경로는 DB에 따라 다릅니다.

- **운영 DB**: `main`에 `supabase/migrations/**` 변경이 푸시되면 `.github/workflows/migrate.yml`이 `supabase db push`로 자동 적용합니다. 대시보드에서 손으로 적용하지 마세요 — push 히스토리에 남지 않아 이후 자동 배포가 충돌합니다.
- **개발 DB**: 운영과 별도 Supabase 프로젝트이며, 개발 중에는 대시보드 SQL Editor로 직접 적용해 테스트합니다.

---

## 13. VSCode 추천 익스텐션

- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense

`settings.json`에 아래 추가 권장:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```
