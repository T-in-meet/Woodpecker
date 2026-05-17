---
name: pr-workflow
description: PR(Pull Request) 생성 전 전체 워크플로우를 안내하는 skill. 사용자가 "PR 올려줘", "PR 만들어줘", "PR 작성해줘", "pr 올리기 전에", "pull request" 등을 언급하거나, 커밋 후 PR을 준비하는 상황이면 반드시 이 skill을 사용할 것. GitHub PR 생성, PR 메시지 작성, 머지 전 검증이 관련된 모든 상황에 적용.
---

# PR Workflow Skill

커밋 완료 후 PR을 올리기 직전 단계에서 사용하는 skill.

## 전체 흐름

```
1. 컨텍스트 파악
2. 머지 전 검증 (lint / typecheck / build)
3. PR 본문 초안 작성
4. 사용자 검토 요청
5. 승인 후 gh pr create 실행
```

---

## Step 1. 컨텍스트 파악

다음 정보를 순서대로 수집한다.

```bash
# 현재 브랜치 확인
git branch --show-current

# base 브랜치 대비 변경 커밋 목록
git log origin/development..HEAD --oneline

# 변경 파일 목록
git diff origin/development..HEAD --name-only

# PR 템플릿 읽기
cat .github/PULL_REQUEST_TEMPLATE.md
```

- base 브랜치는 기본적으로 `development` (hotfix는 `main`)
- 브랜치명 패턴: `feat/*`, `fix/*`, `hotfix/*`

---

## Step 2. 머지 전 검증

아래 3가지를 순서대로 실행. **하나라도 실패하면 PR 작성 전에 사용자에게 알리고 중단.**

```bash
# 1) Lint
npm run lint

# 2) TypeScript 타입 체크
npm run type-check

# 3) Build
npm run build
```

실패 시 출력:

```
❌ [lint|typecheck|build] 실패
[에러 요약]
PR 작성을 중단합니다. 위 에러를 수정한 뒤 다시 시도해 주세요.
```

---

## Step 3. PR 본문 초안 작성

`.github/PULL_REQUEST_TEMPLATE.md` 양식을 **그대로 유지**하면서 내용을 채운다.

### 제목

`타입: #이슈번호 - 한글 설명` 형식. Squash Merge이므로 제목이 최종 커밋 메시지가 됨.

### 각 섹션 작성 기준

| 섹션          | 작성 방법                                                   |
| ------------- | ----------------------------------------------------------- |
| 개요          | 무엇을/왜 변경했는지 — `git log` 커밋 메시지 종합           |
| PR 유형       | 브랜치 타입·변경 파일 보고 해당 항목 체크                   |
| 관련 이슈     | 브랜치명·커밋에서 이슈번호 추출, `closes #N`                |
| 작업 내용     | `git diff --stat` 기반으로 파일별 변경 요약                 |
| 테스트 방법   | 검증 가능한 실행 순서 기술                                  |
| 스크린샷      | FE 변경(UI/컴포넌트) 포함 시 `<!-- TODO: 스크린샷 첨부 -->` |
| 리뷰 요구사항 | 불확실하거나 피드백 필요한 부분 명시                        |
| 체크리스트    | Step 2 통과 항목 자동 체크, 나머지는 조건 보고 판단         |

**체크리스트 자동 판단 기준:**

- `- [x] lint 통과` — Step 2 통과 시
- `- [x] typecheck 통과` — Step 2 통과 시
- `- [x] 커밋 메시지 컨벤션 준수` — `git log` 메시지 형식 확인
- `- [ ] (DB 변경 시) migration 포함` — 변경 파일에 migration 없으면 미체크
- `- [ ] (권한/RLS 영향 시) 정책 변경 요약` — Supabase RLS 관련 파일 변경 시 확인
- 불확실한 항목은 미체크 상태로 두고 `<!-- 확인 필요 -->` 주석 추가

---

## Step 4. 사용자 검토 요청

초안을 출력한 뒤 **반드시 아래 형식으로 검토를 요청**하고 대기한다.

```
---
📋 PR 초안입니다. 검토 후 승인 여부를 알려주세요.

[작성된 PR 본문 전체]

---
✅ 승인하면 → "올려줘" 또는 "ok"
✏️ 수정 원하면 → 수정 내용 알려주세요
❌ 취소하면 → "취소"
```

사용자가 수정을 요청하면 수정 후 다시 Step 4로 돌아온다.

---

## Step 5. PR 생성

사용자 승인 후 실행:

```bash
gh pr create \
  --base development \
  --title "타입: #이슈번호 - 한글 설명" \
  --body-file .github/PULL_REQUEST_TEMPLATE.md \
  --reviewer hyehye12
```

- `--body-file` 대신 인라인으로 넣을 경우 heredoc 사용
- hotfix 브랜치면 `--base main`으로 변경
- `gh` CLI 미설치 시: `brew install gh && gh auth login` 안내

### 리뷰어 지정

팀원 GitHub 계정명을 skill에 직접 기재해두면 자동 지정 가능.  
**현재 팀 구성원 계정명을 알려주면 여기에 추가할 것.**  
기본 리뷰어: `hyehye12` (팀원 추가 시 쉼표로 구분하여 여기에 추가)

생성 후 PR URL 출력.

---

## 주의사항

- Squash Merge 전략 사용 → PR 제목이 squash commit 메시지가 됨. 제목 신중히 작성.
- 1 Approve 필수 → PR 생성 후 리뷰어 지정 필요 시 `--reviewer` 옵션 추가 안내
- `PULL_REQUEST_TEMPLATE.md`가 없으면 사용자에게 알리고 기본 양식으로 대체
