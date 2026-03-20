# 딱다구리 개발 환경 세팅 가이드

## 기술 스택

| 항목         | 버전                          |
| ------------ | ----------------------------- |
| Node.js      | 24.14.0 (LTS)                 |
| Next.js      | 15.5.12                       |
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

> 프로젝트 루트에 `.nvmrc` 파일이 있어 `nvm use`만 입력해도 자동 전환됩니다.

---

## 2. 프로젝트 클론 및 의존성 설치

```bash
git clone <레포지토리 URL>
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

---

## 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 5. 주요 스크립트

| 명령어          | 설명                       |
| --------------- | -------------------------- |
| `npm run dev`   | 개발 서버 실행 (Turbopack) |
| `npm run build` | 프로덕션 빌드              |
| `npm run start` | 프로덕션 서버 실행         |
| `npm run lint`  | ESLint 검사                |

---

## 6. Git Hook (husky)

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
| hotfix   | 긴급 수정        |

**예시:**

```
feat: #12 - 로그인 UI 구현
fix: #34 - 토큰 만료 처리 누락 수정
```

---

## 7. 브랜치 전략

```
feat/<issue>-<kebab-summary>  →  develop  →  main
fix/<issue>-<kebab-summary>   →  develop  →  main
hotfix/<kebab-summary>         →  main (+ develop 반영)
```

- `main`, `develop` 브랜치 직접 push 금지
- PR 머지 방식: **Squash Merge**
- 머지 후 브랜치 삭제

---

## 8. CI/CD

PR 생성 시 GitHub Actions가 자동 실행됩니다.

- lint 검사
- TypeScript 타입 체크
- 빌드 검사

**CI 실패 시 머지 불가**

---

## 9. 코드 스타일

- **Prettier**: 기본값 사용 (`.prettierrc` 참고)
- **ESLint**: `eslint-config-next` + `@typescript-eslint/recommended` + `simple-import-sort`
- **import 정렬 순서**:
  1. 외부 라이브러리 (`react`, `next`, 서드파티)
  2. 내부 절대경로 (`@/lib`, `@/components`, `@/features`)
  3. 상대경로 (`./`, `../`)
  4. 스타일/에셋

---

## 10. TypeScript 정책 요약

- `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` 적용
- `type`만 사용 (`interface` 사용 금지)
- `any` 사용 금지
- 외부 데이터는 `unknown`으로 받고 Zod로 검증
- `enum` 금지 → `as const union` 패턴 사용

---

## 11. VSCode 추천 익스텐션

- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)

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
