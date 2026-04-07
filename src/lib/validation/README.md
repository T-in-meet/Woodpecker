# Validation Guide

이 프로젝트의 validation은 **공통 규칙 + 기능별 조합** 구조로 동작한다.

---

## 1. 구조

```
src/lib/validation       → 공통 validation 규칙
src/features/.../schema  → 기능별 schema 조합
```

---

## 2. 기본 사용 방식

### 2-1. Form (UI)

```ts
import { emailFieldSchema } from "@/lib/validation/emailSchema";

export const formSchema = z.object({
  email: emailFieldSchema,
});
```

- 사용자 입력 검증
- 에러 메시지 포함

---

### 2-2. API (Server)

```ts
import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

export const apiSchema = z.object({
  email: normalizedEmailSchema,
});
```

- 외부 입력 검증
- trim 등 정규화 수행
- 메시지 없음

---

## 3. 서버 Validation 처리

```ts
const parsed = apiSchema.safeParse(body);

if (!parsed.success) {
  return failureResponse(CODE, {
    errors: mapValidationErrors(parsed.error, body),
  });
}
```

---

## 4. 에러 응답 형식

```ts
{
  success: false,
  code: "..._INVALID_INPUT",
  data: {
    errors: [
      { field: "email", reason: "INVALID_FORMAT" }
    ]
  }
}
```

---

## 5. 프론트 에러 처리

```ts
if (isServerValidationError(e)) {
  for (const { field, reason } of e.data.errors) {
    const message = mapReasonToMessage(reason);
    setError(field, { message });
  }
}
```

---

## 6. 필드 추가 방법

### 1. 공통 스키마 생성

```ts
// src/lib/validation/phoneSchema.ts
export const phoneFieldSchema = ...
export const normalizedPhoneSchema = ...
```

---

### 2. schema에 조합

```ts
const formSchema = z.object({
  phone: phoneFieldSchema,
});
```

---

### 3. reason 추가 (필요 시)

```ts
VALIDATION_REASON.INVALID_PHONE;
```

---

### 4. 메시지 매핑 추가

```ts
INVALID_PHONE: "올바른 전화번호를 입력해주세요";
```

---

## 7. 금지 규칙

### ❌ API schema에 메시지 넣지 말 것

```ts
// ❌
z.string().email("에러 메시지");
```

---

### ❌ 공통 스키마 없이 직접 작성 금지

```ts
// ❌
z.string().min(2);
```

---

### ❌ ZodError 그대로 응답 금지

```ts
// ❌
return parsed.error;
```

---

### ❌ reason 없이 메시지 직접 사용 금지

```ts
// ❌
setError("email", { message: "에러" });
```

---

## 8. 구조 요약

```
lib/validation
  → 규칙 (재사용)

feature/schema
  → 조합 (유스케이스)

API
  → 검증 + reason 변환

UI
  → reason → message → 표시
```

---
