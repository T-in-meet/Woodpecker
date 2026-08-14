SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict IATxcSd8C6cibK9MLndjYwVvUNKe0uk5YBBF6ijB836QL5NkOztjenFDclc9Xq9

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'user.feedback.one@example.com', '$2a$10$VWl0LcKZ3/RoUALBOSlC0OpVgBo3iV8GiWSNsyGvaGGSkcMMVaUB6', '2026-08-06 08:03:01.345454+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"nickname": "fbuser1", "email_verified": true, "canonical_email": "user.feedback.one@example.com"}', NULL, '2026-08-06 08:03:01.331726+00', '2026-08-06 08:03:01.347188+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'user.feedback.two@example.com', '$2a$10$O/f0x2iO.a2msRiR6DCxqOMmK08uCs6tPhDUfjT.SToo77B4ywIRu', '2026-08-06 08:03:01.590336+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"nickname": "fbuser2", "email_verified": true, "canonical_email": "user.feedback.two@example.com"}', NULL, '2026-08-06 08:03:01.574667+00', '2026-08-06 08:03:01.592355+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'admin.feedback.local@example.com', '$2a$10$cLhpGu0Nny/ISEA5xVS5xeETPhdPaBTdBiw88xqxQTrIXolc9Dj0.', '2026-08-06 08:03:01.099686+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-08-06 08:05:51.010938+00', '{"provider": "email", "providers": ["email"]}', '{"nickname": "adminfb", "email_verified": true, "canonical_email": "admin.feedback.local@example.com"}', NULL, '2026-08-06 08:03:01.072331+00', '2026-08-07 04:24:21.72812+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '{"sub": "11111111-1111-4111-8111-111111111111", "email": "admin.feedback.local@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-08-06 08:03:01.09094+00', '2026-08-06 08:03:01.091062+00', '2026-08-06 08:03:01.091062+00', '2c230868-a387-4990-97be-c4dd19799a2c'),
	('22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', '{"sub": "22222222-2222-4222-8222-222222222222", "email": "user.feedback.one@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-08-06 08:03:01.339841+00', '2026-08-06 08:03:01.339897+00', '2026-08-06 08:03:01.339897+00', 'bf61a3f0-ba98-4018-a5d0-77548caa5c08'),
	('33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', '{"sub": "33333333-3333-4333-8333-333333333333", "email": "user.feedback.two@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-08-06 08:03:01.583261+00', '2026-08-06 08:03:01.583342+00', '2026-08-06 08:03:01.583342+00', '2e25fcc5-a4ca-43f7-a36c-9fd804169a79');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: admin_notification_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: admin_notification_reads; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notes" ("id", "user_id", "title", "content", "review_round", "next_review_at", "created_at", "updated_at", "notification_time_of_day") VALUES
	('c29e35d5-f174-4c5b-ae4c-dc35d63b8a8e', '11111111-1111-4111-8111-111111111111', '프로세스(Process)와 스레드(Thread)', '## 프로세스(Process)

### 정의

프로세스는 **실행 중인 프로그램**이다.

프로그램(Program)은 디스크에 저장된 실행 파일이고, 프로세스는 운영체제가 메모리에 적재하여 실제로 실행되고 있는 상태를 의미한다.

예를 들어 Chrome을 실행하면 하나 이상의 프로세스가 생성된다.

---

## 프로세스의 구성

프로세스는 일반적으로 다음과 같은 메모리 영역을 가진다.

```
```

```
+----------------------+
| Code(Text)           |  실행 코드
+----------------------+
| Data                 |  전역 변수, static 변수
+----------------------+
| Heap                 |  동적 메모리(new, malloc)
| ↑                    |
|                      |
|                      |
| ↓                    |
| Stack                |  함수 호출, 지역 변수
+----------------------+
```

### 1. Code(Text)

- \
  실행 가능한 기계어 코드
- \
  읽기 전용(Read Only)

예)

```
```

```
int add(int a, int b) {
    return a + b;
}
```

---

### 2. Data

프로그램이 시작될 때 생성되는 데이터

- \
  전역 변수
- \
  static 변수

```
```

```
int count = 0;
static int num = 10;
```

---

### 3. Heap

프로그램 실행 중 동적으로 할당되는 메모리

```
```

```
int* arr = new int[100];
```

특징

- \
  개발자가 직접 관리
- \
  큰 객체 저장
- \
  Stack보다 느림

---

### 4. Stack

함수 호출 정보를 저장한다.

저장되는 것

- \
  지역 변수
- \
  매개변수
- \
  반환 주소

```
```

```
void foo() {
    int x = 10;
}
```

foo가 끝나면 Stack도 자동 제거된다.

---

# 프로세스의 특징

- \
  독립적인 메모리 공간을 가진다.
- \
  다른 프로세스의 메모리에 직접 접근할 수 없다.
- \
  운영체제가 자원을 할당한다.
- \
  하나 이상의 스레드를 포함한다.

---

# 프로세스 생성

예를 들어

```
```

```
메모장 실행
```

↓

운영체제

```
```

```
notepad.exe
```

↓

```
```

```
Process 생성
```

↓

CPU에서 실행

---

# 프로세스 간 통신(IPC)

프로세스는 메모리를 공유하지 않는다.

따라서 데이터를 주고받기 위해 IPC(Inter Process Communication)가 필요하다.

대표적인 IPC

- \
  Pipe
- \
  Socket
- \
  Shared Memory
- \
  Message Queue

---

# 스레드(Thread)

## 정의

스레드는 **프로세스 내부에서 실제 작업을 수행하는 실행 단위**이다.

프로세스 안에는 하나 이상의 스레드가 존재할 수 있다.

```
```

```
프로세스
 ├─ Thread 1
 ├─ Thread 2
 └─ Thread 3
```

---

## 왜 필요한가?

예를 들어 웹 브라우저

- \
  화면 그리기
- \
  네트워크 요청
- \
  동영상 재생

이 모든 작업을 하나의 실행 흐름으로 수행하면 화면이 멈춘다.

스레드를 사용하면 동시에 처리할 수 있다.

---

# 스레드의 구성

스레드는 자신만의

- \
  Stack
- \
  Program Counter(PC)
- \
  Register

를 가진다.

하지만 다음은 공유한다.

- \
  Code
- \
  Data
- \
  Heap

```
```

```
Process

 Code
 Data
 Heap
 ┌───────────────┐
 │ 공유           │
 └───────────────┘

Thread A
 Stack

Thread B
 Stack

Thread C
 Stack
```

---

# 스레드가 공유하는 것

공유

- \
  Code
- \
  Heap
- \
  Data
- \
  열린 파일
- \
  프로세스 자원

독립

- \
  Stack
- \
  Register
- \
  PC

---

# 멀티스레드

여러 개의 스레드를 이용하여 작업을 동시에 수행한다.

예)

게임

```
```

```
Thread 1
→ 입력 처리

Thread 2
→ 렌더링

Thread 3
→ 사운드

Thread 4
→ 네트워크
```

---

# 멀티스레드의 장점

## 1. 응답성 향상

UI가 멈추지 않는다.

예)

```
```

```
파일 다운로드

↓

UI Thread는 계속 동작
```

---

## 2. 자원 공유

프로세스 내부 메모리를 공유하므로

복사 비용이 적다.

---

## 3. 생성 비용이 적다.

프로세스를 새로 만드는 것보다

스레드를 만드는 것이 훨씬 빠르다.

---

## 4. Context Switching 비용 감소

프로세스보다 전환 비용이 적다.

---

# 멀티스레드의 단점

## 1. 동기화 문제

공유 데이터를 동시에 수정할 수 있다.

예)

```
```

```
count = 0

Thread A
count++

Thread B
count++
```

기대한 결과

```
```

```
2
```

실제 결과

```
```

```
1
```

이러한 문제를 **Race Condition(경쟁 상태**)이라고 한다.

---

## 2. Deadlock

두 스레드가 서로의 자원을 기다리는 상태

```
```

```
A가 Lock1 보유

B가 Lock2 보유

A는 Lock2 대기

B는 Lock1 대기
```

↓

무한 대기

---

## 3. 디버깅이 어렵다.

실행 순서가 매번 달라질 수 있다.

---

# 프로세스 vs 스레드

| 구분 | 프로세스 | 스레드 |
| --- | --- | --- |
| 정의 | 실행 중인 프로그램 | 프로세스 내부의 실행 단위 |
| 메모리 | 독립적인 메모리 공간 | 프로세스의 메모리 공유 |
| 생성 비용 | 큼 | 작음 |
| Context Switching | 상대적으로 느림 | 상대적으로 빠름 |
| 데이터 공유 | IPC 필요 | 메모리 공유 |
| 안정성 | 높음 | 하나의 스레드 문제가 프로세스 전체에 영향을 줄 수 있음 |
| 통신 | IPC 사용 | 공유 메모리 사용 |

---

# Context Switching

CPU는 한 번에 하나의 스레드(또는 프로세스)만 실행한다.

운영체제는 매우 빠르게 실행 대상을 바꾸며 여러 작업이 동시에 실행되는 것처럼 보이게 한다.

```
```

```
Thread A 실행
      ↓
Context Switching
      ↓
Thread B 실행
      ↓
Context Switching
      ↓
Thread C 실행
```

Context Switching 시에는 현재 실행 중인 스레드의 **레지스터, 프로그램 카운터(PC), 스택 포인터 등의 실행 상태(Context**)를 저장하고, 다음 스레드의 상태를 복원한다. 프로세스 전환은 주소 공간 전환까지 필요하므로 일반적으로 스레드 전환보다 비용이 더 크다.

---

# 면접 핵심 질문

### Q1. 프로세스와 스레드의 가장 큰 차이는?

- \
  프로세스는 독립적인 실행 환경을 가지며 메모리를 공유하지 않는다.
- \
  스레드는 하나의 프로세스 내부에서 실행되며 Code, Data, Heap을 공유한다.

---

### Q2. 스레드는 왜 빠른가?

- \
  별도의 주소 공간을 만들 필요가 없고, 기존 프로세스의 자원을 공유하므로 생성 및 Context Switching 비용이 상대적으로 적다.

---

### Q3. 스레드가 공유하지 않는 것은?

- \
  Stack
- \
  Program Counter(PC)
- \
  Register

---

### Q4. 멀티스레드의 가장 큰 문제는?

- \
  공유 자원 접근으로 인해 **Race Condition**, **Deadlock**, **동기화 비용**이 발생할 수 있다.

---

# 한 줄 요약

- **프로세스(Process)**: 운영체제가 관리하는 **독립적인 실행 단위**로, 자신만의 메모리 공간을 가진다.
- **스레드(Thread)**: 프로세스 내부에서 실제 작업을 수행하는 **실행 흐름**으로, 프로세스의 자원을 공유하면서 독립적인 Stack과 실행 상태를 가진다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:17:14.964413+00', '2026-08-06 08:17:14.964413+00', NULL),
	('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222', '간격 반복 설정 메모', '복습 알림 시간이 바뀌는 상황을 확인하기 위한 로컬 seed 메모입니다.', 1, '2026-07-25 00:00:00+00', '2026-08-06 08:03:01.787415+00', '2026-08-06 08:03:01.787415+00', '09:00:00'),
	('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '33333333-3333-4333-8333-333333333333', '이미지 첨부 테스트 메모', '피드백 상세에서 note_id 연결 표시를 확인하기 위한 메모입니다.', 2, '2026-07-28 00:00:00+00', '2026-08-06 08:03:01.787415+00', '2026-08-06 08:03:01.787415+00', '21:30:00'),
	('9d036509-c791-40ff-994a-6abe4a8c7673', '11111111-1111-4111-8111-111111111111', '슬라이딩 윈도우(Sliding Window)', '슬라이딩 윈도우(Sliding Window)는 **배열이나 문자열에서 연속된 구간을 효율적으로 탐색하는 알고리즘 기법**입니다.

브루트포스로 모든 구간을 다시 계산하면 **O(N²**)이 걸리는 문제를 **O(N**)으로 줄일 수 있는 경우가 많아 코딩 테스트에서 매우 자주 등장합니다.

---

# 1. 핵심 아이디어

이름 그대로 **"창(Window)을 옆으로 미는 것**"입니다.

예를 들어

```
```

```
[1, 2, 3, 4, 5]
```

크기가 3인 윈도우라면

```
```

```
[1 2 3]
  [2 3 4]
    [3 4 5]
```

처럼 한 칸씩 이동합니다.

기존 계산을 버리지 않고

- \
  빠지는 값 제거
- \
  새로 들어오는 값 추가

만 하면 됩니다.

---

# 2. 왜 빠른가?

예를 들어 길이가 K인 구간의 합을 구한다고 하겠습니다.

### 브루트포스

```
```

```
1+2+3
2+3+4
3+4+5
```

매번 K개를 다시 더합니다.

```
```

```
O(N*K)
```

---

### 슬라이딩 윈도우

처음만 계산

```
```

```
1+2+3 = 6
```

다음

```
```

```
6
-1
+4
=
9
```

다음

```
```

```
9
-2
+5
=
12
```

항상

```
```

```
이전 결과
- 빠지는 값
+ 들어오는 값
```

만 수행합니다.

```
```

```
O(N)
```

---

# 3. 고정 크기(Window Size Fixed)

가장 쉬운 형태입니다.

예제

```
```

```
nums = [2,1,5,1,3,2]
k = 3
```

윈도우

```
```

```
2 1 5 = 8

 1 5 1 = 7

  5 1 3 = 9

   1 3 2 = 6
```

최댓값

```
```

```
9
```

---

## 코드

```
```

```
function maxSum(nums: number[], k: number): number {
  let sum = 0;

  for (let i = 0; i < k; i++) {
    sum += nums[i];
  }

  let answer = sum;

  for (let right = k; right < nums.length; right++) {
    sum += nums[right];
    sum -= nums[right - k];

    answer = Math.max(answer, sum);
  }

  return answer;
}
```

---

# 4. 가변 크기(Window Size Variable)

실제로 더 많이 사용하는 형태입니다.

윈도우의 크기가 계속 변합니다.

예를 들어

> 합이 S 이상인 가장 짧은 부분 배열

```
```

```
2 3 1 2 4 3
```

합이 7 이상이 되면

```
```

```
2 3 1 2
```

왼쪽을 줄입니다.

```
```

```
3 1 2
```

또 조건이 안 되면 오른쪽을 늘립니다.

```
```

```
3 1 2 4
```

이런 식입니다.

---

## 원리

```
```

```
right 증가

조건 만족

↓

left 증가
```

즉

```
```

```
늘리고

↓

줄이고

↓

늘리고

↓

줄이고
```

를 반복합니다.

---

# 5. Two Pointer와의 관계

많은 사람들이 헷갈립니다.

사실

> **슬라이딩 윈도우는 Two Pointer의 한 종류**입니다.

```
```

```
left
right
```

두 포인터를 사용하지만

윈도우를 유지하는 것이 목적입니다.

예를 들어

```
```

```
L      R

1 2 3 4 5
```

계속

```
```

```
L++

R++
```

또는

```
```

```
R++

조건 만족

L++
```

을 수행합니다.

---

# 6. 언제 사용할까?

대표적인 키워드

- \
  연속된 부분 배열
- \
  연속된 문자열
- \
  길이가 K
- \
  가장 긴
- \
  가장 짧은
- \
  최대 합
- \
  최소 합
- \
  조건을 만족하는 구간

이런 문장이 나오면 슬라이딩 윈도우를 먼저 떠올리면 됩니다.

---

# 7. 대표 문제

### ① 길이가 K인 최대 합

```
```

```
[2,1,5,1,3,2]
```

---

### ② 중복 없는 가장 긴 문자열

```
```

```
abcabcbb
```

정답

```
```

```
abc
```

---

### ③ 합이 S 이상인 최소 길이

```
```

```
2 3 1 2 4 3
```

---

### ④ 과일 담기(Fruit Into Baskets)

```
```

```
1 2 1 2 3
```

종류가 2개 이하인 가장 긴 구간

---

### ⑤ Longest Repeating Character Replacement

문자를 최대 K번 바꿀 수 있을 때 가장 긴 문자열

---

# 8. 시간복잡도

브루트포스

```
```

```
O(N²)
```

슬라이딩 윈도우

```
```

```
O(N)
```

왜냐하면

```
```

```
left

↓

0 → N

right

↓

0 → N
```

각 포인터가 배열을 **한 번씩만** 이동하기 때문입니다.

---

# 9. 구현 템플릿

가변 길이 슬라이딩 윈도우는 대부분 아래 형태를 따릅니다.

```
```

```
let left = 0;

for (let right = 0; right < nums.length; right++) {
  // right 추가

  while (조건을 만족하지 않음) {
    // left 제거
    left++;
  }

  // 현재 윈도우로 정답 갱신
}
```

또는

```
```

```
let left = 0;

for (let right = 0; right < nums.length; right++) {
  // right 추가

  while (조건을 만족함) {
    // 정답 갱신

    // left 제거
    left++;
  }
}
```

---

# 10. 투 포인터와의 차이

| 구분 | 투 포인터 | 슬라이딩 윈도우 |
| --- | --- | --- |
| 목적 | 두 포인터를 이용해 탐색 | 연속된 구간(Window) 유지 |
| 포인터 | 상황에 따라 이동 | 윈도우를 유지하며 이동 |
| 대표 문제 | 정렬 배열의 합, 병합 등 | 부분 배열, 부분 문자열 |
| 조건 | 다양함 | 연속 구간이 핵심 |

슬라이딩 윈도우는 **연속된 구간을 효율적으로 관리하는 투 포인터 기법**으로 이해하면 가장 자연스럽습니다.

---

## 한 줄 요약

- **고정 크기 슬라이딩 윈도우**: 창의 크기가 항상 일정하며, `들어오는 값 추가 + 나가는 값 제거`로 갱신한다.
- **가변 크기 슬라이딩 윈도우**: `left`와 `right` 포인터를 움직이며 조건을 만족하는 가장 적절한 연속 구간을 유지한다.
- **시간 복잡도는 대부분 O(N**)으로, 연속된 부분 배열이나 부분 문자열 문제에서 매우 강력한 기법이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:10:49.942502+00', '2026-08-06 08:10:49.942502+00', NULL),
	('fc0bc2e9-6653-40c8-87bf-077c44865680', '11111111-1111-4111-8111-111111111111', '투 포인터(Two Pointer)', '투 포인터(Two Pointer)는 **배열이나 리스트에서 두 개의 포인터를 이용하여 탐색하는 알고리즘 기법**입니다.

많은 문제를 **O(N²**)에서 **O(N)** 또는 **O(N log N**)으로 줄일 수 있어 코딩 테스트에서 매우 자주 사용됩니다.

---

# 1. 핵심 아이디어

배열을 탐색할 때

하나의 인덱스만 사용하는 것이 아니라

```
```

```
left
right
```

두 개의 위치를 동시에 관리합니다.

예를 들어

```
```

```
1 2 3 4 5 6 7
L           R
```

상황에 따라

- \
  왼쪽만 이동
- \
  오른쪽만 이동
- \
  둘 다 이동

합니다.

---

# 2. 왜 사용하는가?

브루트포스

```
```

```
모든 쌍 확인
```

```
```

```
O(N²)
```

예를 들어

```
```

```
1 2 3 4 5
```

모든 두 수의 합을 확인하면

```
```

```
5²
```

정도의 비교가 필요합니다.

---

투 포인터를 사용하면

```
```

```
한 번만 순회
```

가능한 경우가 많습니다.

```
```

```
O(N)
```

---

# 3. 대표 유형 ① 양쪽에서 시작하는 투 포인터

가장 유명한 형태입니다.

정렬된 배열에서 많이 사용됩니다.

예제

```
```

```
nums = [1,2,3,4,6]
target = 6
```

초기 상태

```
```

```
1 2 3 4 6
L       R
```

합

```
```

```
1+6=7
```

너무 큼

↓

```
```

```
R--
```

```
```

```
1 2 3 4 6
L     R
```

합

```
```

```
1+4=5
```

너무 작음

↓

```
```

```
L++
```

```
```

```
1 2 3 4 6
  L   R
```

합

```
```

```
2+4=6
```

정답

---

## 코드

```
```

```
function hasPair(nums: number[], target: number): boolean {
  let left = 0;
  let right = nums.length - 1;

  while (left < right) {
    const sum = nums[left] + nums[right];

    if (sum === target) {
      return true;
    }

    if (sum < target) {
      left++;
    } else {
      right--;
    }
  }

  return false;
}
```

---

# 4. 대표 유형 ② 같은 방향으로 이동

이 형태가 슬라이딩 윈도우의 기반입니다.

예를 들어

```
```

```
left

right
```

둘 다

```
```

```
→
```

방향으로 이동합니다.

```
```

```
1 2 3 4 5 6

L
R
```

↓

```
```

```
1 2 3 4 5 6

L R
```

↓

```
```

```
1 2 3 4 5 6

  L   R
```

---

이 방식은

- \
  부분 배열
- \
  부분 문자열

문제에서 많이 사용됩니다.

---

# 5. 슬라이딩 윈도우와의 관계

많은 사람들이 헷갈리는 부분입니다.

관계는

```
```

```
투 포인터
    │
    ├── 양쪽에서 시작
    │
    ├── 같은 방향 이동
    │
    └── 슬라이딩 윈도우
```

즉

> **슬라이딩 윈도우는 투 포인터를 사용하는 기법 중 하나**입니다.

모든 슬라이딩 윈도우는 투 포인터이지만,

모든 투 포인터가 슬라이딩 윈도우는 아닙니다.

예를 들어

```
```

```
Two Sum
```

은 투 포인터지만

윈도우는 없습니다.

---

# 6. 언제 사용할까?

다음 키워드가 보이면 떠올립니다.

- \
  정렬된 배열
- \
  두 수의 합
- \
  두 수의 차
- \
  중복 제거
- \
  부분 배열
- \
  연속 구간
- \
  가장 긴 구간
- \
  가장 짧은 구간

---

# 7. 대표 문제

### ① Two Sum (정렬)

```
```

```
1 2 3 4 6
```

---

### ② Three Sum

```
```

```
-1 0 1 2 -1
```

정렬 후

하나는 고정

나머지 둘은 투 포인터

---

### ③ Container With Most Water

```
```

```
1 8 6 2 5
```

양 끝에서 시작

---

### ④ Remove Duplicates

```
```

```
1 1 2 2 3
```

느린 포인터

빠른 포인터

---

### ⑤ Merge Sorted Array

두 배열을 동시에 탐색

---

### ⑥ 슬라이딩 윈도우 문제

사실상

```
```

```
left
right
```

두 포인터입니다.

---

# 8. 구현 패턴

## 패턴 1

양쪽에서 시작

```
```

```
let left = 0;
let right = nums.length - 1;

while (left < right) {
  if (...) {
    left++;
  } else {
    right--;
  }
}
```

---

## 패턴 2

같은 방향

```
```

```
let left = 0;

for (let right = 0; right < nums.length; right++) {
  while (...) {
    left++;
  }
}
```

슬라이딩 윈도우 대부분이 이 형태입니다.

---

## 패턴 3

빠른 포인터 / 느린 포인터

```
```

```
let slow = 0;

for (let fast = 0; fast < nums.length; fast++) {
  if (...) {
    nums[slow] = nums[fast];
    slow++;
  }
}
```

중복 제거 문제에서 자주 사용됩니다.

---

# 9. 시간복잡도

브루트포스

```
```

```
O(N²)
```

투 포인터

```
```

```
O(N)
```

또는

```
```

```
O(N log N)
```

(정렬이 필요한 경우)

왜냐하면

각 포인터가 대부분 **한 방향으로만 이동**하기 때문입니다.

예를 들어

```
```

```
left

0 → N
```

```
```

```
right

0 → N
```

각각 최대 N번만 움직입니다.

---

# 10. 투 포인터 vs 슬라이딩 윈도우

| 구분 | 투 포인터 | 슬라이딩 윈도우 |
| --- | --- | --- |
| 개념 | 두 개의 포인터를 사용해 탐색 | 연속된 구간(Window)을 유지하며 탐색 |
| 포인터 방향 | 양쪽 또는 같은 방향 | 같은 방향 |
| 윈도우 유지 | 필수 아님 | 필수 |
| 대표 문제 | Two Sum, Three Sum, Remove Duplicates | 최대 합, 최소 길이, 부분 문자열 |

예를 들어,

- **Two Sum**은 `left`와 `right`가 양쪽에서 시작해 조건에 따라 움직이므로 **투 포인터**입니다.
- **최대 합 부분 배열**은 `left`와 `right`가 같은 방향으로 움직이며 연속 구간을 유지하므로 **슬라이딩 윈도우(=투 포인터의 한 종류**)입니다.

---

# 11. 문제를 보고 판단하는 방법

| 문제 특징 | 추천 기법 |
| --- | --- |
| 정렬된 배열에서 두 수의 합/차 | 투 포인터 |
| 연속된 부분 배열/부분 문자열 | 슬라이딩 윈도우 |
| 중복 제거 | 빠른 포인터 + 느린 포인터 |
| 세 수의 합(Three Sum) | 정렬 + 투 포인터 |
| 가장 긴/짧은 연속 구간 | 슬라이딩 윈도우 |

### 한 줄 요약

- **투 포인터**는 두 개의 인덱스를 활용해 탐색하는 **상위 개념**입니다.
- **슬라이딩 윈도우**는 투 포인터를 이용해 **연속된 구간(Window)을 유지하며 탐색하는 특수한 형태**입니다.
- \
  코딩 테스트에서는 **정렬된 배열이면 투 포인터**, **연속 구간이면 슬라이딩 윈도우**를 가장 먼저 떠올리면 문제 접근이 쉬워집니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:11:57.745365+00', '2026-08-06 08:11:57.745365+00', NULL),
	('34bd6c74-6061-42e0-b912-67a33035367e', '11111111-1111-4111-8111-111111111111', '이분 탐색(Binary Search)', '## 개념

이분 탐색(Binary Search)은 **정렬된 데이터에서 원하는 값을 빠르게 찾는 탐색 알고리즘**이다.

매 탐색마다 탐색 범위를 절반으로 줄이기 때문에 매우 효율적이다.

- 선형 탐색: `O(N)`
- 이분 탐색: `O(log N)`

즉, 데이터가 많아질수록 성능 차이가 매우 커진다.

---

# 동작 원리

정렬된 배열에서 가운데 값을 확인한다.

- 찾는 값 == 가운데 값 → 탐색 종료
- 찾는 값 &lt; 가운데 값 → 왼쪽 절반 탐색
- 찾는 값 &gt; 가운데 값 → 오른쪽 절반 탐색

매번 절반씩 버리므로 탐색 범위가 계속 줄어든다.

예시

```
```

```
배열
[1, 3, 5, 7, 9, 11, 13]

찾는 값 : 11

1)
        7
       ↑
11 > 7
→ 오른쪽 탐색

2)

[9, 11, 13]

      11
      ↑

찾음
```

---

# 탐색 과정

```
```

```
left = 0
right = n-1

while(left <= right)

           mid

left -------- right

↓

mid 계산

↓

값 비교

↓

left 또는 right 이동

↓

범위가 없어질 때까지 반복
```

---

# 구현

## 반복문

```
```

```
public static int binarySearch(int[] arr, int target) {
    int left = 0;
    int right = arr.length - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (arr[mid] == target) {
            return mid;
        }

        if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return -1;
}
```

---

## 재귀

```
```

```
public static int binarySearch(int[] arr, int left, int right, int target) {

    if (left > right)
        return -1;

    int mid = left + (right - left) / 2;

    if (arr[mid] == target)
        return mid;

    if (arr[mid] < target)
        return binarySearch(arr, mid + 1, right, target);

    return binarySearch(arr, left, mid - 1, target);
}
```

---

# 왜 mid를 이렇게 계산할까?

잘못된 코드

```
```

```
int mid = (left + right) / 2;
```

큰 범위에서는

```
```

```
left + right
```

가 **정수 오버플로우**를 일으킬 수 있다.

그래서 안전하게

```
```

```
int mid = left + (right - left) / 2;
```

를 사용한다.

---

# 시간 복잡도

매번 절반씩 줄어든다.

```
```

```
N
↓

N/2

↓

N/4

↓

N/8

↓

...
```

탐색 횟수

```
```

```
2^k = N

k = log₂N
```

따라서

- \
  시간 복잡도 : **O(log N)**
- \
  공간 복잡도
  - \
    반복문 : **O(1)**
  - \
    재귀 : **O(log N)**

---

# 반드시 정렬되어 있어야 하는 이유

예를 들어

```
```

```
[7, 1, 5, 3, 9]
```

가운데가

```
```

```
5
```

라고 해서

- \
  왼쪽에는 작은 값
- \
  오른쪽에는 큰 값

이라는 보장이 없다.

즉,

```
```

```
target < mid
```

라고 해서 왼쪽만 탐색하면 정답을 놓칠 수 있다.

따라서 **이분 탐색은 정렬된 데이터에서만 사용할 수 있다.**

---

# Lower Bound와 Upper Bound

이분 탐색은 단순히 값을 찾는 것뿐 아니라 **조건을 만족하는 첫 번째 또는 마지막 위치를 찾는 데도 활용**된다.

## Lower Bound

**조건을 처음 만족하는 위치**를 찾는다.

즉,

> `target` 이상(`>= target`)이 처음 나타나는 인덱스

예시

```
```

```
배열
[1, 2, 2, 2, 4, 5]

target = 2

결과 → index = 1
```

---

## Upper Bound

**조건을 만족하지 않는 첫 번째 위치**를 찾는다.

즉,

> `target`보다 큰(`> target`) 값이 처음 나타나는 인덱스

예시

```
```

```
배열
[1, 2, 2, 2, 4, 5]

target = 2

결과 → index = 4
```

---

# 매개변수 탐색(Parametric Search)

이분 탐색은 **값을 찾는 것뿐 아니라 정답 자체를 탐색**하는 데도 사용된다.

예를 들어

> 랜선을 최소 몇 cm로 잘라야 K개 이상 만들 수 있는가?

여기서는 배열을 탐색하는 것이 아니라

```
```

```
길이

1 ~ 10억
```

사이에서 가능한 답을 찾는다.

대표 문제

- \
  랜선 자르기
- \
  나무 자르기
- \
  공유기 설치
- \
  입국 심사

공통 특징

- \
  정답의 범위가 존재한다.
- \
  어떤 값이 가능하면 그보다 작은(또는 큰) 값도 가능하다.
- **판별 함수(가능/불가능**)를 만들 수 있다.

이러한 **단조성(Monotonicity**)을 이용해 이분 탐색을 적용한다.

---

# 장점

- \
  매우 빠른 탐색 (`O(log N)`)
- \
  구현이 비교적 간단하다.
- \
  다양한 문제(탐색, 최적화, 매개변수 탐색)에 응용된다.

---

# 단점

- \
  데이터가 정렬되어 있어야 한다.
- \
  구현 시 경계 조건(`left`, `right`, `mid`) 처리 실수가 자주 발생한다.

---

# 자주 하는 실수

### 1. 정렬하지 않고 사용

```
```

```
❌ 정렬되지 않은 배열에서 사용
```

---

### 2. 반복 조건 오류

```
```

```
while (left <= right)
```

를

```
```

```
while (left < right)
```

로 작성하면 마지막 원소를 확인하지 못하는 경우가 발생할 수 있다.

---

### 3. mid 계산

```
```

```
int mid = (left + right) / 2;
```

보다는

```
```

```
int mid = left + (right - left) / 2;
```

를 사용하는 것이 안전하다.

---

### 4. 범위 갱신 오류

```
```

```
left = mid;
right = mid;
```

처럼 갱신하면 `left`와 `right`가 변하지 않아 **무한 루프**에 빠질 수 있다.

올바른 갱신은 다음과 같다.

```
```

```
left = mid + 1;
right = mid - 1;
```

---

# 언제 사용하는가?

다음과 같은 특징이 있다면 이분 탐색을 고려할 수 있다.

- **정렬된 배열에서 특정 값을 찾는 경우**
- **조건을 만족하는 첫 번째/마지막 위치를 찾는 경우(Lower/Upper Bound)**
- **정답의 범위가 크고, 판별 함수가 단조성을 만족하는 최적화 문제(매개변수 탐색)**

대표적인 문제는 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 값 탐색 | 특정 숫자 찾기 |
| Lower Bound | 특정 값 이상의 첫 위치 찾기 |
| Upper Bound | 특정 값보다 큰 첫 위치 찾기 |
| 매개변수 탐색 | 랜선 자르기, 나무 자르기, 공유기 설치, 입국 심사 |

> **핵심:** 이분 탐색은 단순한 탐색 알고리즘이 아니라, **탐색 범위를 절반씩 줄일 수 있는 구조**가 있다면 다양한 문제에 적용할 수 있는 매우 강력한 기법이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:13:29.870318+00', '2026-08-06 08:13:29.870318+00', NULL),
	('58980a16-9419-478d-85be-c2d1dca24dcf', '11111111-1111-4111-8111-111111111111', 'DFS(Depth-First Search, 깊이 우선 탐색)', '## 개념

DFS(Depth-First Search)는 **그래프나 트리를 탐색할 때 한 방향으로 가능한 깊이까지 먼저 탐색한 후, 더 이상 갈 수 없으면 이전 지점으로 돌아와 다른 경로를 탐색하는 알고리즘**이다.

이전 지점으로 되돌아가는 과정을 **백트래킹(Backtracking**)이라고 한다.

DFS는 **스택(Stack)** 구조를 이용하며, 재귀 호출도 내부적으로는 스택을 사용한다.

---

# 탐색 원리

다음과 같은 그래프가 있다고 하자.

```
```

```
      A
    /   \
   B     C
  / \   / \
 D   E F   G
```

A에서 DFS를 수행하면

```
```

```
A
↓

B
↓

D

(더 이상 갈 곳 없음)

↑

B

↓

E

↑

A

↓

C

↓

F

↑

C

↓

G
```

탐색 순서는

```
```

```
A → B → D → E → C → F → G
```

처럼 된다.

---

# 탐색 과정

```
```

```
현재 노드 방문

↓

방문 처리

↓

인접한 노드 탐색

↓

방문하지 않은 노드가 있다면

↓

그 노드로 이동

↓

끝까지 반복

↓

더 이상 갈 곳이 없으면

↓

이전 노드로 복귀(Backtracking)
```

---

# 구현 방법

DFS는 크게 두 가지 방식으로 구현한다.

- \
  재귀
- \
  스택

---

# 1. 재귀 구현

```
```

```
static List<Integer>[] graph;
static boolean[] visited;

public static void dfs(int node) {

    visited[node] = true;
    System.out.print(node + " ");

    for (int next : graph[node]) {
        if (!visited[next]) {
            dfs(next);
        }
    }
}
```

### 동작 과정

```
```

```
dfs(1)

↓

dfs(2)

↓

dfs(4)

↓

복귀

↓

dfs(5)

↓

복귀

↓

dfs(3)
```

재귀 호출이 끝나면 자동으로 이전 함수로 돌아간다.

---

# 2. 스택 구현

```
```

```
Stack<Integer> stack = new Stack<>();
boolean[] visited = new boolean[n + 1];

stack.push(start);

while (!stack.isEmpty()) {

    int now = stack.pop();

    if (visited[now])
        continue;

    visited[now] = true;

    for (int next : graph[now]) {
        if (!visited[next]) {
            stack.push(next);
        }
    }
}
```

재귀 대신 직접 스택을 사용하는 방식이다.

---

# 왜 방문 배열이 필요한가?

그래프에는 **사이클(Cycle**)이 존재할 수 있다.

예를 들어

```
```

```
1 ── 2
│    │
└────3
```

방문 체크가 없다면

```
```

```
1

↓

2

↓

3

↓

1

↓

2

↓

3
...
```

무한히 반복된다.

따라서

```
```

```
visited[node] = true;
```

를 통해 이미 방문한 노드는 다시 방문하지 않는다.

---

# 시간 복잡도

정점을 V개

간선을 E개라고 하면

각 정점과 간선을 최대 한 번씩 방문한다.

따라서

```
```

```
시간 복잡도

O(V + E)
```

공간 복잡도

- \
  방문 배열 : O(V)
- \
  재귀 스택 또는 명시적 스택 : O(V)

---

# DFS의 특징

### 장점

- \
  구현이 간단하다.
- \
  경로 탐색에 적합하다.
- \
  백트래킹과 함께 사용하기 좋다.
- \
  모든 경우를 탐색하는 문제에 많이 사용된다.

---

### 단점

- \
  최단 경로를 보장하지 않는다.
- \
  재귀 깊이가 매우 깊으면 StackOverflow가 발생할 수 있다.
- \
  탐색 순서는 인접 리스트 순서에 따라 달라질 수 있다.

---

# DFS와 BFS 비교

| 항목 | DFS | BFS |
| --- | --- | --- |
| 탐색 방식 | 깊게 탐색 후 복귀 | 가까운 노드부터 탐색 |
| 자료구조 | 스택(Stack), 재귀 | 큐(Queue) |
| 최단 거리 보장 | ❌ | ✅ (가중치 없는 그래프) |
| 메모리 사용 | 비교적 적음 | 비교적 많음 |
| 활용 | 백트래킹, 모든 경우 탐색 | 최단 거리 탐색 |

---

# DFS가 많이 사용되는 문제

## 1. 그래프 탐색

모든 정점을 방문해야 하는 경우

```
```

```
연결 요소 찾기
```

---

## 2. 트리 순회

```
```

```
전위 순회

중위 순회

후위 순회
```

모두 DFS의 응용이다.

---

## 3. 백트래킹

대표 문제

- \
  N-Queen
- \
  스도쿠
- \
  순열
- \
  조합
- \
  부분집합

DFS로 탐색하면서 조건이 맞지 않으면 되돌아간다.

---

## 4. 사이클 판별

DFS를 이용해 그래프에 사이클이 존재하는지 확인할 수 있다.

---

## 5. 위상 정렬

방문이 끝난 순서를 이용해 위상 정렬을 수행할 수 있다.

---

## 6. 섬 개수 문제

대표적인 DFS 문제

```
```

```
11100

11000

00111
```

상하좌우로 연결된 영역을 하나의 섬으로 보고

DFS로 모두 방문한다.

---

# DFS의 핵심 흐름

```
```

```
현재 노드 방문

↓

방문 처리

↓

인접 노드 확인

↓

방문하지 않았다면

↓

DFS 재귀 호출

↓

더 이상 갈 곳이 없다면

↓

이전 노드로 복귀
```

---

# 자주 하는 실수

### 1. 방문 체크를 하지 않는 경우

```
```

```
dfs(next);
```

사이클이 있는 그래프에서는 무한 재귀가 발생할 수 있다.

반드시

```
```

```
if (!visited[next]) {
    dfs(next);
}
```

처럼 방문 여부를 확인해야 한다.

---

### 2. 방문 처리를 늦게 하는 경우

잘못된 예

```
```

```
for (int next : graph[node]) {
    dfs(next);
}

visited[node] = true;
```

이 경우 같은 노드가 여러 번 호출될 수 있다.

올바른 방법은 **노드에 도착하자마자 방문 처리**하는 것이다.

```
```

```
visited[node] = true;
```

---

### 3. 재귀 깊이 초과

노드 수가 매우 많은 문제에서는 재귀 호출이 깊어져 `StackOverflowError`가 발생할 수 있다.

이런 경우에는 **명시적 스택을 사용하는 반복문 DFS**를 고려한다.

---

### 4. 연결 그래프라고 가정하는 경우

그래프가 여러 연결 요소로 나뉘어 있다면 시작 노드 하나만 탐색해서는 모든 정점을 방문할 수 없다.

```
```

```
for (int i = 1; i <= n; i++) {
    if (!visited[i]) {
        dfs(i);
    }
}
```

처럼 모든 정점을 시작점으로 확인해야 한다.

---

# 언제 사용하는가?

다음과 같은 상황이라면 DFS를 우선 고려할 수 있다.

- **그래프나 트리의 모든 노드를 탐색해야 하는 경우**
- **모든 가능한 경우의 수를 탐색하는 경우(백트래킹)**
- **연결 요소, 사이클 여부 등을 확인하는 경우**
- **트리 순회나 위상 정렬처럼 깊이 기반 탐색이 필요한 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 그래프 탐색 | 연결 요소 개수 |
| 트리 순회 | 전위·중위·후위 순회 |
| 백트래킹 | N-Queen, 순열, 조합 |
| 그래프 분석 | 사이클 판별, 위상 정렬 |
| 격자 탐색 | 섬의 개수, 유기농 배추 |

> **핵심:** DFS는 **"끝까지 내려간 뒤 되돌아오며 탐색하는 알고리즘**"이다. 이 특성 덕분에 그래프 탐색뿐 아니라 백트래킹, 트리 순회, 연결 요소 탐색 등 다양한 문제에서 기본이 되는 알고리즘이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:13:56.308404+00', '2026-08-06 08:13:56.308404+00', NULL),
	('11154ae5-c3ae-4457-ab8a-e43535d6239a', '11111111-1111-4111-8111-111111111111', 'BFS(Breadth-First Search, 너비 우선 탐색)', '## 개념

BFS(Breadth-First Search)는 **그래프나 트리를 탐색할 때 시작 노드에서 가까운 노드부터 차례대로 탐색하는 알고리즘**이다.

DFS가 **깊게 들어가는 방식**이라면, BFS는 **같은 거리에 있는 노드를 모두 방문한 후 다음 거리의 노드를 탐색**한다.

BFS는 **큐(Queue, FIFO**)를 사용하여 구현한다.

---

A · start  ·  neighbors A–Z

A#1

B#2

C#3

D#4

E#5

F#6

A#1

B#2

C#3

D#4

E#5

F#6

FIFO queueDEFfront → back

● current◌ frontier● explored┄ unreached / non-tree edge

Finish the distance-one layer

C discovers F. Every distance-one vertex is processed before the distance-two frontier.

알고리즘

BFSDFS

BFSDFS

---

# 탐색 원리

다음과 같은 그래프가 있다고 하자.

```
```

```
      A
    /   \
   B     C
  / \   / \
 D   E F   G
```

A에서 BFS를 수행하면

```
```

```
A

↓

B   C

↓

D   E   F   G
```

탐색 순서는

```
```

```
A → B → C → D → E → F → G
```

처럼 **가까운 노드부터 순서대로 방문**한다.

---

# 탐색 과정

```
```

```
시작 노드를 큐에 넣는다.

↓

큐에서 하나 꺼낸다.

↓

방문 처리한다.

↓

인접한 노드 중

방문하지 않은 노드를

모두 큐에 넣는다.

↓

큐가 빌 때까지 반복
```

---

# 큐의 동작 예시

그래프

```
```

```
1
│
├──2
│   ├──4
│   └──5
│
└──3
    └──6
```

큐의 변화

```
```

```
초기

Queue
[1]

↓

1 방문

Queue
[2, 3]

↓

2 방문

Queue
[3, 4, 5]

↓

3 방문

Queue
[4, 5, 6]

↓

4 방문

Queue
[5, 6]

↓

5 방문

Queue
[6]

↓

6 방문

Queue
[]
```

방문 순서

```
```

```
1 → 2 → 3 → 4 → 5 → 6
```

---

# 구현

## Java

```
```

```
static List<Integer>[] graph;
static boolean[] visited;

public static void bfs(int start) {

    Queue<Integer> queue = new LinkedList<>();

    queue.offer(start);
    visited[start] = true;

    while (!queue.isEmpty()) {

        int now = queue.poll();

        System.out.print(now + " ");

        for (int next : graph[now]) {

            if (!visited[next]) {
                visited[next] = true;
                queue.offer(next);
            }
        }
    }
}
```

---

# 왜 큐를 사용할까?

큐는

```
```

```
먼저 들어온 것이

먼저 나온다.
(FIFO)
```

따라서

```
```

```
거리 0

↓

거리 1

↓

거리 2

↓

거리 3
```

순으로 탐색하게 된다.

이것이 BFS가 **최단 거리 탐색**에 사용되는 이유이다.

---

# 왜 방문 배열이 필요한가?

사이클이 존재하는 그래프에서는

```
```

```
1 ── 2
│    │
└────3
```

방문 체크가 없다면

```
```

```
1

↓

2

↓

3

↓

1

↓

2

↓

3
...
```

무한 반복된다.

따라서

```
```

```
visited[next] = true;
```

를 이용해 이미 방문한 노드는 다시 방문하지 않는다.

> **중요:** BFS에서는 일반적으로 **큐에 넣는 순간 방문 처리**를 한다. 큐에서 꺼낼 때 방문 처리하면 같은 노드가 여러 번 큐에 들어갈 수 있다.

---

# 시간 복잡도

정점을 V개

간선을 E개라고 하면

각 정점과 간선을 최대 한 번씩 방문한다.

따라서

```
```

```
시간 복잡도

O(V + E)
```

공간 복잡도

- \
  방문 배열 : O(V)
- \
  큐 : O(V)

---

# BFS의 특징

### 장점

- \
  최단 거리를 구할 수 있다. (가중치 없는 그래프)
- \
  구현이 비교적 쉽다.
- \
  레벨(깊이) 단위 탐색이 가능하다.

---

### 단점

- \
  DFS보다 메모리를 많이 사용할 수 있다.
- \
  그래프가 매우 넓으면 큐의 크기가 커질 수 있다.

---

# BFS와 DFS 비교

| 항목 | BFS | DFS |
| --- | --- | --- |
| 탐색 방식 | 가까운 노드부터 | 끝까지 내려간 후 복귀 |
| 자료구조 | 큐(Queue) | 스택(Stack), 재귀 |
| 최단 거리 보장 | ✅ (가중치 없음) | ❌ |
| 메모리 사용 | 비교적 많음 | 비교적 적음 |
| 활용 | 최단 거리, 레벨 탐색 | 백트래킹, 모든 경우 탐색 |

---

# BFS가 많이 사용되는 문제

## 1. 최단 거리

대표 문제

- \
  미로 탐색
- \
  숨바꼭질
- \
  나이트 이동
- \
  최단 이동 횟수

가중치가 없는 그래프에서는 BFS가 최단 거리를 보장한다.

---

## 2. 레벨 탐색

트리에서

```
```

```
Level 0

↓

Level 1

↓

Level 2
```

처럼 층별 탐색을 수행할 수 있다.

---

## 3. 섬 문제

```
```

```
11100

11000

00111
```

DFS와 동일하게 사용할 수 있으며,

영역 전체를 방문할 수 있다.

---

## 4. 최소 이동 횟수

대표적인 BFS 문제

- \
  미로 탈출
- \
  버튼 누르기
- \
  순간 이동
- \
  퍼즐 이동

---

## 5. 다중 시작점 BFS

여러 시작점에서 동시에 탐색할 수도 있다.

대표 문제

- \
  토마토
- \
  불!
- \
  좀비 확산

초기 시작 노드를 모두 큐에 넣고 시작하면 된다.

---

# 거리 배열 활용

최단 거리를 구할 때는 방문 배열 대신 거리 배열을 자주 사용한다.

```
```

```
Queue<Integer> queue = new LinkedList<>();

queue.offer(start);
distance[start] = 0;
visited[start] = true;

while (!queue.isEmpty()) {

    int now = queue.poll();

    for (int next : graph[now]) {

        if (!visited[next]) {

            visited[next] = true;
            distance[next] = distance[now] + 1;
            queue.offer(next);
        }
    }
}
```

예를 들어

```
```

```
1 → 2 → 3 → 4
```

이라면

```
```

```
distance

1 : 0

2 : 1

3 : 2

4 : 3
```

이 되어 시작점에서 각 정점까지의 최단 이동 횟수를 알 수 있다.

---

# 자주 하는 실수

### 1. 큐에서 꺼낼 때 방문 처리

잘못된 예

```
```

```
int now = queue.poll();

visited[now] = true;
```

이렇게 하면 같은 노드가 여러 번 큐에 들어갈 수 있다.

올바른 방법은

```
```

```
visited[next] = true;
queue.offer(next);
```

처럼 **큐에 넣을 때 방문 처리**하는 것이다.

---

### 2. 방문 배열을 사용하지 않는 경우

사이클이 있는 그래프에서는 무한 반복이 발생한다.

---

### 3. DFS처럼 구현하는 경우

```
```

```
Stack<Integer>
```

을 사용하면 BFS가 아니라 DFS가 된다.

BFS는 반드시

```
```

```
Queue<Integer>
```

를 사용해야 한다.

---

### 4. 가중치 그래프에 사용하는 경우

BFS는 **모든 간선의 비용이 동일할 때만 최단 거리**를 보장한다.

가중치가 있는 그래프에서는 다음 알고리즘을 사용해야 한다.

- \
  가중치가 모두 양수 → 다익스트라
- \
  음수 가중치 포함 → 벨만-포드
- \
  모든 정점 간 최단 거리 → 플로이드-워셜

---

# 언제 사용하는가?

다음과 같은 상황이라면 BFS를 우선 고려할 수 있다.

- **가중치가 없는 그래프에서 최단 거리를 구하는 경우**
- **그래프나 트리를 레벨(층) 단위로 탐색하는 경우**
- **최소 이동 횟수나 최소 연산 횟수를 구하는 경우**
- **여러 시작점에서 동시에 탐색해야 하는 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 최단 거리 | 미로 탐색, 숨바꼭질 |
| 레벨 탐색 | 트리 레벨 순회 |
| 격자 탐색 | 섬의 개수, 토마토 |
| 최소 이동 | 퍼즐, 버튼 문제 |
| 확산 시뮬레이션 | 바이러스, 불, 좀비 |

> **핵심:** BFS는 **"가까운 곳부터 차례대로 탐색하는 알고리즘**"이다. 큐(FIFO)를 이용해 탐색 순서를 유지하며, **가중치가 없는 그래프에서 최단 거리를 보장**한다는 점이 DFS와 가장 큰 차이이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:14:26.545801+00', '2026-08-06 08:14:26.545801+00', NULL),
	('c38986d1-0abf-41c8-a3c6-a631e83063de', '11111111-1111-4111-8111-111111111111', 'Union-Find(Disjoint Set Union, DSU)', '## 개념

Union-Find(유니온 파인드)는 **여러 원소를 서로소 집합(Disjoint Set)으로 관리하는 자료구조**이다.

주로 다음 두 가지 연산을 매우 빠르게 수행하기 위해 사용된다.

- **Union** : 두 집합을 하나로 합친다.
- **Find** : 어떤 원소가 어느 집합에 속하는지(대표 노드)를 찾는다.

대표적으로 **그래프에서 연결 여부를 관리**할 때 많이 사용된다.

---

# 서로소 집합(Disjoint Set)

서로소 집합이란 **공통 원소가 없는 집합들**을 의미한다.

예를 들어

```
```

```
집합 A = {1, 2, 3}

집합 B = {4, 5}

집합 C = {6}
```

각 집합은 서로 겹치지 않는다.

Union-Find는 이러한 집합들을 효율적으로 관리한다.

---

# 기본 아이디어

각 집합은 **대표 노드(Root**)를 하나 가진다.

예를 들어

```
```

```
1
│
2
│
3
```

이라면

```
```

```
대표 노드 = 1
```

이다.

각 노드는 자신의 부모를 저장한다.

```
```

```
parent

1 → 1

2 → 1

3 → 2
```

---

# 두 가지 핵심 연산

## 1. Find

어떤 원소의 **대표 노드(Root**)를 찾는다.

예를 들어

```
```

```
1
│
2
│
3
```

에서

```
```

```
find(3)
```

을 수행하면

```
```

```
3

↓

2

↓

1
```

최종적으로

```
```

```
대표 노드 = 1
```

을 반환한다.

---

## 2. Union

두 집합을 하나로 합친다.

예를 들어

```
```

```
집합1

1
│
2


집합2

3
│
4
```

에서

```
```

```
union(2, 4)
```

을 수행하면

```
```

```
1
│
2
│
3
│
4
```

처럼 하나의 집합이 된다.

---

# 초기 상태

처음에는 모두 독립된 집합이다.

```
```

```
1   2   3   4   5

parent

1 2 3 4 5
```

즉,

```
```

```
parent[i] = i;
```

---

# 구현

## 초기화

```
```

```
int[] parent = new int[n + 1];

for (int i = 1; i <= n; i++) {
    parent[i] = i;
}
```

---

## Find

```
```

```
public static int find(int x) {

    if (parent[x] == x)
        return x;

    return find(parent[x]);
}
```

---

## Union

```
```

```
public static void union(int a, int b) {

    int rootA = find(a);
    int rootB = find(b);

    if (rootA != rootB) {
        parent[rootB] = rootA;
    }
}
```

---

# 경로 압축(Path Compression)

기본 Find는 트리가 길어질수록 느려질 수 있다.

예를 들어

```
```

```
1
│
2
│
3
│
4
│
5
```

에서

```
```

```
find(5)
```

는

```
```

```
5

↓

4

↓

3

↓

2

↓

1
```

모두 방문해야 한다.

경로 압축을 사용하면

```
```

```
public static int find(int x) {

    if (parent[x] == x)
        return x;

    return parent[x] = find(parent[x]);
}
```

한 번 Find를 수행한 후에는

```
```

```
      1
   / /|\ \
  2 3 4 5
```

처럼 모든 노드가 대표 노드를 직접 가리키게 된다.

따라서 이후의 Find는 거의 한 번에 끝난다.

---

# Union by Rank (또는 Size)

무작정 합치면 트리가 길어질 수 있다.

```
```

```
1
│
2
│
3
│
4
│
5
```

이를 방지하기 위해

- \
  작은 트리를 큰 트리 아래에 붙인다.
- \
  높이가 낮은 트리를 높은 트리 아래에 붙인다.

이를

```
```

```
Union by Rank

또는

Union by Size
```

라고 한다.

---

## Rank 기반 구현

```
```

```
static int[] parent;
static int[] rank;

public static void union(int a, int b) {

    int rootA = find(a);
    int rootB = find(b);

    if (rootA == rootB)
        return;

    if (rank[rootA] < rank[rootB]) {
        parent[rootA] = rootB;
    } else if (rank[rootA] > rank[rootB]) {
        parent[rootB] = rootA;
    } else {
        parent[rootB] = rootA;
        rank[rootA]++;
    }
}
```

---

# 시간 복잡도

## 기본 구현

- \
  Find : O(N)
- \
  Union : O(N)

최악의 경우

```
```

```
1

↓

2

↓

3

↓

4

↓

...
```

처럼 연결된다.

---

## 경로 압축 + Union by Rank

시간 복잡도

```
```

```
O(α(N))
```

여기서

```
```

```
α(N)

Inverse Ackermann Function
```

은 매우 천천히 증가하는 함수이다.

실제로는

```
```

```
거의 O(1)
```

이라고 생각해도 된다.

---

# Union-Find의 특징

### 장점

- \
  연결 여부를 매우 빠르게 확인할 수 있다.
- \
  구현이 비교적 간단하다.
- \
  동적 집합 관리에 매우 효율적이다.

---

### 단점

- \
  집합 내부 구조를 알 수 없다.
- \
  삭제 연산을 지원하지 않는다.
- \
  방향 그래프에는 그대로 적용하기 어렵다.

---

# Union-Find가 많이 사용되는 문제

## 1. 연결 여부 확인

```
```

```
A와 B가 같은 그룹인가?
```

---

## 2. 사이클 판별

간선을 하나씩 추가하면서

```
```

```
이미 같은 집합인데

또 연결하려 한다.
```

면 사이클이 발생한 것이다.

예를 들어

```
```

```
1──2

 \ |
  3
```

에서

```
```

```
union(1,2)

union(2,3)

union(1,3)
```

세 번째에서

```
```

```
find(1) == find(3)
```

이므로 사이클이 생긴다.

---

## 3. 최소 신장 트리(MST)

대표 알고리즘

```
```

```
크루스칼(Kruskal)
```

간선을 비용 순으로 선택하면서

사이클 여부를 Union-Find로 확인한다.

---

## 4. 네트워크 연결

컴퓨터나 사람들의 연결 관계를 관리하는 문제

---

## 5. 친구 그룹 문제

```
```

```
A와 B가 친구

B와 C가 친구
```

이면

```
```

```
A와 C는 같은 그룹
```

이 된다.

---

# DFS/BFS와 비교

| 항목 | Union-Find | DFS/BFS |
| --- | --- | --- |
| 목적 | 집합 관리, 연결 여부 확인 | 그래프 탐색 |
| 연결 여부 확인 | 매우 빠름 | 탐색 필요 |
| 경로 탐색 | ❌ | ✅ |
| 사이클 판별 | 매우 적합 | 가능하지만 더 복잡 |
| 최단 거리 | ❌ | BFS 가능 |

---

# 자주 하는 실수

### 1. 대표 노드끼리 Union하지 않는 경우

잘못된 예

```
```

```
parent[b] = a;
```

올바른 방법은 반드시 대표 노드를 찾은 후 합쳐야 한다.

```
```

```
int rootA = find(a);
int rootB = find(b);

parent[rootB] = rootA;
```

---

### 2. 경로 압축을 하지 않는 경우

```
```

```
return find(parent[x]);
```

보다

```
```

```
return parent[x] = find(parent[x]);
```

를 사용하는 것이 훨씬 빠르다.

---

### 3. 같은 집합인지 확인하지 않는 경우

```
```

```
union(a, b);
```

전에

```
```

```
if (find(a) == find(b))
```

를 확인해야 하는 문제가 많다.

---

### 4. 초기화를 하지 않는 경우

```
```

```
parent[i] = i;
```

를 빼먹으면 모든 연산이 잘못된다.

---

# 언제 사용하는가?

다음과 같은 상황이라면 Union-Find를 고려할 수 있다.

- **두 원소가 같은 그룹인지 빠르게 확인해야 하는 경우**
- **집합을 계속 합쳐야 하는 경우**
- **그래프에서 사이클 여부를 판단하는 경우**
- **최소 신장 트리(Kruskal)를 구현하는 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 연결 여부 | 같은 네트워크인지 확인 |
| 사이클 판별 | 그래프에 사이클 존재 여부 |
| 최소 신장 트리 | 크루스칼 알고리즘 |
| 그룹 관리 | 친구 관계, 동아리, 팀 합치기 |

> **핵심:** Union-Find는 **"원소들이 어떤 집합에 속하는지 관리하는 자료구조**"이다. `Find`로 대표 노드를 찾고, `Union`으로 집합을 합치며, **경로 압축(Path Compression**)과 **Union by Rank/Size**를 함께 사용하면 거의 **O(1**)에 가까운 성능으로 연결 여부를 관리할 수 있다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:14:48.962759+00', '2026-08-06 08:14:48.962759+00', NULL),
	('2ee07297-2b25-42fa-813c-83947e8f542e', '11111111-1111-4111-8111-111111111111', '다익스트라(Dijkstra Algorithm)', '## 개념

다익스트라(Dijkstra)는 **가중치가 있는 그래프에서 하나의 시작 정점으로부터 다른 모든 정점까지의 최단 거리를 구하는 알고리즘**이다.

단, **모든 간선의 가중치가 0 이상(음수가 없어야 함**)이라는 조건이 있다.

대표적으로

- 최단 경로
- 네비게이션
- 지도 길찾기
- 네트워크 라우팅

등에서 사용된다.

---

# 언제 사용하는가?

다음과 같은 조건이라면 다익스트라를 사용한다.

- 가중치가 있는 그래프
- 간선의 가중치가 모두 **0 이상**
- 한 정점에서 다른 정점까지의 최단 거리

예를 들어

```
```

```
A --3--> B

A --5--> C

B --2--> C
```

처럼 이동 비용이 존재하는 경우이다.

---

# 핵심 아이디어

현재까지 알고 있는 **가장 짧은 거리**를 계속 갱신해 나간다.

항상

> **가장 가까운 정점부터 확정한다.**

이것이 다익스트라의 핵심이다.

---

# 예시 그래프

```
```

```
        2
   A -------- B
   |          |
 5 |          | 1
   |          |
   C -------- D
        3
```

시작 정점

```
```

```
A
```

---

## 초기 상태

```
```

```
거리

A = 0

B = INF

C = INF

D = INF
```

---

## A 선택

A에서 갈 수 있는 곳

```
```

```
B = 2

C = 5
```

거리

```
```

```
A = 0

B = 2

C = 5

D = INF
```

---

## 가장 가까운 정점

```
```

```
B (2)
```

확정

B에서

```
```

```
D = 2 + 1 = 3
```

거리

```
```

```
A = 0

B = 2

C = 5

D = 3
```

---

## 다음

가장 가까운 정점

```
```

```
D (3)
```

확정

D에서

```
```

```
C = 3 + 3 = 6
```

기존

```
```

```
5
```

가 더 짧으므로

변경하지 않는다.

---

## 결과

```
```

```
A = 0

B = 2

C = 5

D = 3
```

---

# 동작 과정

```
```

```
시작 정점 거리 = 0

↓

우선순위 큐에 삽입

↓

가장 가까운 정점 선택

↓

인접 정점 거리 갱신

↓

새로운 거리 큐에 삽입

↓

큐가 빌 때까지 반복
```

---

# 구현 (우선순위 큐)

## 그래프

```
```

```
static class Node {
    int to;
    int cost;

    Node(int to, int cost) {
        this.to = to;
        this.cost = cost;
    }
}
```

---

## 다익스트라

```
```

```
static int[] dist;
static List<Node>[] graph;

public static void dijkstra(int start) {

    PriorityQueue<Node> pq =
        new PriorityQueue<>((a, b) -> a.cost - b.cost);

    Arrays.fill(dist, Integer.MAX_VALUE);

    dist[start] = 0;
    pq.offer(new Node(start, 0));

    while (!pq.isEmpty()) {

        Node current = pq.poll();

        if (current.cost > dist[current.to])
            continue;

        for (Node next : graph[current.to]) {

            int nextCost = current.cost + next.cost;

            if (nextCost < dist[next.to]) {

                dist[next.to] = nextCost;

                pq.offer(new Node(next.to, nextCost));
            }
        }
    }
}
```

---

# 왜 우선순위 큐를 사용할까?

항상

```
```

```
가장 거리가 짧은 정점
```

을 선택해야 하기 때문이다.

우선순위 큐는

```
```

```
거리

2

5

8

10
```

중

```
```

```
2
```

를 즉시 꺼낼 수 있다.

---

# 왜 `continue`가 필요한가?

예를 들어

```
```

```
1 → 2

비용 10
```

이 먼저 큐에 들어갔다가

나중에

```
```

```
1 → 3 → 2

비용 5
```

가 발견될 수 있다.

그러면 큐에는

```
```

```
2 (10)

2 (5)
```

가 모두 존재한다.

먼저

```
```

```
2 (5)
```

를 처리한 후

```
```

```
2 (10)
```

가 나오면

이미 더 짧은 경로가 있으므로

```
```

```
if (current.cost > dist[current.to])
    continue;
```

로 건너뛴다.

---

# 시간 복잡도

우선순위 큐 사용

```
```

```
O((V + E) log V)
```

- \
  V : 정점 수
- \
  E : 간선 수

---

# 음수 간선에서 사용할 수 없는 이유

예를 들어

```
```

```
A --2--> B

A --5--> C

C --(-10)--> B
```

다익스트라는

먼저

```
```

```
A → B = 2
```

를 확정한다.

하지만

```
```

```
A → C → B

5 + (-10)

= -5
```

가 더 짧다.

이미 B를 확정했기 때문에

잘못된 결과가 된다.

따라서

> **음수 간선이 있으면 다익스트라는 사용할 수 없다.**

음수 간선이 있다면 **벨만-포드(Bellman-Ford)** 알고리즘을 사용해야 한다.

---

# BFS와 비교

| 항목 | BFS | 다익스트라 |
| --- | --- | --- |
| 그래프 | 가중치 없음 | 가중치 있음 |
| 최단 거리 | ✅ | ✅ |
| 자료구조 | 큐 | 우선순위 큐 |
| 시간 복잡도 | O(V + E) | O((V + E) log V) |
| 음수 가중치 | 해당 없음 | ❌ |

---

# 플로이드-워셜과 비교

| 항목 | 다익스트라 | 플로이드-워셜 |
| --- | --- | --- |
| 시작점 | 하나 | 모든 정점 |
| 결과 | 한 정점 → 모든 정점 | 모든 정점 → 모든 정점 |
| 시간 복잡도 | O((V + E) log V) | O(V³) |
| 사용 상황 | 특정 시작점 | 모든 쌍 최단 거리 |

---

# 다익스트라가 많이 사용되는 문제

## 1. 최단 경로

대표 문제

- \
  최단 경로
- \
  특정 도시까지의 최소 비용

---

## 2. 네비게이션

도로마다

```
```

```
거리

시간

통행료
```

등의 비용이 존재한다.

---

## 3. 네트워크

컴퓨터 간 최소 전송 비용

---

## 4. 게임

NPC 이동

최단 경로 탐색

---

# 자주 하는 실수

### 1. BFS를 사용하는 경우

가중치가 있는데

```
```

```
Queue
```

를 사용하면 안 된다.

반드시

```
```

```
PriorityQueue
```

를 사용해야 한다.

---

### 2. `continue`를 생략하는 경우

```
```

```
if (current.cost > dist[current.to])
    continue;
```

를 생략하면 이미 더 짧은 경로가 확정된 정점을 다시 처리하여 불필요한 연산이 많아진다.

---

### 3. 거리 배열 초기화

```
```

```
Arrays.fill(dist, Integer.MAX_VALUE);
```

를 빼먹으면 최단 거리 계산이 올바르게 이루어지지 않는다.

---

### 4. 오버플로우

다음과 같은 계산은 오버플로우를 일으킬 수 있다.

```
```

```
int nextCost = dist[now] + weight;
```

`dist[now]`가 `Integer.MAX_VALUE`인 경우를 고려해야 하며, 문제에 따라 `long`을 사용하는 것이 안전하다.

---

### 5. 음수 간선에서 사용하는 경우

다익스트라는 **음수 가중치가 있는 그래프에는 사용할 수 없다.**

---

# 언제 사용하는가?

다음과 같은 상황이라면 다익스트라를 고려할 수 있다.

- **가중치가 있는 그래프에서 최단 거리를 구하는 경우**
- **간선의 가중치가 모두 0 이상인 경우**
- **하나의 시작점에서 모든 정점까지의 최단 거리를 구하는 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 최단 경로 | 특정 도시까지 최소 비용 |
| 길찾기 | 네비게이션, 지도 |
| 네트워크 | 최소 전송 비용 |
| 게임 | 캐릭터 이동, NPC 경로 |

---

# 알고리즘 선택 기준

| 상황 | 사용할 알고리즘 |
| --- | --- |
| 가중치 없음 | BFS |
| 가중치 0 이상 | 다익스트라 |
| 음수 가중치 포함 | 벨만-포드 |
| 모든 정점 간 최단 거리 | 플로이드-워셜 |

> **핵심:** 다익스트라는 **"현재 가장 가까운 정점을 먼저 확정하고, 그 정점을 통해 갈 수 있는 다른 정점의 최단 거리를 갱신하는 알고리즘**"이다. 우선순위 큐를 사용하여 항상 가장 짧은 거리를 가진 정점을 선택하며, **가중치가 모두 0 이상인 그래프에서 최단 경로를 효율적으로 구할 수 있다.**', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:15:13.026425+00', '2026-08-06 08:15:13.026425+00', NULL),
	('ccc60413-3be6-423a-9a27-7f107d3972ed', '11111111-1111-4111-8111-111111111111', '위상 정렬(Topological Sort)', '## 개념

위상 정렬(Topological Sort)은 **방향 그래프(DAG, Directed Acyclic Graph)에서 모든 간선의 방향을 지키면서 정점을 순서대로 나열하는 알고리즘**이다.

즉,

> **선행 작업이 항상 먼저 나오도록 순서를 결정하는 알고리즘**이다.

대표적으로

- 선수 과목
- 작업 스케줄링
- 빌드 순서
- 프로젝트 의존성 관리

등에서 사용된다.

---

# 언제 사용하는가?

다음과 같은 조건이라면 위상 정렬을 사용한다.

- **방향 그래프**
- **사이클이 없는 그래프(DAG)**
- **선행 관계가 존재하는 문제**

예를 들어

```
```

```
수학 → 자료구조 → 알고리즘
```

이라면

자료구조를 먼저 들을 수는 없다.

---

# DAG(Directed Acyclic Graph)

위상 정렬은 **DAG에서만 가능하다.**

DAG란

- \
  Directed(방향 그래프)
- \
  Acyclic(사이클 없음)

을 의미한다.

예시

```
```

```
A → B → D

↓

C → E
```

가능

반면

```
```

```
A → B

↑   ↓

D ← C
```

처럼

사이클이 있으면

```
```

```
A 전에 B

B 전에 C

C 전에 D

D 전에 A
```

모두 만족하는 순서는 존재하지 않는다.

---

# 핵심 아이디어

### 진입 차수(In-degree)

진입 차수란

> **자신에게 들어오는 간선의 개수**

이다.

예를 들어

```
```

```
A → C

B → C
```

이라면

```
```

```
A

in-degree = 0

B

in-degree = 0

C

in-degree = 2
```

이다.

---

# 위상 정렬 원리

1. \
   진입 차수가 0인 정점을 찾는다.
2. \
   결과에 추가한다.
3. \
   해당 정점에서 나가는 간선을 제거한다.
4. \
   진입 차수가 0이 된 정점을 큐에 넣는다.
5. \
   반복한다.

---

# 예제

그래프

```
```

```
A → C

B → C

C → D

D → E
```

---

## 초기 진입 차수

```
```

```
A : 0

B : 0

C : 2

D : 1

E : 1
```

큐

```
```

```
A B
```

---

## A 제거

```
```

```
A

↓

C의 진입 차수

2 → 1
```

큐

```
```

```
B
```

---

## B 제거

```
```

```
B

↓

C의 진입 차수

1 → 0
```

큐

```
```

```
C
```

---

## C 제거

```
```

```
C

↓

D

1 → 0
```

큐

```
```

```
D
```

---

## D 제거

```
```

```
D

↓

E

1 → 0
```

큐

```
```

```
E
```

---

## 결과

```
```

```
A B C D E
```

---

# 구현 (Kahn 알고리즘)

## 그래프

```
```

```
List<Integer>[] graph;
int[] indegree;
```

---

## 구현

```
```

```
Queue<Integer> queue = new LinkedList<>();
List<Integer> result = new ArrayList<>();

for (int i = 1; i <= n; i++) {
    if (indegree[i] == 0)
        queue.offer(i);
}

while (!queue.isEmpty()) {

    int now = queue.poll();

    result.add(now);

    for (int next : graph[now]) {

        indegree[next]--;

        if (indegree[next] == 0)
            queue.offer(next);
    }
}
```

---

# 동작 과정

```
```

```
진입 차수 계산

↓

진입 차수 0인 정점 큐 삽입

↓

큐에서 하나 꺼냄

↓

결과 저장

↓

간선 제거

↓

새롭게 진입 차수 0이 된 정점 삽입

↓

큐가 빌 때까지 반복
```

---

# 시간 복잡도

정점

```
```

```
V
```

간선

```
```

```
E
```

각 정점과 간선을 한 번씩 처리한다.

```
```

```
O(V + E)
```

---

# 사이클 판별

위상 정렬을 끝냈는데

```
```

```
결과 개수

<

전체 정점 개수
```

이면

사이클이 존재한다.

예를 들어

```
```

```
A → B

↑   ↓

D ← C
```

에서는

진입 차수 0인 정점이 하나도 없다.

큐가 처음부터 비어 있다.

따라서

```
```

```
정렬 불가능
```

이다.

---

# DFS를 이용한 위상 정렬

위상 정렬은 DFS로도 구현할 수 있다.

원리

```
```

```
DFS

↓

모든 자식 방문

↓

현재 노드를 스택에 저장

↓

모든 탐색 종료

↓

스택을 뒤집는다.
```

예시

```
```

```
A

↓

B

↓

C
```

방문 종료 순서

```
```

```
C

↓

B

↓

A
```

뒤집으면

```
```

```
A B C
```

가 된다.

---

# Kahn 알고리즘 vs DFS

| 항목 | Kahn | DFS |
| --- | --- | --- |
| 자료구조 | 큐 | 재귀 + 스택 |
| 구현 | 직관적 | 조금 어려움 |
| 사이클 판별 | 매우 쉬움 | 방문 상태 관리 필요 |
| 실무 사용 | 매우 많음 | 많이 사용 |

코딩 테스트에서는 **Kahn 알고리즘**이 가장 많이 사용된다.

---

# 위상 정렬이 많이 사용되는 문제

## 1. 선수 과목

```
```

```
수학

↓

자료구조

↓

알고리즘
```

---

## 2. 프로젝트 일정

```
```

```
설계

↓

개발

↓

테스트

↓

배포
```

---

## 3. 빌드 시스템

```
```

```
Library

↓

Core

↓

App
```

---

## 4. 작업 순서

선행 작업이 있는 모든 문제

---

# 자주 하는 실수

### 1. 무방향 그래프에서 사용

위상 정렬은

```
```

```
방향 그래프
```

에서만 가능하다.

---

### 2. 사이클을 고려하지 않는 경우

사이클이 있으면

```
```

```
정렬 자체가 불가능
```

하다.

---

### 3. 진입 차수 계산 실수

```
```

```
indegree[to]++;
```

를 빼먹으면 결과가 잘못된다.

---

### 4. 진입 차수 감소

```
```

```
indegree[next]--;
```

를 하지 않으면

다음 정점이 큐에 들어가지 않는다.

---

### 5. 여러 개의 정답이 존재할 수 있음

예를 들어

```
```

```
A → C

B → C
```

라면

가능한 결과는

```
```

```
A B C
```

뿐 아니라

```
```

```
B A C
```

도 올바른 위상 정렬이다.

즉, **위상 정렬의 결과는 하나가 아닐 수 있다.**

---

# 언제 사용하는가?

다음과 같은 상황이라면 위상 정렬을 고려할 수 있다.

- **선행 관계를 만족하는 순서를 구해야 하는 경우**
- **방향 그래프이며 사이클이 없는 경우(DAG)**
- **작업의 실행 순서를 결정해야 하는 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 선수 과목 | 과목 수강 순서 |
| 프로젝트 | 작업 스케줄링 |
| 빌드 시스템 | 의존성 해결 |
| 작업 순서 | 선행 조건이 있는 작업 |

---

# 위상 정렬과 다른 그래프 알고리즘 비교

| 알고리즘 | 목적 |
| --- | --- |
| DFS | 그래프 탐색 |
| BFS | 그래프 탐색, 최단 거리(가중치 없음) |
| Union-Find | 집합 관리, 사이클 판별 |
| 다익스트라 | 최단 거리(가중치 ≥ 0) |
| 위상 정렬 | 선행 관계를 만족하는 순서 결정 |

> **핵심:** 위상 정렬은 **"선행 작업이 반드시 먼저 수행되도록 정점을 나열하는 알고리즘**"이다. 진입 차수(In-degree)가 0인 정점부터 처리하는 **Kahn 알고리즘**이 가장 널리 사용되며, **사이클이 없는 방향 그래프(DAG**)에서만 적용할 수 있다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:15:32.998684+00', '2026-08-06 08:15:32.998684+00', NULL),
	('0a3bfb95-d179-4e97-9c50-5e3dca16a830', '11111111-1111-4111-8111-111111111111', 'DP(Dynamic Programming, 동적 계획법)', '## 개념

DP(Dynamic Programming)는 **큰 문제를 작은 문제로 나누고, 이미 계산한 작은 문제의 결과를 저장하여 다시 계산하지 않는 알고리즘 기법**이다.

핵심은

> **"한 번 계산한 결과는 다시 계산하지 않는다."**

이다.

이를 통해 중복 계산을 제거하여 시간 복잡도를 크게 줄일 수 있다.

---

# 언제 사용하는가?

DP는 다음 두 가지 조건을 만족하는 문제에 사용할 수 있다.

### 1. 최적 부분 구조(Optimal Substructure)

큰 문제의 최적해를 **작은 문제의 최적해**로 만들 수 있어야 한다.

예를 들어

```
```

```
피보나치

F(5)

=

F(4) + F(3)
```

---

### 2. 중복되는 부분 문제(Overlapping Subproblems)

같은 작은 문제가 여러 번 계산되어야 한다.

예를 들어

```
```

```
F(5)

├──F(4)

│   ├──F(3)

│   └──F(2)

└──F(3)
```

여기서

```
```

```
F(3)
```

이 두 번 계산된다.

---

# 왜 DP가 필요한가?

피보나치를 재귀로 구현하면

```
```

```
int fib(int n) {

    if(n <= 1)
        return n;

    return fib(n - 1) + fib(n - 2);
}
```

호출 트리

```
```

```
F(5)

├──F(4)

│   ├──F(3)

│   │   ├──F(2)

│   │   └──F(1)

│   └──F(2)

└──F(3)

    ├──F(2)

    └──F(1)
```

같은 계산을 계속 반복한다.

시간 복잡도

```
```

```
O(2^N)
```

---

# DP 적용

이미 계산한 값을 저장한다.

```
```

```
int[] dp = new int[n + 1];

dp[0] = 0;
dp[1] = 1;

for(int i = 2; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
}
```

시간 복잡도

```
```

```
O(N)
```

---

# DP의 두 가지 구현 방식

## 1. Top-Down (Memoization)

재귀를 사용한다.

계산한 값을 메모해 둔다.

```
```

```
static int[] dp;

public static int fib(int n){

    if(n <= 1)
        return n;

    if(dp[n] != 0)
        return dp[n];

    return dp[n] = fib(n - 1) + fib(n - 2);
}
```

### 특징

- \
  재귀 사용
- \
  필요한 값만 계산
- \
  구현이 직관적

---

## 2. Bottom-Up (Tabulation)

가장 작은 문제부터 차례대로 계산한다.

```
```

```
dp[0] = 0;
dp[1] = 1;

for(int i = 2; i <= n; i++){
    dp[i] = dp[i - 1] + dp[i - 2];
}
```

### 특징

- \
  반복문 사용
- \
  스택 오버플로우 위험 없음
- \
  코딩 테스트에서 가장 많이 사용

---

# DP 설계 방법

DP 문제를 풀 때는 다음 순서로 접근하는 것이 중요하다.

## 1. DP 배열 정의

먼저

```
```

```
dp[i]
```

가 무엇을 의미하는지 정의한다.

예시

```
```

```
dp[i]

=

i번째까지의 최대 합
```

또는

```
```

```
dp[i]

=

i번째 계단까지 올라가는 최대 점수
```

---

## 2. 초기값(Base Case)

예를 들어

```
```

```
dp[0]

dp[1]
```

을 먼저 결정한다.

---

## 3. 점화식(Recurrence Relation)

이전 결과를 이용하여 현재 결과를 만든다.

예시

```
```

```
dp[i]

=

dp[i-1]

+

dp[i-2]
```

---

## 4. 계산 순서

점화식을 만족하도록

```
```

```
작은 문제

↓

큰 문제
```

순으로 계산한다.

---

# 대표적인 DP 문제

## 1. 피보나치

```
```

```
dp[i]

=

dp[i-1]

+

dp[i-2]
```

---

## 2. 계단 오르기

```
```

```
dp[i]

=

현재 계단까지의 최대 점수
```

---

## 3. 1로 만들기

```
```

```
dp[i]

=

i를 1로 만드는 최소 연산 횟수
```

점화식

```
```

```
dp[i]

=

min(

dp[i-1],

dp[i/2],

dp[i/3]

)

+1
```

---

## 4. 동전 문제

```
```

```
최소 동전 개수

경우의 수
```

---

## 5. 배낭 문제(Knapsack)

```
```

```
최대 가치
```

를 구하는 대표적인 DP 문제이다.

---

## 6. LIS(최장 증가 부분 수열)

```
```

```
dp[i]

=

i에서 끝나는

가장 긴 증가 부분 수열
```

---

# 시간 복잡도

일반적으로

```
```

```
상태 개수

×

상태 전이 비용
```

으로 계산한다.

예를 들어

```
```

```
N개의 상태

각 상태를 한 번 계산
```

하면

```
```

```
O(N)
```

이다.

---

# 공간 최적화

항상 DP 배열 전체가 필요한 것은 아니다.

피보나치

```
```

```
dp[i]

=

dp[i-1]

+

dp[i-2]
```

는

최근 두 개만 있으면 된다.

```
```

```
int a = 0;
int b = 1;

for(int i = 2; i <= n; i++){

    int c = a + b;

    a = b;
    b = c;
}
```

공간 복잡도

```
```

```
O(1)
```

---

# DFS와 DP의 차이

| 항목 | DFS | DP |
| --- | --- | --- |
| 목적 | 모든 경우 탐색 | 최적값 계산 |
| 중복 계산 | 많음 | 없음 |
| 메모이제이션 | 없음 | 있음 |
| 시간 | 느릴 수 있음 | 빠름 |

---

# 그리디와 DP 비교

| 항목 | DP | 그리디 |
| --- | --- | --- |
| 항상 최적해 | ✅ | ❌ |
| 현재 선택 | 미래까지 고려 | 현재만 고려 |
| 계산량 | 큼 | 적음 |

---

# DP가 많이 사용되는 문제

- \
  피보나치
- \
  계단 오르기
- \
  1로 만들기
- \
  동전 문제
- \
  배낭 문제
- \
  LIS
- \
  LCS
- \
  행렬 곱셈 순서
- \
  문자열 편집 거리(Edit Distance)

---

# 자주 하는 실수

### 1. DP 배열의 의미를 정의하지 않는 경우

가장 중요한 것은

```
```

```
dp[i]
```

가 무엇을 의미하는지 먼저 정의하는 것이다.

---

### 2. 점화식을 먼저 만들려고 하는 경우

올바른 순서는

```
```

```
DP 정의

↓

초기값

↓

점화식

↓

구현
```

이다.

---

### 3. 초기값(Base Case)을 빼먹는 경우

```
```

```
dp[0]

dp[1]
```

을 설정하지 않으면 이후 계산이 모두 잘못된다.

---

### 4. 계산 순서를 잘못 정하는 경우

예를 들어

```
```

```
dp[i]

=

dp[i-1]

+

dp[i-2]
```

라면 반드시 작은 인덱스부터 계산해야 한다.

---

### 5. 모든 문제를 DP로 해결하려는 경우

중복되는 부분 문제가 없다면 DP를 사용할 수 없다.

예를 들어 단순한 정렬이나 그래프 탐색 문제는 DP보다 다른 알고리즘이 적합하다.

---

# DP 문제를 보면 가장 먼저 해야 할 것

1. `dp[i]`**가 무엇을 의미하는지 정의한다.**
2. **초기값(Base Case)을 찾는다.**
3. **현재 상태가 이전 상태들로부터 어떻게 만들어지는지 점화식을 세운다.**
4. **점화식에 맞는 계산 순서(Top-Down 또는 Bottom-Up)를 결정한다.**

---

# 언제 사용하는가?

다음과 같은 상황이라면 DP를 고려할 수 있다.

- **최적의 값을 구해야 하는 경우(최대, 최소, 경우의 수 등)**
- **같은 부분 문제가 반복해서 등장하는 경우**
- **큰 문제를 작은 문제로 나눌 수 있는 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 수열 | 피보나치, 계단 오르기 |
| 최소/최대 | 1로 만들기, 배낭 문제 |
| 경우의 수 | 동전 조합, 타일 채우기 |
| 문자열 | LCS, 편집 거리 |
| 부분 수열 | LIS |

---

# 알고리즘 선택 기준

| 상황 | 사용할 알고리즘 |
| --- | --- |
| 모든 경우 탐색 | DFS / 백트래킹 |
| 최단 거리(가중치 없음) | BFS |
| 최단 거리(가중치 ≥ 0) | 다익스트라 |
| 선행 관계 | 위상 정렬 |
| 같은 부분 문제가 반복되고 최적해를 구함 | DP |

> **핵심:** DP는 **"한 번 계산한 작은 문제의 결과를 저장하고 재사용하여 중복 계산을 제거하는 기법**"이다. 문제를 풀 때는 **①** `dp` **배열의 의미 정의 → ② 초기값 설정 → ③ 점화식 작성 → ④ 계산 순서 결정**의 순서로 접근하면 대부분의 DP 문제를 체계적으로 해결할 수 있다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:15:53.008107+00', '2026-08-06 08:15:53.008107+00', NULL),
	('bb89a19b-a1d3-41d5-905b-b868aaa6897c', '11111111-1111-4111-8111-111111111111', 'Prefix Sum(누적 합)', '## 개념

Prefix Sum(누적 합)은 **배열의 처음부터 특정 위치까지의 합을 미리 계산해 저장해 두는 기법**이다.

이를 이용하면 **구간 합(Range Sum**)을 매우 빠르게 구할 수 있다.

예를 들어

```
```

```
배열

[5, 2, 7, 3, 6]
```

이라면

```
```

```
누적 합

[5, 7, 14, 17, 23]
```

이 된다.

---

# 언제 사용하는가?

다음과 같은 상황이라면 Prefix Sum을 고려한다.

- \
  구간 합을 여러 번 구해야 하는 경우
- \
  배열이 자주 변경되지 않는 경우
- \
  2차원 구간 합을 구하는 경우

---

# 기본 아이디어

배열

```
```

```
Index

0  1  2  3  4

Value

5  2  7  3  6
```

누적 합

```
```

```
Index

0  1  2  3  4

Sum

5  7 14 17 23
```

의 의미는

```
```

```
sum[i]

=

0 ~ i까지의 합
```

이다.

---

# 누적 합 계산

점화식

```
```

```
prefix[i]

=

prefix[i-1]

+

arr[i]
```

예시

```
```

```
prefix[0] = 5

prefix[1] = 5 + 2 = 7

prefix[2] = 7 + 7 = 14

prefix[3] = 14 + 3 = 17

prefix[4] = 17 + 6 = 23
```

---

# 구현

```
```

```
int[] arr = {5, 2, 7, 3, 6};

int[] prefix = new int[arr.length];

prefix[0] = arr[0];

for(int i = 1; i < arr.length; i++){
    prefix[i] = prefix[i - 1] + arr[i];
}
```

---

# 구간 합 구하기

배열

```
```

```
5 2 7 3 6
```

에서

```
```

```
2 + 7 + 3
```

을 구한다고 하자.

인덱스

```
```

```
0 1 2 3 4
```

구간

```
```

```
1 ~ 3
```

---

## 공식

```
```

```
구간합(l ~ r)

=

prefix[r]

-

prefix[l-1]
```

단,

```
```

```
l = 0
```

이면

```
```

```
prefix[r]
```

만 사용한다.

---

예시

```
```

```
prefix

5

7

14

17

23
```

```
```

```
1 ~ 3

=

17

-

5

=

12
```

실제

```
```

```
2 + 7 + 3

=

12
```

이다.

---

# 1-based Prefix Sum

코딩 테스트에서는 인덱스 처리를 단순하게 하기 위해 **1-based 누적 합 배열**을 자주 사용한다.

배열

```
```

```
arr

5 2 7 3 6
```

누적 합

```
```

```
index

0 1 2 3 4 5

value

0 5 7 14 17 23
```

여기서

```
```

```
prefix[0] = 0
```

을 추가한다.

그러면

```
```

```
구간합

l ~ r

=

prefix[r]

-

prefix[l-1]
```

을 **항상 동일한 공식**으로 사용할 수 있다.

---

## 구현

```
```

```
int[] prefix = new int[n + 1];

for(int i = 1; i <= n; i++){
    prefix[i] = prefix[i - 1] + arr[i - 1];
}
```

---

# 시간 복잡도

누적 합 생성

```
```

```
O(N)
```

구간 합

```
```

```
O(1)
```

예를 들어

100만 번의 구간 합을 구해야 한다면

일반 방식

```
```

```
100만 × O(N)
```

누적 합

```
```

```
O(N)

+

100만 × O(1)
```

으로 훨씬 빠르다.

---

# 2차원 Prefix Sum

행렬에서도 사용할 수 있다.

예를 들어

```
```

```
1 2 3

4 5 6

7 8 9
```

2차원 누적 합은

```
```

```
(0,0)

↓

(i,j)
```

까지의 합을 저장한다.

점화식

```
```

```
prefix[i][j]

=

prefix[i-1][j]

+

prefix[i][j-1]

-

prefix[i-1][j-1]

+

arr[i][j]
```

---

## 구간 합 공식

사각형

```
```

```
(x1,y1)

↓

(x2,y2)
```

의 합은

```
```

```
prefix[x2][y2]

-

prefix[x1-1][y2]

-

prefix[x2][y1-1]

+

prefix[x1-1][y1-1]
```

으로 구한다.

---

# Prefix Sum이 많이 사용되는 문제

## 1. 구간 합

대표 문제

- \
  구간 합 구하기
- \
  수열의 합

---

## 2. 평균

```
```

```
구간 평균

=

구간 합

/

길이
```

---

## 3. 누적 빈도

문자의 개수

알파벳 개수

등을 저장한다.

---

## 4. 2차원 합

대표 문제

- \
  행렬 합
- \
  이미지 처리
- \
  지도 문제

---

## 5. 차분 배열(Difference Array)과 함께 사용

```
```

```
구간 업데이트

+

구간 합
```

문제에서 자주 등장한다.

---

# Prefix Sum과 Sliding Window 비교

| 항목 | Prefix Sum | Sliding Window |
| --- | --- | --- |
| 목적 | 임의의 구간 합 | 연속된 일정 조건의 구간 탐색 |
| 구간 길이 | 자유 | 보통 고정 또는 조건에 따라 변화 |
| 시간 | 전처리 O(N), 질의 O(1) | 전체 O(N) |
| 활용 | 구간 합 질의 | 최대/최소 구간, 부분 배열 |

---

# 자주 하는 실수

### 1. 인덱스 오류

```
```

```
prefix[r]

-

prefix[l]
```

가 아니라

```
```

```
prefix[r]

-

prefix[l-1]
```

이다.

---

### 2. l = 0 처리

0-based 배열에서는

```
```

```
l == 0
```

을 별도로 처리해야 한다.

이를 피하기 위해 **1-based Prefix Sum**을 많이 사용한다.

---

### 3. 누적 합 자료형

원소가 크거나 개수가 많으면

```
```

```
int
```

가 아니라

```
```

```
long
```

을 사용해야 한다.

예를 들어

```
```

```
100000

×

100000
```

은 `int` 범위를 초과한다.

---

### 4. 배열이 자주 변경되는 경우

Prefix Sum은 **배열이 변경되지 않을 때** 효과적이다.

배열 값이 자주 바뀌면 누적 합을 다시 계산해야 하므로 비효율적이다.

이 경우에는 **세그먼트 트리(Segment Tree**)나 **펜윅 트리(Fenwick Tree, Binary Indexed Tree**)를 고려해야 한다.

---

# 언제 사용하는가?

다음과 같은 상황이라면 Prefix Sum을 고려할 수 있다.

- **구간 합을 여러 번 구해야 하는 경우**
- **배열이 자주 변경되지 않는 경우**
- **2차원 행렬의 구간 합을 구하는 경우**
- **구간 평균, 누적 빈도 등을 빠르게 계산해야 하는 경우**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 구간 합 | 구간 합 구하기 |
| 평균 | 구간 평균 계산 |
| 2차원 | 행렬 구간 합 |
| 빈도 | 문자 개수, 알파벳 개수 |
| 응용 | 차분 배열, 구간 업데이트 |

---

# 알고리즘 선택 기준

| 상황 | 사용할 기법 |
| --- | --- |
| 구간 합이 많고 배열이 고정 | Prefix Sum |
| 고정 길이 구간 탐색 | Sliding Window |
| 배열 값이 자주 변경됨 | Segment Tree / Fenwick Tree |
| 최적값과 중복 부분 문제 | DP |

> **핵심:** Prefix Sum은 **"처음부터 현재 위치까지의 누적 합을 미리 계산해 두고, 구간 합을 O(1)에 구하는 기법**"이다. 전처리에 `O(N)`이 들지만, 이후 수많은 구간 합 질의를 매우 빠르게 처리할 수 있어 코딩 테스트에서 가장 자주 사용되는 전처리 기법 중 하나이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:16:11.534109+00', '2026-08-06 08:16:11.534109+00', NULL),
	('1642aa6d-038b-43b3-9e43-40f5a1f3c2e7', '11111111-1111-4111-8111-111111111111', '세그먼트 트리(Segment Tree)', '## 개념

세그먼트 트리(Segment Tree)는 **배열의 구간 정보를 트리 형태로 저장하여, 구간 질의와 값의 변경을 빠르게 처리하는 자료구조**이다.

대표적으로 다음과 같은 연산을 효율적으로 수행할 수 있다.

- 구간 합(Range Sum)
- 구간 최솟값(Range Minimum)
- 구간 최댓값(Range Maximum)
- 구간 곱
- GCD(최대공약수)
- XOR 등

---

# 언제 사용하는가?

다음과 같은 상황이라면 세그먼트 트리를 고려한다.

- **구간 질의가 많다.**
- **배열의 값이 자주 변경된다.**

예를 들어

```
```

```
1 5 2 8 3 7 4
```

에서

- \
  2\~5 구간의 합
- \
  1번 값을 변경
- \
  3\~6 구간의 합
- \
  4번 값을 변경

처럼 **조회(Query)와 수정(Update)이 반복되는 문제**에서 사용한다.

---

# Prefix Sum과의 차이

누적 합(Prefix Sum)은

```
```

```
구간 합

O(1)
```

이 가능하다.

하지만

```
```

```
값 하나 변경
```

이 발생하면

```
```

```
이후의 누적 합을

모두 다시 계산
```

해야 한다.

즉

```
```

```
업데이트

O(N)
```

이다.

반면 세그먼트 트리는

```
```

```
구간 합

O(log N)

값 변경

O(log N)
```

으로 모두 빠르다.

---

# 핵심 아이디어

배열을 계속 반으로 나누어 트리를 만든다.

예를 들어

```
```

```
배열

1 5 2 8
```

이라면

```
```

```
             [1~4]

          /          \

      [1~2]         [3~4]

     /      \       /     \

   [1]      [2]   [3]     [4]
```

각 노드는

```
```

```
자신이 담당하는 구간의 정보
```

를 저장한다.

예를 들어

구간 합이라면

```
```

```
             16

          /      \

        6         10

      /   \      /   \

     1     5    2     8
```

---

# 트리 구조

배열

```
```

```
Index

1 2 3 4 5 6 7 8
```

트리

```
```

```
[1~8]

↓

[1~4] [5~8]

↓

[1~2] [3~4] [5~6] [7~8]

↓

...
```

높이는

```
```

```
log₂N
```

이다.

---

# 생성(Build)

부모 노드는

```
```

```
왼쪽 자식

+

오른쪽 자식
```

으로 만든다.

예를 들어

```
```

```
1 5 2 8
```

이라면

```
```

```
[1]

[5]

↓

6

[2]

[8]

↓

10

↓

16
```

---

# 구현

## Node

보통 배열로 구현한다.

```
```

```
long[] tree = new long[4 * n];
```

왜

```
```

```
4 * N
```

인가?

세그먼트 트리의 최대 크기를 안전하게 확보하기 위한 관례이다.

---

## Build

```
```

```
public static long build(int node, int start, int end){

    if(start == end)
        return tree[node] = arr[start];

    int mid = (start + end) / 2;

    return tree[node] =
        build(node * 2, start, mid)
      + build(node * 2 + 1, mid + 1, end);
}
```

---

# 구간 합(Query)

예를 들어

```
```

```
2~5
```

의 합을 구한다고 하자.

세 가지 경우가 존재한다.

---

## 1. 전혀 겹치지 않음

```
```

```
현재

1~3

질의

5~7
```

```
```

```
반환

0
```

---

## 2. 완전히 포함

```
```

```
현재

3~5

질의

2~7
```

```
```

```
현재 노드 반환
```

---

## 3. 일부만 겹침

```
```

```
현재

1~5

질의

3~7
```

왼쪽

오른쪽

재귀 호출

---

## Query 구현

```
```

```
public static long query(
    int node,
    int start,
    int end,
    int left,
    int right){

    if(right < start || end < left)
        return 0;

    if(left <= start && end <= right)
        return tree[node];

    int mid = (start + end) / 2;

    return query(node*2,start,mid,left,right)
         + query(node*2+1,mid+1,end,left,right);
}
```

---

# 값 변경(Update)

예를 들어

```
```

```
5

↓

10
```

으로 변경한다.

그러면

```
```

```
리프 노드

↓

부모

↓

부모

↓

루트
```

순으로 다시 계산한다.

---

## Update 구현

```
```

```
public static void update(
    int node,
    int start,
    int end,
    int index,
    int value){

    if(index < start || index > end)
        return;

    if(start == end){

        tree[node] = value;
        return;
    }

    int mid = (start + end) / 2;

    update(node*2,start,mid,index,value);
    update(node*2+1,mid+1,end,index,value);

    tree[node] =
        tree[node*2]
      + tree[node*2+1];
}
```

---

# 시간 복잡도

| 연산 | 시간 |
| --- | --- |
| Build | O(N) |
| Query | O(log N) |
| Update | O(log N) |

---

# 왜 O(log N)일까?

트리 높이는

```
```

```
log₂N
```

이다.

Query와 Update는

필요한 노드만 방문한다.

따라서

```
```

```
O(log N)
```

이다.

---

# Lazy Propagation

만약

```
```

```
1~100000

모두 +5
```

를 해야 한다면

일반 Update는

100000번 수정해야 한다.

이를 해결하는 것이

```
```

```
Lazy Propagation
```

이다.

변경 사항을

```
```

```
나중에 필요할 때

적용
```

하도록 미룬다.

대표 문제

- \
  구간 덧셈
- \
  구간 변경
- \
  구간 XOR

---

# 세그먼트 트리가 많이 사용되는 문제

## 1. 구간 합

```
```

```
합
```

---

## 2. 구간 최솟값

```
```

```
Minimum Query
```

---

## 3. 구간 최댓값

```
```

```
Maximum Query
```

---

## 4. 구간 곱

---

## 5. 순위 계산

---

## 6. 구간 업데이트

Lazy Propagation과 함께 사용

---

# Prefix Sum과 비교

| 항목 | Prefix Sum | Segment Tree |
| --- | --- | --- |
| 구간 합 | O(1) | O(log N) |
| 값 변경 | O(N) | O(log N) |
| 구현 | 매우 쉬움 | 어려움 |
| 메모리 | O(N) | O(4N) |

---

# Fenwick Tree(BIT)와 비교

| 항목 | Fenwick Tree | Segment Tree |
| --- | --- | --- |
| 구현 | 쉬움 | 어려움 |
| 구간 합 | O(log N) | O(log N) |
| 값 변경 | O(log N) | O(log N) |
| 최소/최대 | ❌ | ✅ |
| 다양한 연산 | 제한적 | 매우 다양 |

---

# 자주 하는 실수

### 1. 배열 크기 부족

```
```

```
tree = new long[n];
```

가 아니라

```
```

```
tree = new long[4 * n];
```

을 사용하는 것이 일반적이다.

---

### 2. 구간 조건 실수

겹치지 않는 경우

```
```

```
if(right < start || end < left)
```

를 잘못 작성하면 오답이 발생한다.

---

### 3. 부모 갱신 누락

Update 후

```
```

```
tree[node]

=

left

+

right
```

를 다시 계산해야 한다.

---

### 4. int 오버플로우

합을 저장할 때는

```
```

```
long
```

을 사용하는 것이 안전하다.

---

# 언제 사용하는가?

다음과 같은 상황이라면 세그먼트 트리를 고려한다.

- **구간 질의와 값 변경이 모두 많은 경우**
- **구간 합뿐 아니라 최소, 최대 등 다양한 연산이 필요한 경우**
- **구간 업데이트까지 효율적으로 처리해야 하는 경우(Lazy Propagation)**

대표 문제 유형은 다음과 같다.

| 유형 | 예시 문제 |
| --- | --- |
| 구간 합 | 합 구하기 + 값 변경 |
| RMQ | 구간 최소/최대 |
| 순위 | 순위 계산, 역전 수 |
| 구간 업데이트 | Lazy Propagation 문제 |

---

# 알고리즘 선택 기준

| 상황 | 사용할 자료구조/기법 |
| --- | --- |
| 구간 합만 많고 배열이 변경되지 않음 | Prefix Sum |
| 구간 합 + 값 변경 | Fenwick Tree 또는 Segment Tree |
| 최소/최대 등 다양한 구간 연산 | Segment Tree |
| 구간 업데이트까지 필요 | Segment Tree + Lazy Propagation |

> **핵심:** 세그먼트 트리는 **"배열의 구간 정보를 트리 형태로 저장하여 구간 질의와 업데이트를 모두 O(log N)에 처리하는 자료구조**"이다. Prefix Sum이 업데이트에 약한 반면, 세그먼트 트리는 조회와 수정이 모두 빈번한 문제에서 매우 강력한 성능을 제공한다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:16:35.510931+00', '2026-08-06 08:16:35.510931+00', NULL),
	('8673a1aa-c061-4d83-bf17-3572c6ddc800', '11111111-1111-4111-8111-111111111111', '동기(Synchronous)와 비동기(Asynchronous)', '## 정의

동기와 비동기는 **작업의 완료를 기다리는 방식**을 의미한다.

- **동기(Synchronous)**: 이전 작업이 끝날 때까지 기다린 후 다음 작업을 수행한다.
- **비동기(Asynchronous)**: 이전 작업의 완료를 기다리지 않고 다음 작업을 수행한다.

즉, 핵심 차이는 **"결과를 기다리느냐, 기다리지 않느냐**"이다.

---

# 동기(Synchronous)

## 정의

동기 방식에서는 하나의 작업이 끝나야 다음 작업을 시작할 수 있다.

```
```

```
작업 A 시작
      ↓
작업 A 완료
      ↓
작업 B 시작
      ↓
작업 B 완료
```

---

## 예시

은행에서 번호표를 뽑고 창구에서 업무를 보는 상황을 생각해보자.

```
```

```
1번 고객 처리
      ↓
완료
      ↓
2번 고객 처리
      ↓
완료
```

앞사람의 업무가 끝나기 전까지는 자신의 차례가 오지 않는다.

---

## 코드 예시 (JavaScript)

```
```

```
function taskA() {
  console.log("A 시작");
  console.log("A 종료");
}

function taskB() {
  console.log("B 시작");
}

taskA();
taskB();
```

출력

```
```

```
A 시작
A 종료
B 시작
```

taskA가 끝난 후 taskB가 실행된다.

---

# 동기의 장점

- \
  실행 순서를 예측하기 쉽다.
- \
  코드가 직관적이다.
- \
  디버깅이 쉽다.

---

# 동기의 단점

- \
  하나의 작업이 오래 걸리면 전체가 멈춘다.
- \
  CPU나 자원을 효율적으로 활용하지 못할 수 있다.

---

# 비동기(Asynchronous)

## 정의

비동기는 작업이 끝날 때까지 기다리지 않고 다음 작업을 수행한다.

```
```

```
작업 A 시작
      ↓
작업 B 시작
      ↓
작업 C 시작
      ↓
A 완료
```

---

## 예시

카페에서 커피를 주문하는 상황을 생각해보자.

```
```

```
주문
      ↓
진동벨 수령
      ↓
자리에서 기다림
      ↓
커피 완성 알림
```

커피가 만들어지는 동안 다른 일을 할 수 있다.

---

## 코드 예시 (JavaScript)

```
```

```
console.log("시작");

setTimeout(() => {
  console.log("비동기 작업");
}, 1000);

console.log("끝");
```

출력

```
```

```
시작
끝
비동기 작업
```

`setTimeout`은 완료를 기다리지 않고 다음 코드가 실행된다.

---

# Promise 예시

```
```

```
function fetchData() {
  return new Promise((resolve) => {
    setTimeout(() => resolve("데이터"), 1000);
  });
}

console.log("요청");

fetchData().then((result) => {
  console.log(result);
});

console.log("다음 작업");
```

출력

```
```

```
요청
다음 작업
데이터
```

---

# async / await

`async/await`는 비동기 코드를 **동기 코드처럼 읽기 쉽게 작성**할 수 있도록 도와주는 문법이다.

```
```

```
async function run() {
  console.log("요청");

  const data = await fetchData();

  console.log(data);
  console.log("종료");
}
```

`await`는 해당 비동기 작업의 완료를 기다리지만, **프로그램 전체를 멈추는 것이 아니라 현재 async 함수의 실행만 일시 중단**한다. 다른 비동기 작업이나 이벤트 처리는 계속 진행된다.

---

# 동기 vs 비동기

| 구분 | 동기 | 비동기 |
| --- | --- | --- |
| 작업 방식 | 이전 작업 완료 후 다음 작업 실행 | 이전 작업 완료를 기다리지 않음 |
| 실행 순서 | 순차적 | 완료 순서가 달라질 수 있음 |
| 대기 시간 | 작업이 끝날 때까지 대기 | 대기하지 않고 다른 작업 수행 |
| 코드 이해 | 쉽다 | 상대적으로 어렵다 |
| 성능 | 대기 시간이 길어질 수 있음 | 자원 활용이 효율적 |

---

# 동기와 블로킹은 다른 개념

많이 혼동되는 개념이지만 **동기/비동기**와 **블로킹/논블로킹**은 서로 다른 기준이다.

- **동기/비동기**: 결과를 기다리는 방식
- **블로킹/논블로킹**: 호출한 스레드가 제어권을 잃고 멈추는지 여부

예를 들어:

- **동기 + 블로킹**: 파일을 읽는 동안 현재 스레드가 멈추고, 완료 후 다음 작업 수행
- **동기 + 논블로킹**: 작업 상태를 계속 확인(polling)하면서 완료를 기다림
- **비동기 + 논블로킹**: 작업을 요청한 뒤 다른 일을 하다가 완료되면 콜백이나 이벤트로 결과를 받음
- **비동기 + 블로킹**도 이론적으로 가능하지만 일반적인 애플리케이션에서는 거의 사용되지 않는다.

---

# 언제 사용하는가?

## 동기가 적합한 경우

- \
  계산 결과가 즉시 필요한 경우
- \
  작업 순서가 반드시 보장되어야 하는 경우
- \
  간단한 로직

예시

- \
  수학 계산
- \
  데이터 검증
- \
  순차적인 비즈니스 로직

---

## 비동기가 적합한 경우

- \
  시간이 오래 걸리는 작업
- \
  네트워크 통신
- \
  파일 입출력
- \
  데이터베이스 조회
- \
  사용자 입력 대기

예시

```
```

```
웹 페이지

사용자 요청
      ↓
DB 조회(비동기)
      ↓
다른 요청 처리 가능
      ↓
조회 완료 후 응답
```

---

# 면접 핵심 질문

### Q1. 동기와 비동기의 차이는 무엇인가?

- \
  동기는 이전 작업이 끝날 때까지 기다린 후 다음 작업을 수행한다.
- \
  비동기는 이전 작업의 완료를 기다리지 않고 다음 작업을 수행하며, 완료 시점에 결과를 전달받는다.

---

### Q2. `async/await`는 동기 방식인가?

아니다.

`async/await`는 **비동기 프로그래밍 문법**이다. 코드의 작성 형태가 동기처럼 보일 뿐이며, 실제로는 Promise를 기반으로 동작한다.

---

### Q3. 비동기를 사용하는 이유는?

시간이 오래 걸리는 작업 동안 다른 작업을 수행할 수 있어 응답성과 자원 활용이 향상되기 때문이다.

---

### Q4. JavaScript는 싱글 스레드인데 어떻게 비동기를 처리하는가?

JavaScript 엔진은 기본적으로 **싱글 스레드**이지만, 브라우저(Web APIs)나 Node.js(libuv)가 타이머, 네트워크, 파일 입출력 등의 작업을 처리한다. 작업이 완료되면 **이벤트 루프(Event Loop**)가 콜백이나 Promise 작업을 실행 큐에서 가져와 메인 스레드에서 실행한다.

---

# 한 줄 요약

- **동기(Synchronous)**: 이전 작업의 **완료를 기다린 후** 다음 작업을 수행하는 방식이다.
- **비동기(Asynchronous)**: 이전 작업의 **완료를 기다리지 않고** 다른 작업을 수행한 뒤, 완료 시점에 결과를 전달받는 방식이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:17:30.430851+00', '2026-08-06 08:17:30.430851+00', NULL),
	('d9e8b620-6862-49eb-a806-0b00cd563e0e', '11111111-1111-4111-8111-111111111111', '뮤텍스(Mutex)와 세마포어(Semaphore)', '## 정의

뮤텍스와 세마포어는 **여러 스레드(또는 프로세스)가 공유 자원에 동시에 접근할 때 발생하는 문제를 방지하기 위한 동기화(Synchronization) 기법**이다.

이들을 사용하는 이유는 **Race Condition(경쟁 상태**)을 방지하기 위해서이다.

---

# Race Condition이란?

여러 스레드가 동시에 하나의 데이터를 수정하면 예상하지 못한 결과가 발생할 수 있다.

예를 들어

```
```

```
int count = 0;
```

두 개의 스레드가 동시에 실행된다.

```
```

```
Thread A
count++;

Thread B
count++;
```

기대한 결과

```
```

```
count = 2
```

실제 결과

```
```

```
count = 1
```

왜냐하면

```
```

```
count++
```

는 하나의 명령이 아니라

```
```

```
읽기(Read)
↓

증가(Add)

↓

쓰기(Write)
```

세 단계로 수행되기 때문이다.

두 스레드가 동시에 읽으면 둘 다 0을 읽고 각각 1을 저장하여 최종 결과가 1이 될 수 있다.

---

# 임계 영역(Critical Section)

임계 영역이란 **한 번에 하나의 스레드만 접근해야 하는 코드 영역**이다.

예시

```
```

```
balance += 100;
```

또는

```
```

```
queue.push(data);
```

공유 자원을 수정하는 코드는 대부분 임계 영역이다.

---

# 뮤텍스(Mutex)

## 정의

Mutex(Mutual Exclusion)는 **한 번에 하나의 스레드만 공유 자원에 접근하도록 보장하는 동기화 객체**이다.

핵심은 **소유권(Ownership)** 이 있다는 점이다.

- \
  Lock을 획득한 스레드만 Unlock할 수 있다.

---

# 동작 방식

```
```

```
Thread A

Lock 획득
↓

임계 영역

↓

Unlock
```

그동안

```
```

```
Thread B

Lock 시도

↓

대기
```

---

# 코드 예시 (C++)

```
```

```
#include <iostream>
#include <mutex>

std::mutex m;
int count = 0;

void increase() {
    m.lock();

    count++;

    m.unlock();
}
```

보통은 예외 안전성을 위해 `lock()`/`unlock()` 대신 RAII 방식인 `std::lock_guard` 또는 `std::unique_lock`을 사용한다.

```
```

```
void increase() {
    std::lock_guard<std::mutex> lock(m);
    count++;
}
```

함수를 벗어나면 자동으로 Unlock된다.

---

# 뮤텍스의 특징

- \
  한 번에 한 명만 접근 가능
- \
  Lock을 건 스레드만 Unlock 가능
- \
  이진 상태(잠김/풀림)
- \
  임계 영역 보호에 가장 많이 사용

---

# 세마포어(Semaphore)

## 정의

세마포어는 **여러 개의 스레드가 제한된 개수만큼 공유 자원에 접근하도록 제어하는 동기화 기법**이다.

뮤텍스와 달리 **소유권이 없다.**

즉

- \
  Lock한 스레드와
- \
  Release하는 스레드가

같지 않아도 된다.

---

# 동작 방식

세마포어는 내부적으로 **카운터(Counter)** 를 가진다.

예를 들어

```
```

```
Semaphore = 3
```

이면

```
```

```
Thread A → 입장

Thread B → 입장

Thread C → 입장
```

가능하지만

```
```

```
Thread D
```

는 대기한다.

누군가 나오면

```
```

```
Counter++
```

되고

다음 스레드가 들어간다.

---

# 코드 예시 (개념)

```
```

```
semaphore.acquire();

// 임계 영역

semaphore.release();
```

---

# Binary Semaphore

카운트가

```
```

```
1
```

인 세마포어

```
```

```
Semaphore = 1
```

겉으로는 Mutex처럼 보인다.

하지만 차이가 있다.

---

# Binary Semaphore와 Mutex 차이

Mutex

```
```

```
Thread A Lock

↓

Thread A만 Unlock 가능
```

Binary Semaphore

```
```

```
Thread A Acquire

↓

Thread B Release 가능
```

즉

**소유권 유무**가 가장 큰 차이이다.

---

# Counting Semaphore

카운트를 여러 개 가진 세마포어

예)

```
```

```
Semaphore = 5
```

동시에

```
```

```
5명
```

까지 접근 가능하다.

---

# 사용 예시

### Mutex

프린터 한 대

```
```

```
사용자 A

↓

사용

↓

반납

↓

사용자 B
```

한 번에 한 명만 사용할 수 있다.

---

### Semaphore

주차장

```
```

```
주차 공간 = 10
```

동시에

```
```

```
10대
```

까지 가능하다.

11번째 차량은 대기한다.

---

# 뮤텍스 vs 세마포어

| 구분 | 뮤텍스(Mutex) | 세마포어(Semaphore) |
| --- | --- | --- |
| 접근 가능 개수 | 1개 | 여러 개 가능 |
| 내부 값 | 잠김/풀림 | 카운터 |
| 소유권 | 있음 | 없음 |
| Unlock/Release | Lock한 스레드만 가능 | 다른 스레드도 가능 |
| 목적 | 상호 배제(Mutual Exclusion) | 자원 개수 관리 및 접근 제한 |

---

# 언제 사용하는가?

## Mutex

공유 데이터를 보호할 때

```
```

```
balance += money;
```

```
```

```
vector.push_back();
```

```
```

```
queue.pop();
```

한 번에 한 스레드만 접근해야 한다.

---

## Semaphore

자원의 개수를 제한할 때

예)

```
```

```
DB Connection Pool

최대 20개
```

또는

```
```

```
Thread Pool

동시 작업 8개
```

또는

```
```

```
다운로드 동시 실행

최대 5개
```

---

# Deadlock(교착 상태)

뮤텍스를 잘못 사용하면 Deadlock이 발생할 수 있다.

예시

```
```

```
Thread A

Lock1 획득

↓

Lock2 대기
```

```
```

```
Thread B

Lock2 획득

↓

Lock1 대기
```

결국 서로 기다리며 영원히 진행되지 않는다.

이를 방지하기 위해서는 다음과 같은 방법을 사용한다.

- \
  Lock 획득 순서를 항상 동일하게 유지
- \
  여러 Lock을 한 번에 획득 (`std::lock`)
- `try_lock()`을 활용하여 실패 시 재시도
- \
  Lock을 오래 유지하지 않기

---

# 면접 핵심 질문

### Q1. 뮤텍스와 세마포어의 가장 큰 차이는?

- **뮤텍스는 소유권이 있는 상호 배제(Mutual Exclusion) 도구**이며, Lock을 획득한 스레드만 Unlock할 수 있다.
- **세마포어는 카운터 기반의 접근 제어 도구**이며, 여러 스레드의 접근 수를 제한하는 데 사용되고 소유권이 없다.

---

### Q2. Binary Semaphore와 Mutex는 같은가?

아니다.

동시에 하나의 작업만 허용한다는 점은 비슷하지만,

- \
  Mutex는 소유권이 있고,
- \
  Binary Semaphore는 소유권이 없다.

---

### Q3. 세마포어는 언제 사용하는가?

공유 자원을 **하나만 보호**하는 것이 아니라, **제한된 개수의 자원을 여러 스레드가 공유**해야 할 때 사용한다.

예를 들어

- \
  DB 커넥션 풀
- \
  스레드 풀
- \
  네트워크 연결 수 제한

---

### Q4. 왜 Mutex가 필요한가?

공유 데이터를 동시에 수정하면 Race Condition이 발생할 수 있으므로, **임계 영역에 한 번에 하나의 스레드만 접근하도록 보장하기 위해** 사용한다.

---

# 기억하면 좋은 핵심

> **Mutex는 "한 명만 들어와라"를 보장하는 자물쇠이고, Semaphore는 "최대 N명까지 들어와라"를 관리하는 출입 인원 카운터이다.**

---

# 한 줄 요약

- **뮤텍스(Mutex)**: 공유 자원의 **상호 배제**를 위해 사용하는 동기화 기법으로, **한 번에 하나의 스레드만 접근 가능하며 소유권이 있다.**
- **세마포어(Semaphore)**: 제한된 개수의 공유 자원에 대한 **동시 접근 수를 제어**하는 동기화 기법으로, **카운터를 사용하며 소유권이 없다.**', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:17:53.129376+00', '2026-08-06 08:17:53.129376+00', NULL),
	('e949c598-2192-4e2d-a8c4-e3fadbeff4bd', '11111111-1111-4111-8111-111111111111', 'TCP와 UDP', '# TCP와 UDP

## 정의

TCP(Transmission Control Protocol)와 UDP(User Datagram Protocol)는 **전송 계층(Transport Layer)** 에서 사용하는 대표적인 프로토콜이다.

둘 다 데이터를 송수신하는 역할을 하지만,

- **TCP는 신뢰성(Reliability)을 우선**
- **UDP는 속도(Speed)를 우선**

한다.

---

# TCP와 UDP의 위치

TCP와 UDP는 OSI 7계층과 TCP/IP 모델에서 **전송 계층**에 위치한다.

```
```

```
응용 계층 (Application)
        │
전송 계층 (TCP / UDP)
        │
인터넷 계층 (IP)
        │
네트워크 인터페이스 계층
```

IP는 데이터를 목적지까지 전달하고,

TCP와 UDP는 **어떤 방식으로 데이터를 전달할지**를 결정한다.

---

# TCP (Transmission Control Protocol)

## 정의

TCP는 **신뢰성 있는 데이터 전송을 제공하는 연결 지향(Connection-Oriented) 프로토콜**이다.

데이터를 보내기 전에 연결을 설정하고, 모든 데이터가 정상적으로 도착했는지 확인한다.

---

## 특징

- \
  연결 지향(Connection-Oriented)
- \
  신뢰성 보장
- \
  데이터 순서 보장
- \
  오류 검출 및 재전송
- \
  흐름 제어
- \
  혼잡 제어

---

## 연결 과정

데이터를 보내기 전에 **3-Way Handshake**를 수행한다.

클라이언트

서버

CLOSED

LISTEN

시간

다음: SYN

연결 전

아직 전송된 세그먼트가 없으며, 서버는 LISTEN 상태를 유지합니다.

과정

```
```

```
Client → SYN
Server → SYN + ACK
Client → ACK
```

연결이 완료된 후 데이터 전송이 시작된다.

---

# TCP의 데이터 전송

TCP는 데이터를 보낸 후 상대방의 ACK(응답)를 기다린다.

ACK가 오지 않으면 데이터를 다시 전송한다.

```
```

```
송신자

Packet1
↓

ACK

↓

Packet2

↓

ACK

↓

Packet3
```

이러한 방식으로 데이터 손실을 방지한다.

---

# TCP의 장점

## 1. 신뢰성

패킷이 손실되면 재전송한다.

---

## 2. 순서 보장

도착 순서가 바뀌어도 원래 순서대로 재조립한다.

---

## 3. 오류 복구

손상된 데이터는 다시 요청한다.

---

## 4. 흐름 제어

수신자의 처리 속도에 맞춰 전송량을 조절한다.

대표적으로 **슬라이딩 윈도우(Sliding Window)** 기법을 사용한다.

---

## 5. 혼잡 제어

네트워크가 혼잡하면 전송 속도를 줄여 전체 네트워크 성능을 유지한다.

대표적인 알고리즘

- \
  Slow Start
- \
  Congestion Avoidance
- \
  Fast Retransmit
- \
  Fast Recovery

---

# TCP의 단점

- \
  연결 설정 시간이 필요하다.
- \
  ACK 확인 과정이 있다.
- \
  재전송 비용이 발생한다.
- \
  속도가 UDP보다 느리다.

---

# UDP (User Datagram Protocol)

## 정의

UDP는 **연결 없이 데이터를 빠르게 전송하는 비연결형(Connectionless) 프로토콜**이다.

상대방이 데이터를 받았는지 확인하지 않는다.

---

## 특징

- \
  비연결형(Connectionless)
- \
  신뢰성 보장 없음
- \
  순서 보장 없음
- \
  재전송 없음
- \
  매우 빠름

---

# UDP의 데이터 전송

```
```

```
Sender

Packet1

↓

Packet2

↓

Packet3

↓

Packet4
```

ACK를 기다리지 않는다.

패킷이 사라져도 그대로 진행한다.

---

# TCP와 UDP 동작 비교

·····

송신자

수신자

확인 응답

수신된 패킷

TCP는 손실된 3번째 패킷을 감지해 재전송합니다. 그래서 패킷 5개가 모두 도착합니다.

프로토콜

TCPUDP

TCPUDP

패킷 손실

손실 없음패킷 3 손실

손실 없음패킷 3 손실

TCP는 패킷 손실이 발생하면 ACK를 확인한 뒤 누락된 패킷을 재전송한다. 반면 UDP는 재전송 없이 다음 패킷을 계속 전송하므로 지연은 적지만 일부 데이터가 손실될 수 있다.

---

# UDP의 장점

## 1. 매우 빠르다.

연결 과정이 없다.

---

## 2. 지연 시간이 적다.

ACK를 기다리지 않는다.

---

## 3. 오버헤드가 작다.

헤더가 TCP보다 작다.

- \
  TCP 헤더: 최소 20Byte
- \
  UDP 헤더: 8Byte

---

# UDP의 단점

- \
  데이터 유실 가능
- \
  순서 보장 안 됨
- \
  재전송 없음
- \
  신뢰성 보장 안 됨

---

# TCP vs UDP

| 구분 | TCP | UDP |
| --- | --- | --- |
| 연결 방식 | 연결 지향 | 비연결형 |
| 신뢰성 | 보장 | 보장하지 않음 |
| 데이터 순서 | 보장 | 보장하지 않음 |
| 재전송 | 있음 | 없음 |
| 속도 | 상대적으로 느림 | 빠름 |
| 흐름 제어 | 있음 | 없음 |
| 혼잡 제어 | 있음 | 없음 |
| 헤더 크기 | 최소 20Byte | 8Byte |

---

# 언제 사용하는가?

## TCP

정확성이 중요한 경우

- \
  웹 서비스(HTTP/HTTPS)
- \
  이메일(SMTP, IMAP, POP3)
- \
  파일 전송(FTP)
- \
  데이터베이스 통신
- \
  SSH

데이터가 하나라도 빠지면 안 되는 상황에 적합하다.

---

## UDP

속도가 중요한 경우

- \
  실시간 게임
- \
  음성 통화(VoIP)
- \
  영상 스트리밍
- \
  DNS 조회
- \
  라이브 방송

일부 패킷이 손실되어도 서비스가 계속 동작하는 경우에 적합하다.

---

# TCP와 HTTP의 관계

많은 사람들이 HTTP가 직접 데이터를 전송한다고 생각하지만 실제 구조는 다음과 같다.

```
```

```
HTTP
   ↓
TCP
   ↓
IP
   ↓
Network
```

즉,

- \
  HTTP는 애플리케이션 프로토콜
- \
  TCP는 데이터를 안전하게 전달하는 전송 프로토콜

HTTPS도 마찬가지이며 **HTTP + TLS + TCP** 위에서 동작한다.

---

# 면접 핵심 질문

### Q1. TCP와 UDP의 가장 큰 차이는?

- \
  TCP는 **연결을 설정하고 신뢰성 있는 전송을 제공**한다.
- \
  UDP는 **연결 없이 빠르게 데이터를 전송**하지만 신뢰성을 보장하지 않는다.

---

### Q2. TCP가 신뢰성을 보장하는 방법은?

- \
  3-Way Handshake로 연결을 설정한다.
- \
  ACK를 통해 수신 여부를 확인한다.
- \
  손실된 패킷은 재전송한다.
- \
  순서가 바뀐 패킷은 원래 순서대로 재조립한다.

---

### Q3. UDP는 왜 빠른가?

- \
  연결 설정 과정이 없다.
- \
  ACK를 기다리지 않는다.
- \
  재전송을 하지 않는다.
- \
  헤더 크기가 작아 오버헤드가 적다.

---

### Q4. 실시간 게임은 왜 UDP를 사용할까?

게임에서는 약간의 데이터 손실보다 **지연 시간(Latency)** 이 더 중요하다. 이전 위치 정보가 늦게 도착하는 것보다 최신 위치 정보가 빠르게 도착하는 것이 사용자 경험에 더 유리하기 때문에 UDP를 사용하는 경우가 많다.

---

# 기억하면 좋은 핵심

> **TCP는 "정확하게 전달"하는 택배 서비스이고, UDP는 "빠르게 전달"하는 방송 서비스에 가깝다.**

- \
  TCP는 받았는지 확인하고, 누락되면 다시 보낸다.
- \
  UDP는 받았는지 확인하지 않고 계속 전송한다.

---

# 한 줄 요약

- **TCP**: 연결 지향 프로토콜로, **신뢰성과 순서를 보장**하기 위해 ACK, 재전송, 흐름 제어, 혼잡 제어를 제공한다.
- **UDP**: 비연결형 프로토콜로, **신뢰성보다 속도와 낮은 지연 시간**을 우선하며 실시간 통신에 적합하다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:18:14.140477+00', '2026-08-06 08:18:14.140477+00', NULL),
	('bf70504d-70b6-4871-ae34-038b920475f6', '11111111-1111-4111-8111-111111111111', 'HTTP(HyperText Transfer Protocol)', '## 정의

HTTP(HyperText Transfer Protocol)는 **웹 브라우저(클라이언트)와 웹 서버가 데이터를 주고받기 위한 애플리케이션 계층(Application Layer) 프로토콜**이다.

웹 페이지, 이미지, JSON 데이터, 파일 등 다양한 리소스를 요청(Request)하고 응답(Response)하는 규칙을 정의한다.

---

# HTTP의 위치

HTTP는 OSI 7계층의 **응용 계층(Application Layer)** 에 속한다.

```
```

```
응용 계층 (HTTP, HTTPS)
        │
전송 계층 (TCP)
        │
인터넷 계층 (IP)
        │
네트워크 인터페이스 계층
```

일반적으로

```
```

```
HTTP
   ↓
TCP
   ↓
IP
```

순으로 동작한다.

> 참고로 **HTTP/3는 TCP가 아닌 UDP 위의 QUIC 프로토콜을 사용**한다.

---

# HTTP의 특징

## 1. 클라이언트-서버(Client-Server) 구조

HTTP는

- \
  요청(Request)은 클라이언트가 보내고
- \
  응답(Response)은 서버가 보낸다.

```
```

```
Client

HTTP Request

↓

Server

HTTP Response
```

---

## 2. 무상태(Stateless)

HTTP는 기본적으로 **상태를 저장하지 않는다.**

즉

```
```

```
로그인 요청

↓

응답

↓

다음 요청
```

이전 요청을 기억하지 않는다.

따라서 로그인 정보를 유지하려면

- \
  Cookie
- \
  Session
- \
  JWT

등을 사용해야 한다.

---

## 3. 비연결성(Connectionless)

HTTP/1.0에서는 요청과 응답이 끝나면 연결을 종료했다.

```
```

```
요청

↓

응답

↓

연결 종료
```

HTTP/1.1부터는 기본적으로 **Keep-Alive(지속 연결)** 를 사용하여 여러 요청을 하나의 TCP 연결에서 처리한다.

---

# HTTP 메시지 구조

HTTP는

- \
  Request
- \
  Response

두 가지 메시지를 사용한다.

---

# HTTP Request

예시

```
```

```
GET /users HTTP/1.1
Host: example.com
User-Agent: Chrome
Accept: application/json

(Body)
```

구성

- \
  Start Line
- \
  Header
- \
  Body

---

## Start Line

```
```

```
GET /users HTTP/1.1
```

구성

- \
  Method
- \
  URL
- \
  Version

---

## Header

예)

```
```

```
Host: example.com
Authorization: Bearer xxx
Content-Type: application/json
```

Header에는

- \
  인증
- \
  캐시
- \
  압축
- \
  데이터 타입

등이 들어간다.

---

## Body

POST

```
```

```
{
  "name":"Kim",
  "age":20
}
```

GET 요청은 일반적으로 Body를 사용하지 않는다.

---

# HTTP Response

예시

```
```

```
HTTP/1.1 200 OK

Content-Type: application/json

{
    "id":1
}
```

구성

- \
  Status Line
- \
  Header
- \
  Body

---

# HTTP Method

## GET

조회

```
```

```
GET /users
```

특징

- \
  데이터 조회
- \
  Body 거의 사용하지 않음
- \
  멱등성(Idempotent) 보장
- \
  안전(Safe)한 메서드

---

## POST

생성

```
```

```
POST /users
```

Body

```
```

```
{
    "name":"Kim"
}
```

---

## PUT

전체 수정

```
```

```
PUT /users/1
```

기존 데이터를 전체 교체하는 의미를 가진다.

---

## PATCH

부분 수정

```
```

```
PATCH /users/1
```

일부 필드만 수정한다.

---

## DELETE

삭제

```
```

```
DELETE /users/1
```

---

# HTTP 상태 코드(Status Code)

## 1xx

정보 전달

```
```

```
100 Continue
```

---

## 2xx

성공

| 코드 | 의미 |
| --- | --- |
| 200 | 성공 |
| 201 | 생성 성공 |
| 204 | 응답 Body 없음 |

---

## 3xx

리다이렉트

| 코드 | 의미 |
| --- | --- |
| 301 | 영구 이동 |
| 302 | 임시 이동 |
| 304 | 캐시 사용(Not Modified) |

---

## 4xx

클라이언트 오류

| 코드 | 의미 |
| --- | --- |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 |

> **401 Unauthorized**는 이름과 달리 **인증(Authentication) 실패**를 의미하며, **403 Forbidden**은 인증은 되었지만 **권한(Authorization)이 없는 경우**를 의미한다.

---

## 5xx

서버 오류

| 코드 | 의미 |
| --- | --- |
| 500 | 서버 오류 |
| 502 | Bad Gateway |
| 503 | 서비스 불가 |
| 504 | Gateway Timeout |

---

# HTTP의 주요 헤더

## Content-Type

데이터 타입

```
```

```
Content-Type: application/json
```

---

## Authorization

인증 정보

```
```

```
Authorization: Bearer token
```

---

## Cookie

브라우저가 저장한 정보

```
```

```
Cookie: session=abc123
```

---

## Set-Cookie

서버가 쿠키 저장 요청

```
```

```
Set-Cookie: session=abc123
```

---

## Cache-Control

캐시 정책

```
```

```
Cache-Control: max-age=3600
```

---

# HTTP 버전

## HTTP/1.0

- \
  요청마다 새로운 TCP 연결
- \
  비효율적

---

## HTTP/1.1

- \
  Keep-Alive 기본 사용
- \
  지속 연결
- \
  파이프라이닝 지원(실제 활용은 제한적)

---

## HTTP/2

주요 특징

- \
  하나의 연결에서 여러 요청 처리(Multiplexing)
- \
  헤더 압축(HPACK)
- \
  성능 향상

```
```

```
TCP 하나

├── 요청1
├── 요청2
├── 요청3
└── 요청4
```

---

## HTTP/3

주요 특징

- \
  QUIC 사용
- \
  UDP 기반
- \
  연결 설정 시간 감소
- \
  패킷 손실의 영향 감소

---

# HTTP와 HTTPS

HTTP

```
```

```
Client

↓

평문 전송

↓

Server
```

HTTPS

```
```

```
Client

↓

TLS 암호화

↓

Server
```

HTTPS는

```
```

```
HTTP

+

TLS

+

TCP
```

(HTTP/1.1, HTTP/2 기준)

또는

```
```

```
HTTP

+

QUIC(TLS 포함)

+

UDP
```

(HTTP/3 기준)

으로 동작한다.

---

# HTTP 요청 과정

```
```

```
1. 브라우저 URL 입력

↓

2. DNS 조회

↓

3. TCP(또는 QUIC) 연결

↓

4. HTTPS라면 TLS 연결(HTTP/3에서는 QUIC에 포함)

↓

5. HTTP Request

↓

6. Server 처리

↓

7. HTTP Response

↓

8. 브라우저 렌더링
```

---

# 멱등성(Idempotent)

같은 요청을 여러 번 보내도 **최종 결과가 동일한 성질**을 의미한다.

| Method | 멱등성 |
| --- | --- |
| GET | O |
| PUT | O |
| DELETE | O |
| POST | X |
| PATCH | 일반적으로 X(구현에 따라 달라질 수 있음) |

예)

```
```

```
DELETE /users/1
```

10번 요청해도

최종 결과는

```
```

```
삭제됨
```

으로 동일하다.

---

# 안전(Safe) 메서드

**리소스의 상태를 변경하지 않는 메서드**를 의미한다.

대표적으로

- \
  GET
- \
  HEAD
- \
  OPTIONS

가 안전한 메서드이다.

안전한 메서드는 모두 멱등성이 있지만, **멱등하다고 해서 반드시 안전한 것은 아니다.** 예를 들어 DELETE는 멱등하지만 리소스를 삭제하므로 안전한 메서드는 아니다.

---

# 면접 핵심 질문

### Q1. HTTP의 가장 큰 특징은?

- **클라이언트-서버 구조**
- **무상태(Stateless)**
- **(기본적으로) 요청/응답 기반 프로토콜**

---

### Q2. HTTP는 왜 Stateless인가?

서버가 이전 요청의 상태를 기본적으로 저장하지 않기 때문이다. 따라서 로그인 유지 등은 Cookie, Session, JWT와 같은 별도의 메커니즘을 사용한다.

---

### Q3. GET과 POST의 차이는?

- \
  GET은 **조회**를 위한 메서드이며 안전하고 멱등성을 가진다.
- \
  POST는 **리소스 생성이나 처리 요청**에 주로 사용되며 일반적으로 멱등성을 보장하지 않는다.

---

### Q4. PUT과 PATCH의 차이는?

- \
  PUT은 리소스를 **전체 교체**한다.
- \
  PATCH는 리소스의 **일부만 수정**한다.

---

### Q5. HTTP와 HTTPS의 차이는?

- \
  HTTP는 데이터를 평문으로 전송한다.
- \
  HTTPS는 TLS를 사용하여 데이터를 암호화하고, 기밀성·무결성·서버 인증을 제공한다.

---

# 기억하면 좋은 핵심

> **HTTP는 웹에서 데이터를 요청하고 응답하기 위한 애플리케이션 계층 프로토콜이며, 기본적으로 Stateless한 요청/응답 방식으로 동작한다.**

---

# 한 줄 요약

- **HTTP**는 웹 브라우저와 서버가 데이터를 주고받기 위한 **애플리케이션 계층의 요청/응답 프로토콜**이다.
- **HTTPS**는 HTTP에 **TLS 암호화**를 적용하여 안전한 통신을 제공하며, **HTTP/3는 QUIC(UDP 기반)** 위에서 동작한다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:18:38.427205+00', '2026-08-06 08:18:38.427205+00', NULL),
	('02f33add-eb3a-406d-ac67-110d0b9507cf', '11111111-1111-4111-8111-111111111111', 'HTTPS(HyperText Transfer Protocol Secure)', '## 정의

HTTPS(HyperText Transfer Protocol Secure)는 **HTTP에 TLS(Transport Layer Security)를 적용하여 데이터를 암호화한 보안 프로토콜**이다.

HTTP는 데이터를 평문으로 전송하지만, HTTPS는 전송되는 데이터를 암호화하여 안전하게 통신한다.

---

# HTTPS의 위치

HTTPS는 애플리케이션 계층에서 HTTP를 사용하지만, 전송 전에 TLS를 통해 데이터를 보호한다.

```
```

```
응용 계층
   HTTPS
     │
TLS (암호화)
     │
TCP (HTTP/1.1, HTTP/2)
또는
QUIC (HTTP/3)
     │
IP
```

즉,

- \
  HTTP/1.1, HTTP/2 → **HTTP + TLS + TCP**
- \
  HTTP/3 → **HTTP + QUIC(TLS 포함) + UDP**

---

# 왜 HTTPS가 필요한가?

HTTP는 평문(Plain Text)으로 데이터를 전송한다.

예를 들어

```
```

```
POST /login

id=admin
password=1234
```

중간에서 패킷을 가로채면 그대로 읽을 수 있다.

HTTPS는 이를 암호화하여 중간에서 패킷을 보더라도 내용을 해독할 수 없게 만든다.

---

# HTTPS가 제공하는 보안

HTTPS는 TLS를 통해 다음 세 가지를 제공한다.

## 1. 기밀성(Confidentiality)

전송되는 데이터를 암호화하여 제3자가 내용을 볼 수 없다.

예)

```
```

```
HTTP

password=1234
```

↓

HTTPS

```
```

```
A8D91F73...
```

---

## 2. 무결성(Integrity)

데이터가 전송 중 변경되지 않았음을 보장한다.

만약 공격자가

```
```

```
10000원
```

을

```
```

```
100000원
```

으로 바꾸려고 하면

무결성 검증이 실패하여 통신이 거부된다.

---

## 3. 인증(Authentication)

접속한 서버가 진짜 서버인지 확인한다.

예를 들어

```
```

```
https://www.google.com
```

에 접속했을 때

브라우저는 인증서를 확인하여 실제 Google 서버인지 검증한다.

---

# SSL과 TLS

많은 사람들이 HTTPS = SSL이라고 말하지만,

현재는 **TLS**를 사용한다.

| 구분 | 설명 |
| --- | --- |
| SSL | 과거 보안 프로토콜(현재 사용하지 않음) |
| TLS | SSL의 후속 버전으로 현재 표준 |

즉,

HTTPS는 현재 **TLS 기반**으로 동작한다.

---

# HTTPS 연결 과정

HTTPS 통신은 크게 두 단계로 나뉜다.

1. \
   TLS Handshake
2. \
   HTTP 데이터 전송

---

## 1단계 : TCP 연결

먼저 TCP 연결을 수행한다.

```
```

```
Client

↓

SYN

↓

Server

↓

SYN + ACK

↓

ACK
```

HTTP/3에서는 TCP 대신 QUIC 연결을 사용한다.

---

## 2단계 : TLS Handshake

TLS Handshake를 통해

- \
  암호화 방식 결정
- \
  인증서 검증
- \
  세션 키 생성

을 수행한다.

간단한 흐름

```
```

```
Client

↓

지원 가능한 TLS 버전 전송
(ClientHello)

↓

Server

↓

인증서 전달
(ServerHello + Certificate)

↓

인증서 검증

↓

세션 키 생성

↓

암호화 통신 시작
```

---

# 대칭키와 공개키

HTTPS는 **공개키 암호화와 대칭키 암호화를 함께 사용**한다.

## 공개키 암호화

장점

- \
  안전하다.

단점

- \
  매우 느리다.

---

## 대칭키 암호화

장점

- \
  매우 빠르다.

단점

- \
  키를 안전하게 전달하기 어렵다.

---

## HTTPS의 방식

HTTPS는 두 방식을 조합한다.

1. \
   공개키 암호화로 안전하게 세션 키를 공유한다.
2. \
   이후 실제 데이터는 대칭키로 암호화한다.

```
```

```
공개키

↓

세션 키 생성

↓

대칭키 암호화

↓

HTTP 데이터 전송
```

이렇게 하면 보안성과 성능을 모두 확보할 수 있다.

> 최신 TLS(1.3)에서는 주로 **(EC)DHE**와 같은 키 교환 알고리즘을 사용하여 양쪽이 동일한 세션 키를 안전하게 생성한다. 이후 이 세션 키로 대칭키 암호화를 수행한다.

---

# 인증서(Certificate)

인증서는

**"이 서버가 실제 해당 도메인의 소유자임을 증명하는 전자 문서**"이다.

대표 내용

- \
  도메인
- \
  공개키
- \
  발급 기관
- \
  유효기간
- \
  전자서명

---

# CA(Certificate Authority)

CA는 인증서를 발급하는 신뢰 기관이다.

예)

- \
  DigiCert
- \
  GlobalSign
- \
  Let''s Encrypt

브라우저는 신뢰하는 CA 목록을 가지고 있으며,

인증서가 해당 CA의 서명으로 검증되면 서버를 신뢰한다.

---

# HTTPS 요청 과정

```
```

```
1. URL 입력

↓

2. DNS 조회

↓

3. TCP 연결
(HTTP/3는 QUIC)

↓

4. TLS Handshake

↓

5. 인증서 검증

↓

6. 세션 키 생성

↓

7. HTTP Request 암호화

↓

8. Server 처리

↓

9. HTTP Response 암호화

↓

10. 브라우저 렌더링
```

---

# HTTP vs HTTPS

| 구분 | HTTP | HTTPS |
| --- | --- | --- |
| 암호화 | 없음 | TLS 사용 |
| 데이터 | 평문 | 암호화 |
| 포트 | 80 | 443 |
| 인증서 | 없음 | 필요 |
| 서버 인증 | 없음 | 가능 |
| 보안 | 낮음 | 높음 |

---

# HTTPS의 장점

## 1. 데이터 보호

패킷을 가로채도 내용을 읽을 수 없다.

---

## 2. 서버 인증

가짜 서버 접속을 방지한다.

---

## 3. 데이터 위변조 방지

전송 중 데이터 변경을 탐지한다.

---

## 4. SEO

검색 엔진은 HTTPS 사이트를 더 우선적으로 평가하는 경향이 있다.

---

## 5. 브라우저 신뢰

최신 브라우저는 HTTP 사이트에 "안전하지 않음(Not Secure)" 경고를 표시할 수 있다.

---

# HTTPS의 단점

- \
  TLS Handshake가 필요하여 초기 연결 비용이 발생한다.
- \
  인증서 발급 및 관리가 필요하다.

다만 TLS 1.3, 세션 재개(Session Resumption), HTTP/2, HTTP/3 등의 기술로 초기 연결 비용은 과거보다 크게 줄어들었다.

---

# HTTP와 HTTPS 예시

HTTP

```
```

```
사용자

↓

아이디/비밀번호

↓

인터넷

↓

서버
```

중간에서 모두 볼 수 있다.

---

HTTPS

```
```

```
사용자

↓

암호화

↓

인터넷

↓

암호화

↓

서버
```

중간에서 패킷을 보더라도 내용을 확인할 수 없다.

---

# 면접 핵심 질문

### Q1. HTTPS는 무엇인가?

HTTP에 TLS를 적용하여 **데이터를 암호화하고 서버를 인증하는 보안 프로토콜**이다.

---

### Q2. HTTPS는 왜 공개키와 대칭키를 함께 사용하는가?

- \
  공개키 암호화는 안전하지만 느리다.
- \
  대칭키 암호화는 빠르지만 키를 안전하게 전달하기 어렵다.
- \
  HTTPS는 공개키 기반의 키 교환으로 세션 키를 안전하게 생성한 뒤, 실제 데이터는 대칭키로 암호화하여 두 방식의 장점을 모두 활용한다.

---

### Q3. HTTPS가 제공하는 보안 요소는?

- \
  기밀성(Confidentiality)
- \
  무결성(Integrity)
- \
  인증(Authentication)

---

### Q4. 인증서의 역할은?

서버의 신원을 증명하고, 서버의 공개키를 안전하게 전달하여 클라이언트가 신뢰할 수 있는 서버와 통신하도록 돕는다.

---

### Q5. HTTP와 HTTPS의 가장 큰 차이는?

HTTP는 평문으로 데이터를 전송하지만,

HTTPS는 TLS를 사용하여 데이터를 암호화하고 서버를 인증한다.

---

# 기억하면 좋은 핵심

> **HTTPS는 HTTP에 TLS를 적용하여 데이터를 암호화하고, 서버를 인증하며, 전송 중 데이터의 무결성을 보장하는 안전한 통신 방식이다.**

---

# 한 줄 요약

- **HTTPS**는 **HTTP + TLS**(HTTP/3에서는 QUIC에 TLS 기능 포함)로 구성된 보안 프로토콜로, **기밀성·무결성·인증**을 제공하여 안전한 웹 통신을 가능하게 한다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:18:59.068898+00', '2026-08-06 08:18:59.068898+00', NULL),
	('6aaa8e0f-9b3e-4bbe-822f-3c9380dc622c', '11111111-1111-4111-8111-111111111111', 'REST API', '## 정의

REST API(Representational State Transfer API)는 **REST 아키텍처 스타일을 기반으로 설계된 웹 API**이다.

HTTP의 특징을 활용하여 **리소스(Resource)를 URI로 표현하고, HTTP Method를 통해 해당 리소스에 대한 행위를 수행**한다.

예를 들어 사용자 정보를 관리하는 경우

```
```

```
/users
```

는 사용자라는 **리소스(Resource)** 를 의미하며,

```
```

```
GET /users
```

는 사용자 조회,

```
```

```
POST /users
```

는 사용자 생성이라는 의미를 가진다.

---

# REST란?

REST(Representational State Transfer)는 **2000년 Roy Fielding의 박사학위 논문에서 제안된 웹 아키텍처 스타일**이다.

REST는 특정 기술이나 프로토콜이 아니라 **웹 시스템을 설계하기 위한 원칙(Architectural Style)** 이다.

REST API는 이러한 원칙을 최대한 따르도록 설계된 API를 의미한다.

---

# REST의 구성 요소

REST는 크게 세 가지 요소로 구성된다.

- \
  Resource(리소스)
- \
  Method(행위)
- \
  Representation(표현)

---

## 1. Resource (리소스)

리소스는 서버가 관리하는 대상이다.

예를 들어

```
```

```
사용자
게시글
댓글
상품
```

등이 모두 리소스이다.

REST에서는 URI로 표현한다.

예)

```
```

```
/users
/posts
/products
/comments
```

---

## 2. Method (행위)

HTTP Method를 이용하여 리소스에 대한 작업을 수행한다.

| Method | 의미 |
| --- | --- |
| GET | 조회 |
| POST | 생성 |
| PUT | 전체 수정 |
| PATCH | 부분 수정 |
| DELETE | 삭제 |

예)

```
```

```
GET /users
```

↓

사용자 목록 조회

```
```

```
POST /users
```

↓

사용자 생성

---

## 3. Representation (표현)

리소스는 JSON, XML 등의 형태로 표현된다.

현재는 대부분 JSON을 사용한다.

예)

```
```

```
{
  "id": 1,
  "name": "Kim"
}
```

---

# REST API 예시

사용자 API

| 기능 | Method | URI |
| --- | --- | --- |
| 사용자 목록 | GET | /users |
| 사용자 조회 | GET | /users/1 |
| 사용자 생성 | POST | /users |
| 사용자 수정 | PUT | /users/1 |
| 사용자 일부 수정 | PATCH | /users/1 |
| 사용자 삭제 | DELETE | /users/1 |

---

# URI 설계 원칙

## 1. 명사를 사용한다.

좋은 예

```
```

```
/users
/products
/orders
```

나쁜 예

```
```

```
/getUsers
/createUser
/deleteUser
```

행위는 HTTP Method가 담당하므로 URI에는 리소스를 표현하는 명사를 사용하는 것이 원칙이다.

---

## 2. 복수형 사용

일반적으로

```
```

```
/users
/posts
```

처럼 복수형을 사용한다.

---

## 3. 계층 구조 표현

예)

```
```

```
/users/1/orders
```

의미

```
```

```
1번 사용자의 주문
```

---

# HTTP Method와 REST

## 조회

```
```

```
GET /users
```

응답

```
```

```
[
  {
    "id": 1,
    "name": "Kim"
  }
]
```

---

## 생성

```
```

```
POST /users
```

Body

```
```

```
{
  "name": "Kim"
}
```

응답

```
```

```
201 Created
```

---

## 수정

```
```

```
PUT /users/1
```

또는

```
```

```
PATCH /users/1
```

---

## 삭제

```
```

```
DELETE /users/1
```

응답

```
```

```
204 No Content
```

---

# HTTP 상태 코드 활용

REST API에서는 HTTP 상태 코드를 적극 활용한다.

| 코드 | 의미 |
| --- | --- |
| 200 | 조회 성공 |
| 201 | 생성 성공 |
| 204 | 삭제 성공(응답 Body 없음) |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 |
| 500 | 서버 오류 |

---

# REST의 제약 조건

REST 아키텍처는 다음과 같은 제약 조건을 가진다.

## 1. Client-Server

클라이언트와 서버를 분리한다.

```
```

```
Client

↓

HTTP

↓

Server
```

---

## 2. Stateless

서버는 요청 간 상태를 저장하지 않는다.

각 요청에는 필요한 정보(예: 인증 토큰)가 포함되어야 한다.

예)

```
```

```
Authorization: Bearer access_token
```

---

## 3. Cacheable

응답은 캐시 가능해야 한다.

예)

```
```

```
Cache-Control: max-age=3600
```

---

## 4. Uniform Interface

일관된 인터페이스를 제공해야 한다.

즉

```
```

```
GET
POST
PUT
DELETE
```

등을 일관성 있게 사용한다.

---

## 5. Layered System

중간에

- \
  Proxy
- \
  Gateway
- \
  Load Balancer

등이 존재해도 클라이언트는 알 필요가 없다.

---

## 6. Code On Demand (선택 사항)

필요하면 서버가 실행 가능한 코드를 전달할 수 있다.

예를 들어 JavaScript를 내려주는 방식이 해당된다.

다만 현대 REST API에서는 거의 사용되지 않으며 **선택적인 제약 조건**이다.

---

# RESTful API란?

REST의 원칙을 잘 지킨 API를 **RESTful API**라고 한다.

예)

```
```

```
GET /users
POST /users
DELETE /users/1
```

RESTful하다.

반면

```
```

```
GET /getUsers
POST /createUser
POST /deleteUser
```

처럼 URI에 동사를 사용하거나 HTTP Method를 적절히 활용하지 않는 설계는 RESTful하지 않다.

---

# REST API의 장점

## 1. 이해하기 쉽다.

URI만 봐도 의미를 파악하기 쉽다.

---

## 2. HTTP를 그대로 활용한다.

추가 프로토콜이 필요 없다.

---

## 3. 확장성이 좋다.

웹, 모바일 등 다양한 클라이언트에서 동일한 API를 사용할 수 있다.

---

## 4. 유지보수가 쉽다.

규칙이 일정하여 협업하기 좋다.

---

# REST API의 단점

- \
  복잡한 조회 조건을 표현하기 어려울 수 있다.
- \
  여러 리소스를 한 번에 조회할 때 비효율이 발생할 수 있다.
- \
  오버페칭(Over-fetching) 또는 언더페칭(Under-fetching)이 발생할 수 있다.

예를 들어 사용자 이름만 필요해도 전체 사용자 객체를 받아야 하는 경우가 있을 수 있다.

---

# REST API 예시

회원 가입

```
```

```
POST /users
Content-Type: application/json

{
  "name": "Kim",
  "email": "kim@example.com"
}
```

응답

```
```

```
HTTP/1.1 201 Created

{
  "id": 1,
  "name": "Kim",
  "email": "kim@example.com"
}
```

---

회원 조회

```
```

```
GET /users/1
```

응답

```
```

```
{
  "id": 1,
  "name": "Kim"
}
```

---

회원 삭제

```
```

```
DELETE /users/1
```

응답

```
```

```
204 No Content
```

---

# REST API와 GraphQL 비교

| 구분 | REST API | GraphQL |
| --- | --- | --- |
| 엔드포인트 | 여러 개 (`/users`, `/posts`) | 보통 하나 (`/graphql`) |
| 데이터 조회 | 서버가 정한 형태 | 클라이언트가 필요한 필드 선택 |
| 오버페칭 | 발생 가능 | 적음 |
| 언더페칭 | 발생 가능 | 적음 |
| HTTP Method | GET, POST, PUT, DELETE 등 활용 | 주로 POST(조회에 GET을 지원하기도 함) |

---

# 면접 핵심 질문

### Q1. REST API란?

REST 아키텍처 스타일을 기반으로 **리소스를 URI로 표현하고 HTTP Method를 통해 조작하는 웹 API**이다.

---

### Q2. REST에서 URI와 HTTP Method의 역할은?

- **URI**는 **리소스(Resource)** 를 식별한다.
- **HTTP Method**는 해당 리소스에 수행할 **행위(Action)** 를 나타낸다.

---

### Q3. REST의 가장 중요한 특징은?

- \
  Stateless
- \
  Client-Server 구조
- \
  Uniform Interface
- \
  HTTP 표준 적극 활용

---

### Q4. RESTful API란?

REST의 설계 원칙을 잘 준수하여 일관성 있게 구현한 API를 의미한다.

---

### Q5. PUT과 PATCH의 차이는?

- **PUT**은 리소스를 **전체 교체**하는 의미를 가진다.
- **PATCH**는 리소스의 **일부만 수정**한다.

---

# 기억하면 좋은 핵심

> **REST API는 "리소스는 URI로 표현하고, 행위는 HTTP Method로 표현한다"는 원칙을 기반으로 설계된 웹 API이다.**

예를 들어,

- `GET /users/1` → 사용자 조회
- `PATCH /users/1` → 사용자 일부 수정
- `DELETE /users/1` → 사용자 삭제

처럼 **URI는 ''무엇(Resource)''을, HTTP Method는 ''무엇을 할 것인가(Action)''를 표현**한다.

---

# 한 줄 요약

- **REST API**는 **리소스를 URI로 식별하고, HTTP Method(GET, POST, PUT, PATCH, DELETE)를 사용해 해당 리소스를 조작하는 웹 API 설계 방식**이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:19:18.105094+00', '2026-08-06 08:19:18.105094+00', NULL),
	('cf489b2b-f5cd-4788-99d3-05fa43f31625', '11111111-1111-4111-8111-111111111111', 'GraphQL', '## 정의

GraphQL은 **클라이언트가 필요한 데이터의 구조를 직접 지정하여 요청할 수 있는 API 쿼리 언어이자 실행 환경**이다.

기존 REST API처럼 여러 엔드포인트를 사용하는 대신, **하나의 엔드포인트에서 원하는 데이터만 요청**할 수 있다.

예를 들어 사용자의 이름과 이메일만 필요하다면

```
```

```
query {
  user(id: 1) {
    name
    email
  }
}
```

처럼 필요한 필드만 요청할 수 있다.

---

# GraphQL이 등장한 이유

REST API에서는 다음과 같은 문제가 발생할 수 있다.

## Over-fetching (과도한 조회)

필요한 데이터보다 더 많은 데이터를 받는 경우

예)

```
```

```
GET /users/1
```

응답

```
```

```
{
  "id": 1,
  "name": "Kim",
  "email": "kim@example.com",
  "phone": "010-1234-5678",
  "address": "...",
  "birth": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

하지만

```
```

```
이름만 필요
```

한 경우에도 전체 데이터를 받아야 한다.

---

## Under-fetching (부족한 조회)

한 번의 요청으로 필요한 데이터를 모두 가져오지 못하는 경우

예)

```
```

```
사용자

↓

GET /users/1

↓

게시글

↓

GET /users/1/posts

↓

댓글

↓

GET /posts/10/comments
```

여러 번 요청해야 한다.

---

GraphQL은 이러한 문제를 해결하기 위해 등장하였다.

---

# GraphQL의 특징

- \
  하나의 엔드포인트 사용
- \
  필요한 데이터만 조회
- \
  강력한 타입 시스템
- \
  클라이언트 중심 데이터 조회
- \
  Self-Documentation(스키마 기반 문서화)

---

# GraphQL 구조

GraphQL은 크게 세 가지 작업(Operation)를 제공한다.

- \
  Query
- \
  Mutation
- \
  Subscription

---

# Query

데이터를 조회한다.

예)

```
```

```
query {
  user(id: 1) {
    id
    name
    email
  }
}
```

응답

```
```

```
{
  "data": {
    "user": {
      "id": 1,
      "name": "Kim",
      "email": "kim@example.com"
    }
  }
}
```

필요한 필드만 반환된다.

---

# Mutation

데이터를 생성하거나 수정, 삭제한다.

예)

```
```

```
mutation {
  createUser(name: "Kim") {
    id
    name
  }
}
```

응답

```
```

```
{
  "data": {
    "createUser": {
      "id": 1,
      "name": "Kim"
    }
  }
}
```

---

# Subscription

실시간 데이터를 구독한다.

예)

```
```

```
subscription {
  newMessage {
    id
    text
  }
}
```

새로운 메시지가 생성될 때마다 실시간으로 데이터를 전달받는다.

보통 WebSocket을 사용한다.

---

# 하나의 엔드포인트

REST

```
```

```
/users
/posts
/comments
/orders
```

GraphQL

```
```

```
/graphql
```

하나의 엔드포인트만 사용한다.

---

# 필요한 데이터만 요청

예를 들어

사용자

```
```

```
{
  user(id:1){
    name
  }
}
```

응답

```
```

```
{
  "data": {
    "user": {
      "name": "Kim"
    }
  }
}
```

이메일이나 주소는 전송되지 않는다.

---

# 중첩 조회

GraphQL의 가장 큰 장점 중 하나이다.

예)

```
```

```
query {
  user(id: 1) {
    name

    posts {
      title

      comments {
        text
      }
    }
  }
}
```

한 번의 요청으로

- \
  사용자
- \
  게시글
- \
  댓글

모두 조회할 수 있다.

---

# Schema

GraphQL은 스키마를 기반으로 동작한다.

예)

```
```

```
type User {
  id: ID!
  name: String!
  email: String!
}
```

스키마에는

- \
  타입
- \
  필드
- \
  반환 타입
- \
  Nullable 여부

등이 정의된다.

---

# Resolver

Resolver는 실제 데이터를 가져오는 함수이다.

예)

```
```

```
const resolvers = {
  Query: {
    user: (_, args) => {
      return findUser(args.id);
    }
  }
}
```

흐름

```
```

```
Query

↓

Resolver

↓

Database

↓

Response
```

---

# GraphQL 요청 과정

```
```

```
Client

↓

POST /graphql

↓

GraphQL Server

↓

Resolver

↓

Database

↓

JSON Response
```

---

# REST와 GraphQL 비교

| 구분 | REST | GraphQL |
| --- | --- | --- |
| 엔드포인트 | 여러 개 | 보통 하나 |
| 데이터 조회 | 서버가 결정 | 클라이언트가 선택 |
| Over-fetching | 발생 가능 | 거의 없음 |
| Under-fetching | 발생 가능 | 거의 없음 |
| 타입 시스템 | 별도 | 내장 |
| 문서화 | Swagger 등 별도 도구 사용 | 스키마 기반 자동 문서화 가능 |

---

# GraphQL의 장점

## 1. 필요한 데이터만 조회

네트워크 사용량을 줄일 수 있다.

---

## 2. 요청 횟수 감소

한 번의 요청으로 여러 데이터를 가져올 수 있다.

---

## 3. 강력한 타입 시스템

컴파일 이전에도 오류를 발견하기 쉽다.

---

## 4. 자동 문서화

스키마만 있으면

- \
  GraphiQL
- \
  Apollo Studio

등에서 API 문서를 자동 생성할 수 있다.

---

## 5. 프론트엔드 개발에 유리

화면에서 필요한 데이터만 요청할 수 있어 서버 API 변경의 영향을 줄일 수 있다.

---

# GraphQL의 단점

## 1. 캐싱이 어렵다.

REST는

```
```

```
GET /users/1
```

처럼 URL 단위 캐싱이 쉽다.

GraphQL은

```
```

```
POST /graphql
```

로 다양한 Query가 들어오기 때문에 HTTP 캐싱이 상대적으로 어렵다.

다만 Apollo Client, Relay와 같은 클라이언트 라이브러리는 **정규화 캐시(Normalized Cache)** 를 제공하여 이 문제를 해결한다.

---

## 2. 복잡한 서버 구현

Resolver를 구현해야 한다.

---

## 3. N+1 문제

잘못 구현하면

```
```

```
사용자 조회

↓

게시글 조회

↓

댓글 조회

↓

반복
```

처럼 DB Query가 매우 많이 발생할 수 있다.

이를 해결하기 위해 **DataLoader** 등을 사용하여 조회를 묶는다(Batching).

---

## 4. 학습 비용

REST보다 개념이 많다.

- \
  Schema
- \
  Resolver
- \
  Query
- \
  Mutation
- \
  Subscription

---

# REST와 GraphQL 선택

REST가 적합한 경우

- \
  단순 CRUD
- \
  캐싱이 중요한 서비스
- \
  공개 API
- \
  서버 중심 설계

GraphQL이 적합한 경우

- \
  모바일 앱
- \
  다양한 화면
- \
  여러 리소스를 동시에 조회
- \
  프론트엔드 중심 서비스

---

# GraphQL 예시

조회

```
```

```
query {
  user(id:1){
    name
    email
  }
}
```

생성

```
```

```
mutation {
  createUser(name:"Kim"){
    id
    name
  }
}
```

실시간

```
```

```
subscription{
  newMessage{
    text
  }
}
```

---

# GraphQL vs REST 예시

REST

```
```

```
GET /users/1
GET /users/1/posts
GET /posts/10/comments
```

3번 요청

---

GraphQL

```
```

```
query {
  user(id:1){
    name

    posts{
      title

      comments{
        text
      }
    }
  }
}
```

1번 요청

---

# 면접 핵심 질문

### Q1. GraphQL이란?

클라이언트가 필요한 데이터의 구조를 직접 지정하여 요청할 수 있는 **API 쿼리 언어이자 실행 환경**이다.

---

### Q2. GraphQL이 REST보다 좋은 점은?

- \
  필요한 데이터만 조회 가능
- \
  여러 리소스를 한 번에 조회 가능
- \
  Over-fetching, Under-fetching 문제를 줄일 수 있다.

---

### Q3. GraphQL의 핵심 구성 요소는?

- \
  Query (조회)
- \
  Mutation (생성·수정·삭제)
- \
  Subscription (실시간)
- \
  Schema
- \
  Resolver

---

### Q4. Resolver란?

GraphQL의 요청을 실제 데이터 소스(DB, 외부 API 등)와 연결하여 데이터를 조회하거나 변경하는 함수이다.

---

### Q5. GraphQL의 대표적인 단점은?

- \
  HTTP 캐싱이 REST보다 어렵다.
- \
  Resolver를 잘못 구현하면 N+1 문제가 발생할 수 있다.
- \
  서버 구현과 학습 비용이 상대적으로 높다.

---

# 기억하면 좋은 핵심

> **REST는 "서버가 정한 데이터"를 제공하고, GraphQL은 "클라이언트가 필요한 데이터"를 요청한다.**

REST

```
```

```
GET /users/1
```

↓

전체 사용자 정보 반환

GraphQL

```
```

```
query {
  user(id:1){
    name
  }
}
```

↓

이름만 반환

---

# 한 줄 요약

- **GraphQL**은 **클라이언트가 필요한 데이터만 선택하여 하나의 엔드포인트를 통해 요청할 수 있는 API 쿼리 언어이자 실행 환경**으로, **Over-fetching과 Under-fetching 문제를 줄이고 효율적인 데이터 조회를 가능하게 한다.**', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:19:34.985227+00', '2026-08-06 08:19:34.985227+00', NULL),
	('c5a378f7-9833-428e-a9e6-4d2258453269', '11111111-1111-4111-8111-111111111111', '캐시(Cache)', '## 정의

캐시(Cache)는 **자주 사용하는 데이터를 빠른 저장소에 임시로 저장하여 데이터 접근 속도를 높이는 기술**이다.

즉, **비용이 큰 작업의 결과를 미리 저장해두고 재사용**하여 성능을 향상시키는 것이 목적이다.

예를 들어 데이터베이스에서 사용자 정보를 조회하는 데 100ms가 걸린다면,

처음에는 DB를 조회하지만 이후에는 캐시에서 바로 가져와 1\~2ms 만에 응답할 수 있다.

---

# 왜 캐시가 필요한가?

컴퓨터 시스템에서는 저장 장치마다 속도 차이가 매우 크다.

```
```

```
CPU Register
      ↓ (가장 빠름)
CPU Cache (L1/L2/L3)
      ↓
RAM
      ↓
SSD
      ↓
HDD
      ↓ (가장 느림)
Network / Database
```

자주 사용하는 데이터를 더 빠른 저장소에 보관하면 전체 성능이 크게 향상된다.

---

# 캐시의 동작 방식

예를 들어 사용자 정보를 조회하는 경우

```
```

```
사용자 요청

↓

캐시 확인(Cache Lookup)

↓

캐시에 있음(Cache Hit)
        ↓
     바로 반환

캐시에 없음(Cache Miss)
        ↓
DB 조회
        ↓
캐시에 저장
        ↓
응답 반환
```

---

# Cache Hit와 Cache Miss

## Cache Hit

캐시에 데이터가 존재하는 경우

```
```

```
요청

↓

캐시 조회

↓

데이터 존재

↓

즉시 반환
```

빠르게 응답할 수 있다.

---

## Cache Miss

캐시에 데이터가 없는 경우

```
```

```
요청

↓

캐시 조회

↓

데이터 없음

↓

DB 조회

↓

캐시 저장

↓

응답
```

처음 한 번은 느리지만 이후부터는 빨라진다.

---

# 캐시의 종류

## 1. CPU Cache

CPU 내부의 매우 빠른 메모리

```
```

```
CPU

├─ L1 Cache
├─ L2 Cache
└─ L3 Cache
```

가장 많이 사용하는 데이터를 저장한다.

---

## 2. 메모리 캐시

애플리케이션 내부 메모리

예)

- \
  Java HashMap
- \
  C++ unordered_map

---

## 3. 웹 브라우저 캐시

브라우저가

- \
  이미지
- \
  CSS
- \
  JavaScript

등을 저장한다.

다음 방문 시 다시 다운로드하지 않는다.

---

## 4. CDN(Cache)

전 세계 서버에 파일을 저장한다.

예)

```
```

```
사용자

↓

가까운 CDN 서버

↓

응답
```

원본 서버까지 가지 않아도 된다.

---

## 5. Redis / Memcached

대표적인 서버 캐시

예)

```
```

```
Client

↓

Server

↓

Redis

↓

Database
```

DB 부하를 크게 줄인다.

---

# 캐시 전략(Cache Strategy)

## 1. Cache Aside (Lazy Loading)

가장 많이 사용하는 전략이다.

동작

```
```

```
요청

↓

캐시 조회

↓

없음

↓

DB 조회

↓

캐시에 저장

↓

응답
```

장점

- \
  필요한 데이터만 캐싱
- \
  구현이 쉽다.

단점

- \
  최초 조회가 느리다.

---

## 2. Read Through

애플리케이션은 캐시만 조회한다.

```
```

```
Application

↓

Cache

↓

DB
```

캐시가 DB를 대신 조회한다.

---

## 3. Write Through

쓰기 시

```
```

```
Application

↓

Cache 저장

↓

DB 저장
```

동시에 저장한다.

장점

- \
  항상 최신 데이터

단점

- \
  쓰기가 느리다.

---

## 4. Write Back (Write Behind)

```
```

```
Application

↓

Cache 저장

↓

나중에 DB 저장
```

장점

- \
  매우 빠르다.

단점

- \
  캐시 장애 시 데이터 유실 위험

---

# 캐시 교체 알고리즘

캐시는 용량이 제한되어 있으므로 오래되거나 덜 사용하는 데이터를 제거해야 한다.

## LRU (Least Recently Used)

가장 오랫동안 사용하지 않은 데이터를 제거한다.

```
```

```
A B C

↓

A 사용

↓

B C D

↓

A D C
```

가장 널리 사용되는 방식이다.

---

## LFU (Least Frequently Used)

가장 적게 사용된 데이터를 제거한다.

예)

```
```

```
A : 10회

B : 2회

C : 1회
```

↓

C 제거

---

## FIFO (First In First Out)

먼저 들어온 데이터를 먼저 제거한다.

---

# 캐시 무효화(Cache Invalidation)

캐시의 가장 어려운 문제는 **데이터를 언제 갱신할 것인가**이다.

예)

```
```

```
DB

Kim

↓

캐시 저장

Kim

↓

DB 수정

Lee

↓

캐시

Kim
```

캐시와 DB가 달라지는 문제가 발생한다.

---

## 해결 방법

### TTL(Time To Live)

일정 시간이 지나면 자동 삭제

```
```

```
TTL = 10분
```

---

### 직접 삭제(Cache Eviction)

데이터 변경 시

```
```

```
DB 수정

↓

캐시 삭제
```

다음 조회 때 다시 캐싱한다.

---

### 버전 관리

버전 번호를 이용하여 새로운 캐시를 생성한다.

---

# 캐시 사용 예시

로그인 사용자 조회

```
```

```
사용자 요청

↓

Redis 조회

↓

있음

↓

응답

↓

없음

↓

DB 조회

↓

Redis 저장

↓

응답
```

---

# 캐시의 장점

## 1. 응답 속도 향상

DB보다 훨씬 빠르다.

---

## 2. 서버 부하 감소

같은 데이터를 반복 조회하지 않는다.

---

## 3. 비용 절감

DB 접근 횟수가 줄어든다.

---

## 4. 확장성 향상

동시 요청을 효율적으로 처리할 수 있다.

---

# 캐시의 단점

## 1. 데이터 불일치

캐시와 원본 데이터가 달라질 수 있다.

---

## 2. 메모리 사용

추가 저장 공간이 필요하다.

---

## 3. 관리 복잡성

무효화 전략을 잘 설계해야 한다.

---

# Redis를 캐시로 사용하는 이유

Redis는

- \
  메모리 기반
- \
  매우 빠른 속도
- \
  TTL 지원
- \
  다양한 자료구조 제공

등의 장점이 있어 캐시 서버로 가장 많이 사용된다.

---

# 캐시와 세션의 차이

| 구분 | 캐시(Cache) | 세션(Session) |
| --- | --- | --- |
| 목적 | 성능 향상 | 사용자 상태 유지 |
| 저장 데이터 | 자주 조회되는 데이터 | 로그인 정보, 사용자 상태 |
| 데이터 손실 | 가능(다시 생성 가능) | 손실되면 사용자 영향 큼 |
| 핵심 가치 | 속도 | 상태 관리 |

Redis는 캐시와 세션 저장소 모두로 사용할 수 있지만 **목적은 다르다**.

---

# 캐시와 버퍼의 차이

| 구분 | 캐시(Cache) | 버퍼(Buffer) |
| --- | --- | --- |
| 목적 | **재사용을 위해 저장** | **속도 차이를 완화하기 위해 임시 저장** |
| 사용 시점 | 동일 데이터를 반복 사용할 때 | 생산자와 소비자의 처리 속도가 다를 때 |
| 예시 | Redis, 브라우저 캐시 | 동영상 스트리밍 버퍼, 키보드 입력 버퍼 |

예를 들어 유튜브에서 영상을 미리 받아두는 것은 **버퍼링(Buffering)** 이고, 한 번 내려받은 이미지 파일을 브라우저가 다시 사용하는 것은 **캐싱(Caching)** 이다.

---

# 면접 핵심 질문

### Q1. 캐시를 사용하는 이유는?

자주 사용하는 데이터를 빠른 저장소에 보관하여 **응답 속도를 높이고 서버 부하를 줄이기 위해서**이다.

---

### Q2. Cache Hit와 Cache Miss의 차이는?

- **Cache Hit**: 캐시에 데이터가 있어 즉시 반환한다.
- **Cache Miss**: 캐시에 데이터가 없어 원본(DB 등)을 조회한 후 캐시에 저장하고 반환한다.

---

### Q3. Cache Aside 전략이란?

애플리케이션이 먼저 캐시를 조회하고, 데이터가 없으면 DB를 조회한 뒤 캐시에 저장하는 가장 일반적인 캐시 전략이다.

---

### Q4. 캐시에서 가장 어려운 문제는?

**캐시 무효화(Cache Invalidation)** 이다.

원본 데이터가 변경되었을 때 언제, 어떻게 캐시를 갱신하거나 삭제할지 설계하는 것이 가장 중요하다.

---

### Q5. Redis를 캐시로 많이 사용하는 이유는?

메모리 기반이라 매우 빠르고, TTL, 다양한 자료구조, 높은 성능을 제공하여 대규모 서비스의 캐시 서버로 적합하기 때문이다.

---

# 기억하면 좋은 핵심

> **캐시는 "같은 계산이나 조회를 다시 하지 않기 위해 결과를 빠른 저장소에 임시 보관하는 기술"이다.**

예를 들어

```
```

```
사용자 조회

↓

Redis 확인

↓

있음

↓

바로 응답
```

DB를 거치지 않으므로 응답 속도가 크게 향상된다.

---

# 한 줄 요약

- **캐시(Cache)** 는 **자주 사용하는 데이터를 빠른 저장소에 임시 저장하여 응답 속도를 높이고 서버 부하를 줄이는 기술**이며, **Cache Hit/Miss, 캐시 전략, 캐시 무효화**가 핵심 개념이다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:19:57.08692+00', '2026-08-06 08:19:57.08692+00', NULL),
	('89e3a3ea-226d-4232-b1b6-951cb65bd0d7', '11111111-1111-4111-8111-111111111111', '운영체제 메모리 구조', '## 정의

운영체제에서 **프로세스(Process)** 가 실행되면 운영체제는 해당 프로세스에 독립적인 가상 메모리 공간을 할당한다.

이 메모리 공간은 일반적으로 다음과 같은 영역으로 구성된다.

```
```

```
높은 주소
+----------------------+
| Stack                |
| ↓                    |
|                      |
|                      |
| ↑                    |
| Heap                 |
+----------------------+
| BSS                  |
+----------------------+
| Data                 |
+----------------------+
| Code(Text)           |
+----------------------+
낮은 주소
```

각 영역은 역할이 다르며, 프로그램의 실행 과정에서 서로 다른 방식으로 사용된다.

---

# 메모리 구조

| 영역 | 저장 내용 | 특징 |
| --- | --- | --- |
| Code(Text) | 실행 코드 | 읽기 전용 |
| Data | 초기화된 전역/정적 변수 | 프로그램 종료까지 유지 |
| BSS | 초기화되지 않은 전역/정적 변수 | 실행 시 0으로 초기화 |
| Heap | 동적 메모리 | 개발자가 관리 |
| Stack | 함수 호출 정보 | 자동 관리 |

---

# 1. Code(Text) 영역

## 정의

실행 가능한 기계어 코드가 저장되는 영역이다.

```
```

```
int add(int a, int b) {
    return a + b;
}
```

컴파일 후 생성된 코드가 이 영역에 저장된다.

---

## 특징

- \
  읽기 전용(Read Only)
- \
  프로그램 실행 중 변경되지 않음
- \
  여러 프로세스에서 공유될 수도 있음(동일 실행 파일)

---

# 2. Data 영역

## 정의

초기화된 전역 변수와 static 변수가 저장된다.

예)

```
```

```
int count = 10;

static int num = 5;
```

둘 다 프로그램 시작 시 메모리에 생성된다.

---

## 특징

- \
  프로그램 시작 시 생성
- \
  프로그램 종료 시 제거
- \
  읽기/쓰기 가능

---

# 3. BSS(Block Started by Symbol) 영역

## 정의

초기화되지 않은 전역 변수와 static 변수가 저장된다.

```
```

```
int count;

static int num;
```

초기값을 지정하지 않았더라도 실행 시 자동으로 **0으로 초기화**된다.

---

## Data와 BSS 차이

```
```

```
int a = 10;
```

↓

Data 영역

```
```

```
int b;
```

↓

BSS 영역

---

## BSS를 따로 두는 이유

초기화되지 않은 변수는 실행 파일에 실제 값을 저장할 필요가 없으므로, 실행 파일 크기를 줄일 수 있다.

---

# 4. Heap 영역

## 정의

실행 중 동적으로 할당되는 메모리 영역이다.

예)

C++

```
```

```
int* arr = new int[100];
```

C

```
```

```
malloc(100);
```

Java

```
```

```
new User();
```

---

## 특징

- \
  실행 중 생성
- \
  개발자(또는 가비지 컬렉터)가 관리
- \
  낮은 주소 → 높은 주소 방향으로 증가

```
```

```
Heap
↑
↑
↑
```

---

## Heap 사용 예시

```
```

```
int* p = new int(100);
```

```
```

```
Stack

p
↓

Heap

100
```

포인터는 Stack에 있고,

실제 데이터는 Heap에 있다.

---

# Heap의 장점

- \
  큰 메모리 사용 가능
- \
  실행 중 크기 결정 가능
- \
  객체 생성에 사용

---

# Heap의 단점

- \
  할당/해제가 느리다.
- \
  메모리 누수(Memory Leak) 가능
- \
  메모리 단편화(Fragmentation)가 발생할 수 있다.

---

# 5. Stack 영역

## 정의

함수 호출 시 생성되는 지역 변수와 함수 정보를 저장하는 영역이다.

예)

```
```

```
void foo() {
    int x = 10;
}
```

Stack에는

- \
  지역 변수
- \
  매개변수
- \
  반환 주소
- \
  저장된 레지스터 값

등이 저장된다.

---

## 특징

- \
  함수 호출 시 생성
- \
  함수 종료 시 자동 제거
- \
  높은 주소 → 낮은 주소 방향으로 증가

```
```

```
Stack

↓

↓

↓
```

---

## Stack 예시

```
```

```
void foo() {
    int a = 10;
}
```

```
```

```
int main() {
    foo();
}
```

실행

```
```

```
main Stack

↓

foo Stack

↓

foo 종료

↓

foo Stack 제거
```

---

# Stack과 Heap의 성장 방향

```
```

```
높은 주소

Stack
↓↓↓

----------------

↑↑↑
Heap

낮은 주소
```

Stack은 아래 방향,

Heap은 위 방향으로 성장한다.

만약 둘이 만나면

```
```

```
Stack Overflow
```

또는

```
```

```
Out Of Memory
```

가 발생할 수 있다.

---

# Stack Overflow

재귀 함수가 너무 깊어지면

```
```

```
void foo() {
    foo();
}
```

Stack이 계속 증가한다.

↓

메모리 부족

↓

Stack Overflow

---

# Memory Leak

Heap에 할당만 하고

해제하지 않는 경우

```
```

```
int* p = new int;
```

```
```

```
// delete 없음
```

메모리가 계속 남는다.

↓

Memory Leak

C++에서는

```
```

```
delete p;
```

Java는

Garbage Collector가 관리한다.

---

# 메모리 영역별 생명주기

| 영역 | 생성 시점 | 제거 시점 |
| --- | --- | --- |
| Code | 프로그램 시작 | 프로그램 종료 |
| Data | 프로그램 시작 | 프로그램 종료 |
| BSS | 프로그램 시작 | 프로그램 종료 |
| Heap | 동적 할당 시 | 해제 시 |
| Stack | 함수 호출 시 | 함수 종료 시 |

---

# 운영체제와 가상 메모리

위에서 설명한 **Code, Data, BSS, Heap, Stack**은 **각 프로세스의 가상 주소 공간(Virtual Address Space)** 의 구조이다.

실제로는 운영체제가 **가상 주소(Virtual Address)** 를 **물리 주소(Physical Address)** 로 변환하여 관리한다.

```
```

```
프로세스

가상 주소
0x1000
0x2000
0x3000

        │

MMU + 페이지 테이블

        │

물리 메모리(RAM)

Frame 10
Frame 25
Frame 3
```

이 덕분에

- \
  각 프로세스는 독립적인 메모리 공간을 가진 것처럼 동작하고,
- \
  실제 물리 메모리의 위치를 직접 알 필요가 없다.

---

# 메모리 구조 예시

```
```

```
#include <iostream>

int globalVar = 100;      // Data
int globalBss;            // BSS

int main() {
    int local = 10;       // Stack

    int* p = new int(20); // Heap

    return 0;
}
```

| 변수 | 메모리 영역 |
| --- | --- |
| globalVar | Data |
| globalBss | BSS |
| local | Stack |
| `new int(20)` | Heap |
| main 함수 | Code(Text) |

---

# 면접 핵심 질문

### Q1. 프로세스의 메모리 구조는?

- \
  Code(Text)
- \
  Data
- \
  BSS
- \
  Heap
- \
  Stack

---

### Q2. Data와 BSS의 차이는?

- **Data**: 초기화된 전역 변수와 static 변수
- **BSS**: 초기화되지 않은 전역 변수와 static 변수(실행 시 0으로 초기화)

---

### Q3. Heap과 Stack의 차이는?

| Stack | Heap |
| --- | --- |
| 자동 관리 | 수동 관리(C/C++) 또는 GC(Java 등) |
| 함수 호출 시 생성 | 동적 할당 시 생성 |
| 빠름 | 상대적으로 느림 |
| 크기가 작음 | 상대적으로 큼 |

---

### Q4. Stack Overflow는 왜 발생하는가?

함수 호출이 너무 깊어져(Stack Frame이 계속 쌓여) Stack 영역의 한계를 초과하기 때문이다. 대표적인 예가 종료 조건이 없는 재귀 호출이다.

---

### Q5. Memory Leak이란?

Heap에 할당한 메모리를 더 이상 사용하지 않는데도 해제하지 않아, 사용 가능한 메모리가 점점 줄어드는 현상이다.

---

# 기억하면 좋은 핵심

> **프로세스의 메모리는 역할에 따라 Code, Data, BSS, Heap, Stack으로 나뉘며, Stack은 함수 실행을, Heap은 동적 메모리를 관리한다.**

```
```

```
낮은 주소

Code
↓

Data

↓

BSS

↓

Heap
↑

↓

Stack

높은 주소
```

- **Heap은 위로 성장한다.**
- **Stack은 아래로 성장한다.**

---

# 한 줄 요약

- **운영체제의 프로세스 메모리 구조**는 **Code, Data, BSS, Heap, Stack**으로 구성되며, 각각 **실행 코드, 전역 변수, 초기화되지 않은 전역 변수, 동적 메모리, 함수 호출 정보**를 저장하는 역할을 한다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:20:12.565781+00', '2026-08-06 08:20:12.565781+00', NULL),
	('fe40c41d-e8a9-4ee7-986e-d79a5feb6e78', '11111111-1111-4111-8111-111111111111', '트러블슈팅 - /set-password, /reset-password 접근 제어 강화', '이 내용도 트러블슈팅 형태로 정리하면 **데이터 동기화 누락으로 인한 조회/검색 오류** 사례로 정리하는 것이 좋습니다.

---

# 트러블슈팅 - OAuth 사용자의 이메일이 관리자 목록에서 누락되는 문제

## 문제

관리자 사용자 목록에서 일부 사용자의 이메일이 `-`로 표시되고, 이메일 검색도 동작하지 않는 문제가 발생했습니다.

조사 결과 **OAuth로 가입한 사용자에게서만 발생**했습니다.

관리자 목록은 `profiles.canonical_email`을 기준으로 이메일을 표시하고 검색하도록 구현되어 있었지만, OAuth 가입 사용자는 해당 값이 저장되지 않아 `NULL` 상태였습니다.

결과적으로 OAuth 사용자는

- 관리자 목록에서 이메일이 `-`로 표시되고
- 이메일 검색 대상에서도 제외되는 문제가 발생했습니다.

---

## 원인

이메일 가입과 OAuth 가입의 이메일 저장 흐름이 서로 달랐습니다.

### 이메일 가입

```
```

```
email
    ↓
canonicalizeEmail()
    ↓
profiles.canonical_email 저장
```

관리자 기능은 이 값을 사용했습니다.

---

### OAuth 가입

```
```

```
OAuth Login
      ↓
Auth 성공
      ↓
profiles 생성
```

`canonical_email`을 저장하는 과정이 존재하지 않았습니다.

즉,

```
```

```
profiles.canonical_email = NULL
```

상태가 되었고,

관리자 View는

```
```

```
profiles.canonical_email
```

만 조회하고 있었기 때문에 이메일을 표시할 수 없었습니다.

---

## 해결

신규 사용자와 기존 사용자를 모두 고려하여 수정했습니다.

### 1. OAuth Callback에서 이메일 동기화

OAuth 인증이 완료되면

```
```

```
user.email
      ↓
canonicalizeEmail()
      ↓
profiles.canonical_email 저장
```

하도록 변경했습니다.

적용 대상은

- \
  OAuth Signup
- \
  OAuth Login

중 약관 동의가 완료된 흐름으로 제한했습니다.

또한 이메일 동기화 실패가 OAuth 로그인 자체를 실패시키지 않도록

- \
  오류는 warning만 기록
- \
  인증 흐름은 그대로 진행

하도록 처리했습니다.

---

### 2. 기존 사용자 Backfill

이미 가입되어 있는 OAuth 사용자도 모두 수정해야 했습니다.

이를 위해 Migration에서

```
```

```
auth.users.email
        ↓
canonicalizeEmail()
        ↓
profiles.canonical_email
```

을 보정하도록 Backfill을 추가했습니다.

---

### 3. Gmail 정규화 유지

이메일 가입과 동일한 규칙을 사용했습니다.

예를 들어

```
```

```
abc.def+test@gmail.com
```

↓

```
```

```
abcdef@gmail.com
```

으로 저장합니다.

Googlemail도 동일하게 [gmail.com](http://gmail.com)으로 변환하도록 유지했습니다.

---

### 4. Unique 충돌 방지

Backfill 과정에서

동일한 canonical email 후보가 여러 사용자에게 생성될 수 있습니다.

예를 들어

```
```

```
abc.def@gmail.com

abcdef@gmail.com
```

둘 다

```
```

```
abcdef@gmail.com
```

으로 정규화됩니다.

이 경우 Unique Index 충돌로 Migration 전체가 실패할 수 있기 때문에

다음 정책을 적용했습니다.

- \
  가장 먼저 생성된 사용자만 갱신
- \
  이미 다른 프로필이 사용 중인 canonical email은 건너뜀

이를 통해 Migration이 중단되지 않도록 했습니다.

---

## 결과

기존

```
```

```
OAuth 가입
      ↓
canonical_email 없음
      ↓
관리자 목록 : -
관리자 검색 : 불가능
```

수정 후

```
```

```
OAuth 가입
      ↓
canonicalizeEmail()
      ↓
profiles.canonical_email 저장
      ↓
관리자 목록 표시
관리자 검색 가능
```

기존 사용자도 Backfill을 통해 동일한 상태로 보정됩니다.

---

## 테스트

회귀를 방지하기 위해 테스트를 추가했습니다.

- \
  OAuth Callback 성공 시 `canonical_email` 저장
- \
  이메일 정규화가 기존 정책과 동일하게 적용되는지 확인
- \
  기존 이메일 가입 흐름에 영향이 없는지 확인
- \
  Backfill Migration 정상 실행 확인

---

## 배운 점

이번 문제는 **인증 시스템과 애플리케이션 데이터의 동기화가 누락되면서 발생한 사례**였습니다.

관리자 기능은 `profiles.canonical_email`을 신뢰하고 있었지만, OAuth 가입 흐름에서는 해당 필드가 채워지지 않아 데이터 불일치가 발생했습니다.

또한 신규 가입만 수정해서는 문제가 해결되지 않습니다. 이미 운영 중인 서비스에서는 기존 데이터가 남아 있기 때문에 **새로운 저장 로직과 함께 Backfill Migration을 제공해야 데이터 일관성을 유지할 수 있다**는 점을 확인할 수 있었습니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:20:59.600212+00', '2026-08-06 08:20:59.600212+00', NULL),
	('df2cf63e-50c3-49bf-9b50-ed5979c0a872', '11111111-1111-4111-8111-111111111111', '트러블슈팅 - Server Action의 관리자 인증 우회 취약점', '## 문제

관리자 알림 조회 함수에서 테스트와 서버 내부 호출을 편리하게 만들기 위해 `adminUserId`를 외부에서 주입할 수 있도록 구현되어 있었습니다.

```ts
export type GetAdminUnreadNotificationCountsOptions = {
  supabase?: AdminNotificationQueryClient;
  adminUserId?: string;
};

const adminUserId =
  options.adminUserId ?? (await requireAdmin());
```

문제는 해당 함수가 `"use server"` 모듈에서 export되고 있어, 단순한 서버 유틸이 아니라 클라이언트에서 호출할 수 있는 Server Action 엔드포인트로 노출된다는 점이었습니다.

호출자가 `adminUserId`를 직접 전달하면 `requireAdmin()`이 실행되지 않았습니다.

따라서 비관리자 또는 미인증 사용자가 Server Action을 직접 호출하면서 임의의 사용자 UUID를 전달할 경우, 관리자 인증 검사를 우회할 수 있는 구조였습니다.

---

## 영향 범위

취약점은 다음 두 관리자 알림 조회 기능에 영향을 주었습니다.

- 관리자 미확인 알림 개수 조회

- 관리자 알림 목록 조회

특히 관리자 알림 목록에는 운영 오류 메시지와 운영 오류 상세 경로가 포함되어 있어, 인증 우회 시 관리자 전용 운영 정보가 노출될 가능성이 있었습니다.

또한 관리자 알림 RPC는 `SECURITY DEFINER`로 실행되지만 전달받은 사용자 ID가 실제 관리자인지 검사하지 않았습니다.

따라서 애플리케이션의 `requireAdmin()`이 사실상 유일한 인증 경계였으며, 이를 우회할 수 있다는 점에서 Blocker 수준의 문제였습니다.

---

## 원인

### 1. Server Action과 내부 구현의 경계가 분리되지 않음

기존 함수는 다음 두 역할을 동시에 수행했습니다.

- 클라이언트에서 호출하는 공개 Server Action

- 테스트 및 서버 내부 호출을 위한 주입 가능한 구현

테스트 편의를 위해 추가한 `adminUserId` 옵션이 그대로 공개 Server Action의 인자로 노출됐습니다.

---

### 2. 사용자 입력과 인증 결과를 동일하게 취급

관리자 ID는 반드시 현재 세션을 검증한 `requireAdmin()`의 반환값으로 결정해야 합니다.

하지만 기존 구현은 호출자가 제공한 `adminUserId`를 인증 결과보다 우선해서 사용했습니다.

```ts
options.adminUserId ?? (await requireAdmin());
```

이 구조에서는 `adminUserId`가 존재하는 순간 인증 검사가 생략됩니다.

---

### 3. 테스트가 실제 인증 경로를 검증하지 않음

기존 테스트는 모든 경우에 `adminUserId`를 직접 주입했습니다.

따라서 테스트에서는 내부 조회 로직만 검증했고, 공개 Server Action이 실제로 `requireAdmin()`을 호출하는지는 확인하지 않았습니다.

`requireAdminMock`도 선언되어 있었지만 호출 여부를 검증하는 assertion이 없었기 때문에 인증 우회 구조를 탐지하지 못했습니다.

---

## 해결

공개 Server Action과 주입 가능한 내부 구현을 분리했습니다.

### 1. 내부 구현 분리

기존 조회 본문을 `"use server"`가 없는 `queries.internal.ts`로 이동했습니다.

```ts
export async function getAdminUnreadNotificationCountsFor(
  adminUserId: string,
  options: {
    supabase?: AdminNotificationQueryClient;
  } = {},
) {
  // 실제 조회 로직
}
```

내부 구현은 다음과 같은 특징을 가집니다.

- 인증 여부를 직접 판단하지 않음

- 검증이 완료된 관리자 ID를 필수 인자로 받음

- 테스트에서 Supabase Client를 주입할 수 있음

- 클라이언트에서 직접 호출할 수 없음

또한 `server-only`를 추가해 서버 전용 모듈임을 명시했습니다.

---

### 2. 공개 Server Action을 얇은 인증 래퍼로 변경

`queries.ts`의 공개 함수에서는 외부 옵션을 제거했습니다.

```ts
export async function getAdminUnreadNotificationCounts() {
  const adminUserId = await requireAdmin();

  return getAdminUnreadNotificationCountsFor(adminUserId);
}
```

이제 클라이언트에서 호출 가능한 Server Action은 항상 다음 순서로 실행됩니다.

```text
Server Action 호출
        ↓
requireAdmin()
        ↓
현재 세션의 관리자 ID 결정
        ↓
내부 조회 함수 호출
```

호출자가 관리자 ID를 직접 전달할 수 없으므로 인증 우회 경로가 제거되었습니다.

---

### 3. 서버 내부 호출 경로 정리

`/api/notifications`는 기존에도 `getIsAdmin(user.id)`를 통해 관리자 여부를 확인하고 있었습니다.

따라서 API Route에서는 공개 Server Action을 호출하지 않고, 인증 확인 후 내부 구현을 직접 사용하도록 변경했습니다.

```text
API 요청
   ↓
현재 사용자 조회
   ↓
getIsAdmin(user.id)
   ↓
내부 관리자 알림 조회 함수 호출
```

이를 통해 불필요한 중복 인증을 피하면서도, 내부 함수에는 검증된 관리자 ID만 전달되도록 했습니다.

---

### 4. RPC 결과 런타임 검증 추가

관리자 알림 RPC 결과는 기존에 TypeScript `as` 캐스팅으로 처리했습니다.

```ts
const result = data as AdminNotificationRow[];
```

하지만 `as`는 런타임 데이터를 검증하지 않으므로 DB 반환 구조가 달라지거나 잘못된 값이 들어와도 감지할 수 없습니다.

이를 Zod 스키마 검증으로 변경했습니다.

```text
RPC 응답
   ↓
Zod schema 검증
   ↓
검증된 관리자 알림 데이터 사용
```

인증 문제와 별개로 외부 데이터 경계의 안정성도 함께 강화했습니다.

---

## 수정 후 구조

```text
클라이언트 컴포넌트
        ↓
queries.ts
공개 Server Action
        ↓
requireAdmin()
        ↓
queries.internal.ts
내부 조회 구현
        ↓
관리자 알림 RPC
```

서버 내부 API는 다음과 같이 동작합니다.

```text
API Route
   ↓
getIsAdmin()
   ↓
queries.internal.ts
   ↓
관리자 알림 RPC
```

공개 엔드포인트와 내부 구현의 역할이 명확히 분리되었으며, 사용자 입력으로 관리자 ID를 주입할 수 없게 되었습니다.

---

## 테스트

다음 항목을 검증하도록 테스트를 보강했습니다.

- 공개 Server Action 호출 시 항상 `requireAdmin()`이 실행되는지 확인

- `requireAdmin()`이 반환한 관리자 ID가 내부 구현에 전달되는지 확인

- 클라이언트 호출 경로에서 `adminUserId`를 직접 주입할 수 없는지 확인

- 내부 구현은 전달받은 관리자 ID를 사용해 정상적으로 조회하는지 확인

- API Route는 `getIsAdmin()` 확인 후 내부 구현을 호출하는지 확인

- RPC 반환값이 Zod 스키마를 통과해야만 사용되는지 확인

---

## 결과

기존에는 호출자가 관리자 ID를 전달해 인증을 우회할 수 있었습니다.

```text
Server Action 호출
        ↓
adminUserId 직접 전달
        ↓
requireAdmin() 생략
        ↓
관리자 데이터 조회
```

수정 후에는 관리자 ID가 항상 현재 인증 세션을 기준으로 결정됩니다.

```text
Server Action 호출
        ↓
requireAdmin() 필수 실행
        ↓
검증된 관리자 ID 사용
        ↓
관리자 데이터 조회
```

이로써 비관리자 및 미인증 사용자가 관리자 알림 데이터를 조회할 수 있는 경로를 차단했습니다.

---

## 배운 점

### `"use server"` export는 일반 서버 함수가 아니다

`"use server"` 모듈에서 export된 함수는 단순한 내부 함수가 아니라 클라이언트가 호출할 수 있는 네트워크 엔드포인트가 될 수 있습니다.

따라서 함수의 모든 인자는 신뢰할 수 없는 사용자 입력으로 취급해야 합니다.

---

### 인증 주체의 ID를 외부에서 주입받으면 안 된다

`userId`, `adminUserId`, `actorUserId`처럼 권한 판단에 사용되는 값은 호출자의 입력을 신뢰해서는 안 됩니다.

공개 Server Action에서는 반드시 세션을 검증한 결과로 사용자 ID를 결정해야 합니다.

---

### 테스트 편의를 위한 의존성 주입은 내부 구현에만 허용해야 한다

Supabase Client나 사용자 ID를 주입해야 한다면 공개 엔드포인트가 아니라 별도의 내부 함수에 주입해야 합니다.

```text
공개 함수
- 인증 및 인가 담당
- 외부 주입 금지

내부 함수
- 비즈니스 로직 담당
- 테스트 의존성 주입 허용
```

---

### 인증은 테스트에서 명시적으로 검증해야 한다

조회 결과만 검증하는 테스트로는 인증 누락을 발견하기 어렵습니다.

관리자 기능의 공개 Server Action 테스트에서는 최소한 다음 항목을 확인해야 합니다.

- 인증 함수가 호출되는가

- 호출자가 제공한 ID가 사용되지 않는가

- 인증 실패 시 내부 조회가 실행되지 않는가

- 인증된 사용자 ID만 내부 구현에 전달되는가

이번 문제를 통해 Server Action을 일반적인 서버 유틸과 동일하게 취급하면 인증 경계가 무너질 수 있으며, 공개 엔드포인트와 내부 구현을 구조적으로 분리해야 한다는 점을 확인했습니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:21:25.408854+00', '2026-08-06 08:21:45.511047+00', NULL),
	('22f85f22-e83a-458e-bc1f-24cb1d8ce2f8', '11111111-1111-4111-8111-111111111111', '트러블슈팅 - React Query 재조회로 읽음 처리 Mutation이 반복 실행되는 문제', '## 문제

관리자 운영 오류 상세 페이지와 관리자 피드백 상세 페이지에서는 상세 데이터를 불러온 뒤, 해당 항목과 관련된 관리자 알림을 읽음 처리하고 있었습니다.

기존 구현은 `useEffect`의 의존성 배열에 React Query가 반환하는 `data` 객체를 직접 사용했습니다.

```ts
useEffect(() => {
  if (!data) {
    return;
  }

  markAdminNotificationsAsRead({
    // 읽음 처리 대상
  });
}, [data, markAdminNotificationsAsRead, detailId]);
```

상세 데이터가 처음 로드될 때 읽음 처리가 실행되는 것은 정상입니다.

하지만 React Query가 다음과 같은 이유로 데이터를 다시 조회하면, 내용이 동일하더라도 새로운 객체가 반환될 수 있습니다.

- 윈도우 포커스 복귀

- Query invalidation

- 수동 refetch

- stale 상태에 따른 재조회

이때 `data` 객체의 identity가 변경되면서 `useEffect`가 다시 실행되고, 동일한 알림에 대한 읽음 처리 Mutation이 반복 호출되는 문제가 있었습니다.

---

## 영향

동일한 상세 페이지에 머물러 있는 동안 다음 작업이 불필요하게 반복될 수 있었습니다.

```text
React Query refetch
        ↓
새로운 data 객체 반환
        ↓
useEffect 재실행
        ↓
읽음 처리 Server Action 호출
        ↓
Query invalidation
```

읽음 처리는 멱등적으로 동작하더라도 다음과 같은 비용이 발생합니다.

- 불필요한 Server Action 요청

- 중복 DB 작업

- 불필요한 React Query invalidation

- 관련 Query 재조회 가능성

- 서버 및 네트워크 사용량 증가

기존에는 Server Action 내부의 `revalidatePath()`까지 함께 실행되어 중복 작업 범위가 더 컸습니다.

---

## 원인

### 1. 데이터 존재 여부가 아닌 객체 identity에 의존

읽음 처리 실행 조건은 실질적으로 다음 두 가지입니다.

- 상세 데이터가 정상적으로 로드되었는가

- 현재 상세 ID에 대한 읽음 처리를 아직 실행하지 않았는가

하지만 기존 구현은 전체 `data` 객체를 의존성으로 사용했습니다.

React Query는 refetch 후 데이터 내용이 동일하더라도 새로운 객체를 반환할 수 있으므로, 객체 참조 변경만으로 Effect가 다시 실행될 수 있습니다.

---

### 2. 읽음 처리의 실행 횟수를 제어하지 않음

읽음 처리는 상세 페이지에 진입한 뒤 상세 ID별로 한 번만 수행하면 충분합니다.

그러나 기존 코드에는 이미 읽음 처리를 요청한 상세인지 기억하는 상태가 없었습니다.

따라서 React Query 데이터가 갱신될 때마다 같은 상세 ID로 Mutation을 다시 실행했습니다.

---

### 3. 서버 캐시 무효화와 클라이언트 캐시 무효화가 중복

읽음 처리 Server Action에서는 다음 경로를 재검증하고 있었습니다.

```ts
revalidatePath(ROUTES.ADMIN.DASHBOARD);
```

하지만 관리자 알림 개수와 목록은 React Query를 통해 클라이언트에서 관리하고 있었고, Mutation 성공 후 관련 Query를 invalidate하고 있었습니다.

```text
읽음 처리 성공
      ↓
관리자 알림 Query invalidate
      ↓
사이드바 배지 갱신
```

관리자 대시보드의 Server Component가 해당 알림 데이터를 직접 사용하지 않는 상태에서는 `revalidatePath()`가 실질적인 갱신에 기여하지 않았습니다.

결과적으로 서버 캐시와 클라이언트 캐시를 모두 무효화하는 중복 처리가 발생하고 있었습니다.

---

## 해결

### 1. 상세 ID별 실행 여부를 `useRef`로 관리

상세 페이지마다 마지막으로 읽음 처리를 실행한 상세 ID를 `useRef`에 저장하도록 변경했습니다.

```ts
const markedAsReadIdRef = useRef<string | null>(null);

useEffect(() => {
  if (!data || markedAsReadIdRef.current === detailId) {
    return;
  }

  markedAsReadIdRef.current = detailId;

  markAdminNotificationsAsRead({
    // 읽음 처리 대상
  });
}, [data, detailId, markAdminNotificationsAsRead]);
```

이제 동일한 상세 ID에서는 React Query의 `data` 객체가 변경되더라도 Mutation이 다시 실행되지 않습니다.

---

### 2. 상세 ID가 변경되면 새로운 항목만 처리

`useRef`에는 단순한 실행 여부가 아니라 처리한 상세 ID를 저장했습니다.

따라서 같은 컴포넌트 인스턴스에서 상세 ID가 변경되는 경우에는 새로운 상세에 대한 읽음 처리가 정상적으로 실행됩니다.

```text
운영 오류 A 진입
      ↓
A 읽음 처리
      ↓
A 데이터 refetch
      ↓
이미 처리됨 → 실행하지 않음
      ↓
운영 오류 B로 이동
      ↓
B 읽음 처리
```

이를 통해 다음 두 요구사항을 모두 만족했습니다.

- 동일 상세에서는 한 번만 실행

- 새로운 상세에서는 다시 실행

---

### 3. 불필요한 `revalidatePath()` 제거

`markAdminNotificationsAsReadAction`에서 다음 코드를 제거했습니다.

```ts
revalidatePath(ROUTES.ADMIN.DASHBOARD);
```

관리자 알림 UI는 Mutation 성공 후 React Query 캐시를 invalidate해 갱신하고 있으므로, 클라이언트 캐시 흐름만 유지하도록 정리했습니다.

수정 후 갱신 흐름은 다음과 같습니다.

```text
읽음 처리 Mutation
      ↓
Server Action 성공
      ↓
관리자 알림 Query invalidate
      ↓
사이드바 배지 및 알림 목록 갱신
```

---

## 수정 적용 범위

다음 두 상세 페이지에 동일한 방식을 적용했습니다.

- 관리자 운영 오류 상세

- 관리자 피드백 상세

두 페이지 모두 상세 ID별로 읽음 처리를 한 번만 수행하도록 통일했습니다.

---

## 결과

### 기존 동작

```text
상세 페이지 진입
      ↓
data 로드
      ↓
읽음 처리
      ↓
React Query refetch
      ↓
새로운 data 객체
      ↓
읽음 처리 재실행
```

### 수정 후

```text
상세 페이지 진입
      ↓
data 로드
      ↓
상세 ID 저장
      ↓
읽음 처리
      ↓
React Query refetch
      ↓
동일 상세 ID 확인
      ↓
추가 실행 없음
```

동일한 상세 페이지에 머무는 동안 불필요한 Server Action 호출과 Query invalidation이 반복되는 문제를 제거했습니다.

---

## 배운 점

### Effect의 의존성은 실행 조건과 일치해야 한다

`useEffect`에서 데이터 객체 전체를 의존성으로 사용하는 것이 항상 적절한 것은 아닙니다.

Effect가 실제로 필요한 조건이 단순히 데이터의 존재 여부라면 다음과 같은 값이 더 적합할 수 있습니다.

- `Boolean(data)`

- `data?.id`

- Query의 성공 여부

- 별도의 안정적인 상태 값

객체 자체를 의존성으로 사용하면 refetch나 데이터 가공 과정에서 참조가 변경되어 불필요한 Effect가 실행될 수 있습니다.

---

### 한 번만 수행해야 하는 Side Effect는 명시적으로 제어해야 한다

알림 읽음 처리, 분석 이벤트 전송, 최초 진입 기록처럼 한 번만 수행해야 하는 작업은 데이터 로드 여부만으로 제어하기 어렵습니다.

다음과 같은 방식으로 실행 여부를 명시적으로 관리해야 합니다.

- `useRef`

- 처리된 ID 저장

- 서버의 멱등성 키

- 별도의 상태 머신

이번 사례에서는 상세 ID별 실행 여부를 기억해야 했기 때문에 `useRef<string | null>`이 적합했습니다.

---

### 캐시 무효화 전략은 하나의 책임 주체로 통일해야 한다

Server Action에서 `revalidatePath()`를 호출하고 클라이언트에서도 React Query를 invalidate하면 동일한 상태를 두 캐시 시스템이 동시에 갱신하게 됩니다.

데이터를 React Query가 소유하고 있다면 클라이언트 Query invalidation을 중심으로 관리하고, Server Component가 직접 사용하는 데이터에만 `revalidatePath()`를 적용하는 것이 좋습니다.

이번 수정으로 관리자 알림 갱신 책임을 React Query에 일관되게 맡기도록 정리했습니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:22:02.514688+00', '2026-08-06 08:22:02.514688+00', NULL),
	('c29e87b2-d76e-4d01-8d3f-e7e4b2c401b5', '11111111-1111-4111-8111-111111111111', '트러블슈팅 - 운영 오류 발생 횟수 집계의 동시성 문제', '## 문제

동일한 운영 오류가 반복 발생하면 기존 오류 행의 `occurrence_count`를 증가시키도록 구현되어 있었습니다.

기존 로직은 애플리케이션에서 현재 값을 읽은 뒤 1을 더해 다시 저장하는 방식이었습니다.

```ts
occurrence_count: existingError.occurrence_count + 1
```

이 방식은 단일 요청에서는 정상적으로 동작하지만, 동일한 fingerprint의 오류가 동시에 기록되면 일부 증가분이 유실될 수 있습니다.

또한 오류를 집계하면서 기존 행의 `severity`를 새로 발생한 오류의 값으로 덮어쓰고 있어, 기존 `ERROR` 오류에 이후 `WARN`이나 `INFO` 오류가 들어오면 심각도가 낮아질 수 있었습니다.

---

## 원인

### 1. Read-Modify-Write 방식의 비원자적 증가

기존 카운트 증가는 다음 순서로 처리됐습니다.

```text
기존 오류 조회
    ↓
occurrence_count 읽기
    ↓
애플리케이션에서 +1 계산
    ↓
UPDATE 실행
```

동시에 두 요청이 들어오면 두 요청이 같은 값을 읽을 수 있습니다.

예를 들어 현재 `occurrence_count`가 10인 상황에서 요청 A와 요청 B가 동시에 처리되면 다음과 같이 동작할 수 있습니다.

```text
요청 A: 10 조회
요청 B: 10 조회

요청 A: 11 저장
요청 B: 11 저장
```

실제로 오류는 두 번 발생했지만 최종 값은 12가 아닌 11이 됩니다.

이와 같은 현상을 Lost Update라고 합니다.

운영 오류는 장애나 외부 서비스 실패처럼 짧은 시간에 같은 오류가 집중적으로 발생할 수 있으므로, 동시성 충돌 가능성을 무시하기 어려웠습니다.

---

### 2. 심각도 정책 없이 최신 값으로 덮어씀

기존 집계 로직은 동일한 오류가 다시 발생하면 새 요청의 `severity`로 기존 행을 갱신했습니다.

```text
기존 severity: ERROR
새 오류 severity: WARN
        ↓
최종 severity: WARN
```

하지만 동일 fingerprint로 집계되는 오류라면 이전에 확인된 가장 높은 심각도를 유지하는 편이 운영 관점에서 안전합니다.

새로운 오류의 심각도가 낮다는 이유로 기존 장애의 중요도가 낮아지면 관리자 목록의 정렬, 필터링 및 대응 우선순위가 왜곡될 수 있습니다.

---

## 해결

카운트 증가와 심각도 결정을 데이터베이스의 단일 UPDATE에서 처리하도록 RPC를 추가했습니다.

### `increment_operational_error_occurrence`

RPC 내부에서 다음 작업을 원자적으로 수행합니다.

- `occurrence_count = occurrence_count + 1`

- 마지막 발생 시각 갱신

- 필요한 오류 정보 갱신

- 기존보다 높은 심각도만 반영

- 갱신된 운영 오류 반환

개념적으로 다음과 같은 방식입니다.

```sql
UPDATE operational_errors
SET
  occurrence_count = occurrence_count + 1,
  last_occurred_at = now(),
  severity = CASE
    WHEN incoming_severity가 existing_severity보다 높으면 incoming_severity
    ELSE existing_severity
  END
WHERE id = target_id
RETURNING *;
```

증가 계산이 데이터베이스의 단일 UPDATE 안에서 수행되므로, 여러 요청이 동시에 실행되더라도 각 요청의 증가분이 순차적으로 반영됩니다.

---

## 심각도 유지 정책

심각도는 다음 우선순위를 사용하도록 처리했습니다.

```text
INFO < WARN < ERROR
```

집계 시 기존 값과 새 값 중 더 높은 심각도를 유지합니다.

| 기존 심각도 | 새 심각도 | 최종 심각도 |
| --- | --- | --- |
| INFO | WARN | WARN |
| INFO | ERROR | ERROR |
| WARN | INFO | WARN |
| WARN | ERROR | ERROR |
| ERROR | INFO | ERROR |
| ERROR | WARN | ERROR |

따라서 기존 `ERROR` 오류가 이후 `WARN` 또는 `INFO` 발생으로 낮아지지 않습니다.

반대로 기존 오류보다 더 높은 심각도의 오류가 들어오면 상향 조정할 수 있습니다.

---

## 수정 후 처리 흐름

### 기존

```text
기존 오류 조회
    ↓
애플리케이션에서 count + 1
    ↓
severity를 새 값으로 덮어쓰기
    ↓
UPDATE
```

### 수정 후

```text
동일 fingerprint 오류 확인
    ↓
increment_operational_error_occurrence RPC
    ↓
DB 단일 UPDATE
    ├─ occurrence_count 원자적 증가
    └─ 더 높은 severity 유지
```

카운트 증가와 심각도 갱신 정책이 하나의 데이터베이스 작업 안에서 처리되도록 변경했습니다.

---

## 결과

동일한 운영 오류가 동시에 여러 번 발생하더라도 각 발생 횟수가 유실되지 않습니다.

```text
초기 occurrence_count: 10

동시 요청 A → DB에서 +1
동시 요청 B → DB에서 +1

최종 occurrence_count: 12
```

또한 오류의 심각도는 집계 과정에서 낮아지지 않습니다.

```text
기존 ERROR
    +
새로운 WARN
    ↓
최종 ERROR 유지
```

이를 통해 운영 오류의 발생 빈도와 대응 우선순위를 더 정확하게 유지할 수 있게 되었습니다.

---

## 배운 점

### 카운터 증가는 애플리케이션에서 계산하면 안 된다

공유 행의 카운터를 증가시킬 때 다음 방식은 동시성에 취약합니다.

```ts
value: currentValue + 1
```

카운터 증가는 가능한 한 데이터베이스에서 직접 수행해야 합니다.

```sql
SET value = value + 1
```

이렇게 해야 데이터베이스의 행 잠금과 UPDATE 실행 순서를 이용해 증가분 유실을 방지할 수 있습니다.

---

### 동시에 변경되어야 하는 값은 하나의 트랜잭션 경계에 둬야 한다

이번 집계에서는 다음 값이 하나의 논리적인 작업에 포함됩니다.

- 발생 횟수

- 마지막 발생 시각

- 심각도

- 오류 컨텍스트

이 값들을 여러 쿼리로 나누면 중간 상태가 노출되거나 일부 값만 갱신될 수 있습니다.

RPC를 통해 관련 갱신을 하나의 데이터베이스 작업으로 묶으면 원자성과 일관성을 함께 확보할 수 있습니다.

---

### 집계 데이터에는 상태 병합 정책이 필요하다

동일한 오류를 하나의 행으로 집계할 때는 단순히 최신 요청의 값으로 덮어쓰는 것이 항상 올바르지 않습니다.

필드마다 별도의 병합 정책이 필요합니다.

- `occurrence_count`: 누적

- `last_occurred_at`: 최신 값

- `severity`: 최댓값

- 최초 발생 시각: 기존 값 유지

- 일부 컨텍스트: 최신 값 또는 별도 이력 저장

이번 문제를 통해 오류 집계는 단순 UPDATE가 아니라 필드별 의미에 맞는 병합 규칙을 가져야 한다는 점을 확인했습니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:22:28.333286+00', '2026-08-06 08:22:28.333286+00', NULL),
	('710f0a10-083e-405f-92ab-aa118d1cc5a6', '11111111-1111-4111-8111-111111111111', '트러블슈팅 - 관리자 피드백 목록의 메모리 정렬 제거', '## 문제

관리자 피드백 목록은 대부분의 정렬을 데이터베이스에서 처리하고 있었지만, 일부 정렬은 애플리케이션 메모리에서 수행하고 있었습니다.

대상 컬럼은 다음 네 가지였습니다.

- 사용자

- 답변 작성자

- 연결 노트

- 첨부 이미지 개수

이 컬럼들은 관계 데이터 또는 계산값을 기준으로 정렬해야 했기 때문에 기존에는 데이터베이스에서 정렬하지 않고 애플리케이션에서 처리하고 있었습니다.

---

## 기존 동작

메모리 정렬이 필요한 경우에는 페이지 단위 조회를 사용할 수 없었습니다.

처리 순서는 다음과 같았습니다.

```text
필터 적용
      ↓
조건에 맞는 전체 행 조회
      ↓
Profiles / Notes / Replies 조회
      ↓
메모리에서 정렬
      ↓
현재 페이지 slice
```

즉,

```ts
feedbackQuery
```

를 실행할 때 `range()`를 적용하지 않고 전체 데이터를 가져온 뒤,

```text
전체 데이터
      ↓
정렬
      ↓
slice(from, to)
```

로 현재 페이지를 잘라 반환했습니다.

---

## 문제점

데이터 규모가 작을 때는 큰 문제가 없었습니다.

하지만 피드백이 수천\~수만 건으로 증가하면 다음 비용이 발생합니다.

- 전체 테이블 조회

- 전체 행에 대한 관계 데이터 조회

- 전체 데이터를 메모리에 적재

- 전체 데이터 정렬

- 마지막에 필요한 페이지만 반환

예를 들어 20개만 표시하는 페이지에서도

```text
20개 필요
      ↓
5,000개 조회
      ↓
5,000개 정렬
      ↓
20개 반환
```

과 같은 흐름이 발생할 수 있습니다.

또한 해당 컬럼들은 관리자 화면에서 일반적인 정렬 옵션으로 제공되고 있었기 때문에, 드물게 발생하는 예외 경로가 아니라 사용자가 자주 사용할 수 있는 기능이라는 점도 문제였습니다.

---

## 원인

데이터베이스는 실제 컬럼을 기준으로는 쉽게 정렬할 수 있습니다.

```sql
ORDER BY created_at
```

하지만 다음 값들은 단순 컬럼이 아닙니다.

- 사용자 닉네임

- 답변 작성자

- 연결 노트 제목

- 이미지 개수

이러한 파생 값은 기존 조회 구조에서는 SQL의 `ORDER BY`에 바로 사용할 수 없었기 때문에 애플리케이션에서 정렬하도록 구현되어 있었습니다.

---

## 해결

이번 수정에서는 메모리 정렬 자체를 제거했습니다.

다음 정렬 기능을 지원 대상에서 제외했습니다.

- 사용자

- 답변 작성자

- 연결 노트

- 첨부 이미지 개수

이를 통해 모든 정렬이 데이터베이스에서 수행되도록 변경했습니다.

```text
필터
   ↓
DB ORDER BY
   ↓
DB RANGE
   ↓
현재 페이지만 조회
```

이제 어떤 정렬을 사용하더라도 전체 데이터를 메모리로 가져오는 경로는 존재하지 않습니다.

---

## 함께 정리한 내용

메모리 정렬 제거에 맞춰 관련 코드도 함께 정리했습니다.

- 메모리 정렬 유틸 제거

- 관련 타입 정리

- 불필요한 분기 제거

- 테스트 수정

코드 경로도 단순해졌습니다.

---

## 향후 계획

파생 컬럼 정렬 기능을 영구적으로 포기한 것은 아닙니다.

관리자 피드백 목록 전용 View(조회 모델)를 도입하면

```text
Feedback View

- user_name
- reply_author_name
- note_title
- image_count
```

처럼 정렬 가능한 컬럼을 미리 제공할 수 있습니다.

그러면 SQL에서

```sql
ORDER BY user_name
```

과 같이 처리할 수 있으므로,

기존 기능을 유지하면서도 페이지네이션과 정렬을 모두 데이터베이스에서 수행할 수 있습니다.

이를 위해 후속 작업용 TODO를 남겨두었습니다.

---

## 결과

### 기존

```text
DB 조회
      ↓
전체 데이터 메모리 로드
      ↓
관계 데이터 조회
      ↓
메모리 정렬
      ↓
현재 페이지 추출
```

### 수정 후

```text
DB ORDER BY
      ↓
DB RANGE
      ↓
현재 페이지 조회
```

모든 정렬이 동일한 처리 경로를 사용하게 되었으며,

데이터가 증가하더라도 조회량과 메모리 사용량이 페이지 크기에 비례하도록 개선했습니다.

---

## 배운 점

### 페이지네이션은 가능한 한 데이터베이스에서 수행해야 한다

페이지 단위 조회를 사용하는 시스템에서는

```text
전체 조회
    ↓
메모리 정렬
    ↓
페이지 추출
```

보다

```text
DB 정렬
    ↓
DB 페이지네이션
```

이 훨씬 확장성이 높습니다.

---

### 관리자 기능도 데이터 규모를 고려해야 한다

관리자 화면은 일반 사용자 화면보다 사용 빈도가 낮더라도,

조회 대상은 오히려 가장 큰 테이블인 경우가 많습니다.

현재 데이터가 적다고 해서 전체 조회를 허용하면 운영 기간이 길어질수록 병목이 발생할 가능성이 높아집니다.

---

### 지원 가능한 기능과 확장성을 함께 고려해야 한다

모든 기능을 유지하는 것보다,

확장성을 해치는 기능이라면 일시적으로 제거하고 적절한 데이터 모델을 준비한 뒤 다시 제공하는 것이 더 나은 선택일 수 있습니다.

이번 수정에서는 메모리 정렬을 제거해 현재 구조의 성능 문제를 해결하고, 이후 조회 전용 View를 통해 동일한 기능을 데이터베이스 수준에서 다시 지원할 수 있는 방향으로 정리했습니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:22:50.281588+00', '2026-08-06 08:22:50.281588+00', NULL),
	('e24314ab-4b59-4713-a0a4-adcb18da8508', '11111111-1111-4111-8111-111111111111', '트러블슈팅 - 사이드바 상태 복원으로 관리자 페이지 전체가 하이드레이션 전까지 비어 보이는 문제', '## 문제

관리자 페이지를 새로고침하거나 `/admin` 경로로 직접 진입하면, 하이드레이션이 완료될 때까지 헤더와 본문을 포함한 전체 화면이 비어 보이는 문제가 있었습니다.

문제의 원인은 `AdminSidebarProvider`에서 사이드바 상태를 복원하기 전까지 실제 콘텐츠를 렌더링하지 않도록 구현한 부분이었습니다.

```tsx
if (open === null) {
  return <div className={props.className} aria-hidden="true" />;
}
```

`open`의 초기값은 `null`이었고, 클라이언트 마운트 후 `localStorage`에서 저장된 사이드바 상태를 읽은 뒤에야 `true` 또는 `false`로 변경되었습니다.

따라서 서버 렌더링과 최초 클라이언트 렌더링에서는 빈 `<div>`만 반환되었습니다.

---

## 영향 범위

`AdminSidebarProvider`는 사이드바만 감싸는 컴포넌트가 아니라 관리자 레이아웃 전체를 감싸고 있었습니다.

```tsx
<AdminSidebarProvider>
  <AdminSidebar />

  <AdminBreadcrumbProvider>
    <SidebarInset>
      <AdminHeader />

      <main>
        {children}
      </main>
    </SidebarInset>
  </AdminBreadcrumbProvider>
</AdminSidebarProvider>
```

따라서 `open === null`일 때 렌더링되지 않는 범위에는 다음 항목이 모두 포함되었습니다.

- 관리자 사이드바

- 관리자 헤더

- Breadcrumb

- 현재 페이지 본문

- 각 페이지에서 서버 렌더링한 콘텐츠

원래 의도는 사이드바가 잠깐 열렸다 닫히는 flicker를 막는 것이었지만, 실제로는 관리자 페이지 전체를 숨기고 있었습니다.

---

## 기존 동작

기존 처리 흐름은 다음과 같았습니다.

```text
서버 렌더링
    ↓
open = null
    ↓
빈 div 반환
    ↓
HTML에 관리자 콘텐츠 없음
    ↓
클라이언트 하이드레이션
    ↓
localStorage에서 상태 복원
    ↓
open 설정
    ↓
관리자 전체 콘텐츠 렌더링
```

그 결과 매번 다음 문제가 발생했습니다.

- 직접 진입 시 빈 화면 노출

- 새로고침 시 blank flash 발생

- 서버에서 생성한 관리자 페이지 콘텐츠가 초기 HTML에 포함되지 않음

- 관리자 영역 전체에서 SSR의 사용자 체감 효과 감소

---

## 원인

### 1. 서버에서 읽을 수 없는 `localStorage` 사용

사이드바 상태는 `localStorage`에 저장되어 있었습니다.

하지만 `localStorage`는 브라우저에서만 접근할 수 있기 때문에 서버 렌더링 시점에는 저장된 값을 알 수 없습니다.

따라서 초기 상태를 `null`로 두고 마운트 후 값을 복원하는 방식이 사용되었습니다.

```text
SSR
 └─ localStorage 접근 불가

Client mount
 └─ localStorage 접근 가능
```

이 구조에서는 서버와 클라이언트의 초기 사이드바 상태를 일치시키기 어렵습니다.

---

### 2. 사이드바 상태 복원 전 전체 children을 제거

상태 불일치를 숨기기 위해 Provider 전체에서 렌더링을 중단했습니다.

```tsx
if (open === null) {
  return <div />;
}
```

하지만 Provider가 페이지 본문 전체를 감싸고 있었기 때문에 사이드바만 숨겨지는 것이 아니라 관리자 콘텐츠 전체가 제거되었습니다.

---

### 3. 기존 SidebarProvider의 쿠키 기능을 사용하지 않음

공통 `SidebarProvider`에는 이미 사이드바 상태를 쿠키에 저장하는 기능이 존재했습니다.

쿠키는 서버에서도 읽을 수 있으므로 서버 렌더링 시 초기 상태를 결정할 수 있습니다.

하지만 관리자 전용 Provider가 별도로 `localStorage` 복원 로직을 구현하면서 기존 쿠키 흐름을 우회하고 있었습니다.

---

## 해결

사이드바 상태 관리 책임을 기존 `SidebarProvider`의 쿠키 기반 기능으로 통일했습니다.

### 1. 빈 Placeholder 반환 제거

`AdminSidebarProvider`에서 다음 분기를 제거했습니다.

```tsx
if (open === null) {
  return <div className={props.className} aria-hidden="true" />;
}
```

이제 초기 상태 복원을 기다리기 위해 관리자 콘텐츠 전체를 숨기지 않습니다.

---

### 2. `localStorage` 기반 복원 로직 제거

관리자 Provider에서 다음 로직을 제거했습니다.

- `open`을 `null`로 초기화하는 상태

- 마운트 후 `localStorage`를 읽는 Effect

- 관리자 전용 사이드바 상태 저장 로직

- 관련 상수와 타입

- 더 이상 사용하지 않는 유틸 파일

관리자 사이드바만을 위한 별도 상태 저장 계층을 없앴습니다.

---

### 3. 서버에서 쿠키를 읽어 초기 상태 결정

`admin/layout.tsx`에서 `sidebar_state` 쿠키를 서버 사이드로 읽도록 변경했습니다.

읽은 값은 `SidebarProvider`의 `defaultOpen`으로 전달했습니다.

개념적인 흐름은 다음과 같습니다.

```tsx
const sidebarState = cookieStore.get("sidebar_state");
const defaultOpen = sidebarState?.value !== "false";

<AdminSidebarProvider defaultOpen={defaultOpen}>
  {children}
</AdminSidebarProvider>
```

이제 서버가 최초 HTML을 생성할 때부터 사이드바의 초기 상태를 알고 있습니다.

---

### 4. 상태 변경과 저장은 기존 Provider에 위임

사이드바를 열거나 닫을 때의 상태 변경과 쿠키 저장은 기존 `SidebarProvider`의 기능을 그대로 사용하도록 정리했습니다.

```text
사용자 사이드바 토글
        ↓
SidebarProvider 상태 변경
        ↓
sidebar_state 쿠키 저장
        ↓
다음 서버 렌더링에서 쿠키 읽기
```

상태 관리와 영속화 책임이 하나의 Provider로 통합되었습니다.

---

## 수정 후 동작

```text
/admin 요청
    ↓
서버에서 sidebar_state 쿠키 읽기
    ↓
defaultOpen 결정
    ↓
사이드바 + 헤더 + 본문 전체 SSR
    ↓
초기 HTML 표시
    ↓
동일한 상태로 하이드레이션
```

서버와 클라이언트가 동일한 초기 상태를 사용하므로, 전체 콘텐츠를 숨기는 우회 처리가 필요하지 않습니다.

---

## 결과

### 기존

```text
페이지 요청
    ↓
빈 div SSR
    ↓
빈 화면
    ↓
하이드레이션
    ↓
localStorage 복원
    ↓
관리자 콘텐츠 표시
```

### 수정 후

```text
페이지 요청
    ↓
쿠키 기반 상태 결정
    ↓
관리자 콘텐츠 SSR
    ↓
즉시 화면 표시
    ↓
정상 하이드레이션
```

이제 다음 상황에서도 관리자 콘텐츠가 서버 렌더링 단계부터 표시됩니다.

- 관리자 페이지 새로고침

- `/admin` 직접 진입

- 관리자 상세 페이지 URL 직접 접근

- 브라우저 탭에서 관리자 경로 복원

사이드바 상태도 이전 설정을 유지하면서 관리자 전체 화면의 blank flash를 제거했습니다.

---

## 배운 점

### UI 상태 영속화 방식은 SSR 가능 여부를 고려해야 한다

`localStorage`는 구현이 간단하지만 서버에서 읽을 수 없습니다.

서버 렌더링 결과에 영향을 주는 상태라면 쿠키처럼 서버와 클라이언트가 함께 접근할 수 있는 저장소가 더 적합합니다.

```text
클라이언트에서만 필요한 상태
→ localStorage 사용 가능

SSR 초기 렌더링에 필요한 상태
→ Cookie 또는 서버 저장소 고려
```

---

### 하이드레이션 불일치를 숨기기 위해 콘텐츠 전체를 제거하면 안 된다

서버와 클라이언트 상태가 다를 가능성이 있다고 해서 전체 children을 렌더링하지 않으면 SSR의 장점을 잃게 됩니다.

특히 Layout Provider는 예상보다 넓은 영역을 감싸는 경우가 많으므로, 조기 반환이 실제로 어떤 콘텐츠까지 제거하는지 확인해야 합니다.

---

### 공통 컴포넌트가 이미 제공하는 상태 관리 기능을 우선 사용해야 한다

기존 `SidebarProvider`에는 이미 다음 기능이 있었습니다.

- 사이드바 열림 상태 관리

- 상태 변경 처리

- 쿠키 저장

- `defaultOpen` 지원

관리자 전용 로직을 추가로 구현하면서 동일한 책임이 중복되고, 두 저장 방식이 충돌하는 구조가 만들어졌습니다.

공통 컴포넌트가 제공하는 기능을 그대로 활용함으로써 코드 복잡도를 줄이고 서버 렌더링도 복원할 수 있었습니다.

---

### SSR 문제는 화면 일부가 아니라 Provider 경계를 확인해야 한다

문제의 코드는 사이드바 Provider에 있었지만 실제 영향 범위는 관리자 전체 페이지였습니다.

Provider, Layout, Suspense Boundary처럼 상위 컴포넌트에서 렌더링을 중단하는 코드는 반드시 하위 트리 전체에 미치는 영향을 확인해야 합니다.', 0, '2026-08-06 15:00:00+00', '2026-08-06 08:23:16.755155+00', '2026-08-06 08:23:16.755155+00', NULL),
	('27fdc2a0-d0e5-4fe9-8755-8b7a190171fd', '11111111-1111-4111-8111-111111111111', 'TypeScript readonly 배열과 mutable 배열 타입 충돌', '## 문제

`AI_SETTING_FEATURE_OPTIONS`를 `AdminSelectField`의 `options`에 전달하는 과정에서 다음 타입 오류가 발생하였다.

```
```

```
The type ''readonly [...]'' is ''readonly'' and cannot be assigned to the mutable type ''AdminSelectFieldOption[]''.
```

---

## 원인

`AI_SETTING_FEATURE_OPTIONS`는 다음과 같이 `as const`로 선언되어 있다.

```
```

```
export const AI_SETTING_FEATURE_OPTIONS = [
  ...
] as const;
```

`as const`를 사용하면 배열은 **읽기 전용(**`readonly`**) 배열**로 추론된다.

반면 `AdminSelectField`는 다음과 같이 \*\*수정 가능한 배열(`AdminSelectFieldOption[]`)\*\*만 받을 수 있도록 정의되어 있었다.

```
```

```
type AdminSelectFieldProps = {
  options: AdminSelectFieldOption[];
};
```

TypeScript는 읽기 전용 배열을 수정 가능한 배열에 전달하는 것을 허용하지 않기 때문에 타입 오류가 발생하였다.

---

## 해결 방안

### 1. 공통 컴포넌트 수정

`AdminSelectField`가 `readonly` 배열도 받을 수 있도록 타입을 변경한다.

```
```

```
options: readonly AdminSelectFieldOption[];
```

**장점**

- \
  모든 읽기 전용 배열을 그대로 사용할 수 있다.
- \
  불필요한 배열 복사가 발생하지 않는다.

**단점**

- \
  기존 공통 컴포넌트를 수정해야 한다.
- \
  이번 작업 범위를 넘어서는 변경이 된다.

---

### 2. 사용하는 곳에서 일반 배열로 변환

AI 설정 폼에서 `readonly` 배열을 일반 배열로 변환하여 전달한다.

```
```

```
options={AI_SETTING_FEATURE_OPTIONS.map(({ label, value }) => ({
  label,
  value,
}))}
```

또는

```
```

```
options={[...AI_SETTING_FEATURE_OPTIONS]}
```

---

## 선택한 해결 방법

이번 작업에서는 **두 번째 방법**을 선택하였다.

이유는 이번 변경은 AI 설정 기능을 추가하는 작업이며, 기존 공통 컴포넌트(`AdminSelectField`)의 동작이나 인터페이스를 변경할 필요는 없다고 판단했기 때문이다.

따라서 **추가되는 기능에서 필요한 형태로 데이터를 변환하여 전달**하는 방식으로 구현하였다.', 0, '2026-08-07 15:00:00+00', '2026-08-07 01:50:10.327364+00', '2026-08-07 01:50:10.327364+00', NULL);


--
-- Data for Name: feedbacks; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."feedbacks" ("id", "user_id", "note_id", "category", "title", "content", "image_urls", "status", "created_at", "updated_at") VALUES
	('038ce928-7e6c-42a1-8c42-3a9779f91758', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', NULL, 'BUG', 'test', 'test', '{ecb8d3e5-e952-46de-a1b2-478a0523d49c/038ce928-7e6c-42a1-8c42-3a9779f91758/0f8c7a86-a54a-44cf-855d-9e7b903a5342.jpeg,ecb8d3e5-e952-46de-a1b2-478a0523d49c/038ce928-7e6c-42a1-8c42-3a9779f91758/d303d500-6d10-474d-be73-481a6d27ebef.jpeg}', 'OPEN', '2026-07-27 04:42:26.013983+00', '2026-07-27 04:42:26.013983+00'),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'BUG', '복습 완료 후 다음 알림 시간이 달라집니다', '오전 9시로 설정했는데 복습 완료 후 다음 알림이 자정 기준으로 보이는 것 같습니다. 같은 노트에서 두 번 재현했습니다.', '{22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/review-time-before.png,22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/review-time-after.png}', 'OPEN', '2026-07-23 01:10:00+00', '2026-07-23 01:10:00+00'),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'FEATURE', '피드백에 처리 메모가 있으면 좋겠습니다', '관리자가 처리 상태를 바꿀 때 내부 메모를 남기고, 나중에 같은 유형의 요청을 묶어볼 수 있으면 좋겠습니다.', '{}', 'OPEN', '2026-07-22 06:45:00+00', '2026-07-22 06:45:00+00'),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '22222222-2222-4222-8222-222222222222', NULL, 'ETC', '모바일에서 설정 화면이 조금 답답합니다', '프로필과 알림 설정 사이 간격이 좁아서 스크롤 중에 항목 구분이 어렵습니다. 첨부 이미지는 모바일 화면 예시입니다.', '{22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3/mobile-settings.png}', 'RESOLVED', '2026-07-20 11:20:00+00', '2026-07-21 03:30:00+00'),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', '33333333-3333-4333-8333-333333333333', NULL, 'BUG', '로그아웃 직후 뒤로가기 시 이전 화면이 보입니다', '로그아웃 후 브라우저 뒤로가기를 누르면 잠깐 노트 목록이 보입니다. 새로고침하면 로그인 화면으로 돌아갑니다.', '{}', 'OPEN', '2026-07-19 14:05:00+00', '2026-07-19 14:05:00+00'),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'FEATURE', '노트별 복습 통계를 보고 싶습니다', '각 노트에서 최근 복습 성공률과 밀린 횟수를 간단히 볼 수 있으면 복습 우선순위를 정하기 쉬울 것 같습니다.', '{}', 'RESOLVED', '2026-07-17 02:30:00+00', '2026-07-18 08:00:00+00'),
	('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6', '33333333-3333-4333-8333-333333333333', NULL, 'BUG', '첨부 이미지 업로드 실패 메시지가 불명확합니다', '5MB가 넘는 이미지를 올렸을 때 실패는 하는데 왜 실패했는지 알기 어렵습니다. 제한 크기를 메시지에 보여주면 좋겠습니다.', '{33333333-3333-4333-8333-333333333333/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6/upload-error.png}', 'OPEN', '2026-07-16 04:55:00+00', '2026-07-16 04:55:00+00');


--
-- Data for Name: feedback_replies; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: review_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."review_logs" ("id", "note_id", "user_id", "round", "scheduled_at", "completed_at", "created_at", "notification_claimed_at", "notification_dispatched_at", "notification_base_scheduled_at", "notification_dispatch_attempts", "notification_dispatch_failed_at") VALUES
	('5da81979-fc17-4d55-8488-c0085b0f7f59', '9d036509-c791-40ff-994a-6abe4a8c7673', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:10:49.931+00', NULL, '2026-08-06 08:10:49.942502+00', '2026-08-07 08:10:49.931+00', '2026-08-07 08:10:49.931+00', NULL, 1, NULL),
	('b864f297-d340-4302-9fdd-5a60fd842389', 'fc0bc2e9-6653-40c8-87bf-077c44865680', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:11:57.726+00', NULL, '2026-08-06 08:11:57.745365+00', '2026-08-07 08:11:57.726+00', '2026-08-07 08:11:57.726+00', NULL, 1, NULL),
	('bc8756d0-907d-4cfd-8e16-c813d39006f9', '34bd6c74-6061-42e0-b912-67a33035367e', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:13:29.854+00', NULL, '2026-08-06 08:13:29.870318+00', '2026-08-07 08:13:29.854+00', '2026-08-07 08:13:29.854+00', NULL, 1, NULL),
	('f51afc24-e937-4562-81e4-f9374e2e5493', '58980a16-9419-478d-85be-c2d1dca24dcf', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:13:56.29+00', NULL, '2026-08-06 08:13:56.308404+00', '2026-08-07 08:13:56.29+00', '2026-08-07 08:13:56.29+00', NULL, 1, NULL),
	('d477c29c-824a-4a71-ad73-99557d458e72', '11154ae5-c3ae-4457-ab8a-e43535d6239a', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:14:26.532+00', NULL, '2026-08-06 08:14:26.545801+00', '2026-08-07 08:14:26.532+00', '2026-08-07 08:14:26.532+00', NULL, 1, NULL),
	('c2749ed9-6cc2-47b8-97c0-b38889b1c4bf', 'c38986d1-0abf-41c8-a3c6-a631e83063de', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:14:48.952+00', NULL, '2026-08-06 08:14:48.962759+00', '2026-08-07 08:14:48.952+00', '2026-08-07 08:14:48.952+00', NULL, 1, NULL),
	('9e06ea25-b9dd-4f38-a343-ce2292f1f0ca', '2ee07297-2b25-42fa-813c-83947e8f542e', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:15:13.015+00', NULL, '2026-08-06 08:15:13.026425+00', '2026-08-07 08:15:13.015+00', '2026-08-07 08:15:13.015+00', NULL, 1, NULL),
	('d1154192-a88d-4afa-9e2d-7779d7ad1ebe', 'ccc60413-3be6-423a-9a27-7f107d3972ed', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:15:32.989+00', NULL, '2026-08-06 08:15:32.998684+00', '2026-08-07 08:15:32.989+00', '2026-08-07 08:15:32.989+00', NULL, 1, NULL),
	('3304cf7c-da07-4b16-a9f2-a15b4faa47ef', '0a3bfb95-d179-4e97-9c50-5e3dca16a830', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:15:52.994+00', NULL, '2026-08-06 08:15:53.008107+00', '2026-08-07 08:15:52.994+00', '2026-08-07 08:15:52.994+00', NULL, 1, NULL),
	('04345d22-83ff-4224-a8c0-506ccf14efbe', 'bb89a19b-a1d3-41d5-905b-b868aaa6897c', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:16:11.521+00', NULL, '2026-08-06 08:16:11.534109+00', '2026-08-07 08:16:11.521+00', '2026-08-07 08:16:11.521+00', NULL, 1, NULL),
	('327ace2d-e155-451d-a56d-4c69ef998a4a', '1642aa6d-038b-43b3-9e43-40f5a1f3c2e7', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:16:35.499+00', NULL, '2026-08-06 08:16:35.510931+00', '2026-08-07 08:16:35.499+00', '2026-08-07 08:16:35.499+00', NULL, 1, NULL),
	('6e974f2b-fdea-4e7e-9c2e-f8f90197f352', 'c29e35d5-f174-4c5b-ae4c-dc35d63b8a8e', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:17:14.934+00', NULL, '2026-08-06 08:17:14.964413+00', '2026-08-07 08:17:14.934+00', '2026-08-07 08:17:14.934+00', NULL, 1, NULL),
	('34bb46ad-8471-4220-8d5a-a8e8b071da0c', '8673a1aa-c061-4d83-bf17-3572c6ddc800', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:17:30.421+00', NULL, '2026-08-06 08:17:30.430851+00', '2026-08-07 08:17:30.421+00', '2026-08-07 08:17:30.421+00', NULL, 1, NULL),
	('a3215a44-3a59-4a48-a4aa-6e8fc98ce0e1', 'd9e8b620-6862-49eb-a806-0b00cd563e0e', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:17:53.118+00', NULL, '2026-08-06 08:17:53.129376+00', '2026-08-07 08:17:53.118+00', '2026-08-07 08:17:53.118+00', NULL, 1, NULL),
	('51d09659-133c-4620-803b-8ec2ff3677dd', 'e949c598-2192-4e2d-a8c4-e3fadbeff4bd', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:18:14.131+00', NULL, '2026-08-06 08:18:14.140477+00', '2026-08-07 08:18:14.131+00', '2026-08-07 08:18:14.131+00', NULL, 1, NULL),
	('e3042239-f601-485a-ba3b-d818b6e5a7a7', 'bf70504d-70b6-4871-ae34-038b920475f6', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:18:38.416+00', NULL, '2026-08-06 08:18:38.427205+00', '2026-08-07 08:18:38.416+00', '2026-08-07 08:18:38.416+00', NULL, 1, NULL),
	('b4fad77c-f5aa-42c4-afe5-479bd7fe3a19', '02f33add-eb3a-406d-ac67-110d0b9507cf', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:18:59.061+00', NULL, '2026-08-06 08:18:59.068898+00', '2026-08-07 08:18:59.061+00', '2026-08-07 08:18:59.061+00', NULL, 1, NULL),
	('cc20f031-5ceb-426b-828c-1466c56f5e28', '6aaa8e0f-9b3e-4bbe-822f-3c9380dc622c', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:19:18.095+00', NULL, '2026-08-06 08:19:18.105094+00', '2026-08-07 08:19:18.095+00', '2026-08-07 08:19:18.095+00', NULL, 1, NULL),
	('61c9f910-9352-43ca-bc40-eada85690983', 'cf489b2b-f5cd-4788-99d3-05fa43f31625', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:19:34.975+00', NULL, '2026-08-06 08:19:34.985227+00', '2026-08-07 08:19:34.975+00', '2026-08-07 08:19:34.975+00', NULL, 1, NULL),
	('647e7846-1cc5-4064-8680-eae0a28b5a54', 'c5a378f7-9833-428e-a9e6-4d2258453269', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:19:57.075+00', NULL, '2026-08-06 08:19:57.08692+00', '2026-08-07 08:19:57.075+00', '2026-08-07 08:19:57.075+00', NULL, 1, NULL),
	('4732ba00-4b9d-4bee-9218-a544205ad706', '89e3a3ea-226d-4232-b1b6-951cb65bd0d7', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:20:12.557+00', NULL, '2026-08-06 08:20:12.565781+00', '2026-08-07 08:20:12.557+00', '2026-08-07 08:20:12.557+00', NULL, 1, NULL),
	('f779c50e-32cb-4921-ace5-74ca1d43e567', 'fe40c41d-e8a9-4ee7-986e-d79a5feb6e78', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:20:59.593+00', NULL, '2026-08-06 08:20:59.600212+00', '2026-08-07 08:20:59.593+00', '2026-08-07 08:20:59.593+00', NULL, 1, NULL),
	('b8c8a745-f421-4b60-9ba6-204f255318ad', 'df2cf63e-50c3-49bf-9b50-ed5979c0a872', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:21:25.4+00', NULL, '2026-08-06 08:21:25.408854+00', '2026-08-07 08:21:25.4+00', '2026-08-07 08:21:25.4+00', NULL, 1, NULL),
	('ef799902-cb0d-4b21-be53-e7f8d55e8158', '22f85f22-e83a-458e-bc1f-24cb1d8ce2f8', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:22:02.506+00', NULL, '2026-08-06 08:22:02.514688+00', '2026-08-07 08:22:02.506+00', '2026-08-07 08:22:02.506+00', NULL, 1, NULL),
	('393afd92-df7f-4f14-8410-31bffbe9fb23', 'c29e87b2-d76e-4d01-8d3f-e7e4b2c401b5', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:22:28.326+00', NULL, '2026-08-06 08:22:28.333286+00', '2026-08-07 08:22:28.326+00', '2026-08-07 08:22:28.326+00', NULL, 1, NULL),
	('9c76ec07-10c8-47ab-a094-e5032b2808fa', '710f0a10-083e-405f-92ab-aa118d1cc5a6', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:22:50.268+00', NULL, '2026-08-06 08:22:50.281588+00', '2026-08-07 08:22:50.268+00', '2026-08-07 08:22:50.268+00', NULL, 1, NULL),
	('eacd2145-f4df-40ad-94de-13cf015b9e3e', 'e24314ab-4b59-4713-a0a4-adcb18da8508', '11111111-1111-4111-8111-111111111111', 1, '2026-08-07 08:23:16.744+00', NULL, '2026-08-06 08:23:16.755155+00', '2026-08-07 08:23:16.744+00', '2026-08-07 08:23:16.744+00', NULL, 1, NULL),
	('b0244a5f-c8d7-4f7d-8196-05b949b3f22a', '27fdc2a0-d0e5-4fe9-8755-8b7a190171fd', '11111111-1111-4111-8111-111111111111', 1, '2026-08-08 01:50:10.3+00', NULL, '2026-08-07 01:50:10.327364+00', '2026-08-08 01:50:10.3+00', '2026-08-08 01:50:10.3+00', NULL, 1, NULL);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: operational_errors; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."operational_errors" ("id", "feature", "operation", "stage", "error_code", "severity", "status", "message", "user_id", "actor_user_id", "fingerprint", "occurrence_count", "first_seen_at", "last_seen_at", "context", "resolved_at", "resolved_by", "resolution_note", "created_at", "updated_at") VALUES
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'notifications', 'create_user_notification', 'in_app_notification_create', 'NOTIFICATION_CREATE_FAILED', 'ERROR', 'OPEN', '사용자 알림 생성 중 데이터베이스 저장에 실패했습니다.', '22222222-2222-4222-8222-222222222222', NULL, 'seed:notifications:create_user_notification:in_app_notification_create:NOTIFICATION_CREATE_FAILED', 3, '2026-07-21 01:10:00+00', '2026-07-28 04:20:00+00', '{"noteId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "reviewLogId": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", "notificationType": "REVIEW_REMINDER"}', NULL, NULL, NULL, '2026-07-21 01:10:00+00', '2026-07-28 04:20:00+00'),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'notifications', 'dispatch_push', 'push_send', 'PUSH_SUBSCRIPTION_GONE', 'WARN', 'OPEN', '만료된 Push 구독으로 알림 전송에 실패했습니다.', '33333333-3333-4333-8333-333333333333', NULL, 'seed:notifications:dispatch_push:push_send:PUSH_SUBSCRIPTION_GONE', 7, '2026-07-22 08:30:00+00', '2026-07-28 02:15:00+00', '{"retryable": false, "notificationType": "REVIEW_REMINDER", "providerStatusCode": 410}', NULL, NULL, NULL, '2026-07-22 08:30:00+00', '2026-07-28 02:15:00+00'),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'notifications', 'dispatch_push', 'push_subscription_cleanup', 'PUSH_SUBSCRIPTION_DELETE_FAILED', 'ERROR', 'RESOLVED', '만료된 Push 구독 정리 중 Storage 삭제에 실패했습니다.', '22222222-2222-4222-8222-222222222222', NULL, 'seed:notifications:dispatch_push:push_subscription_cleanup:PUSH_SUBSCRIPTION_DELETE_FAILED', 2, '2026-07-18 00:05:00+00', '2026-07-23 00:05:00+00', '{"retryable": false, "endpointHash": "subscription-endpoint-hash", "providerStatusCode": 410}', '2026-07-24 06:40:00+00', '11111111-1111-4111-8111-111111111111', '구독 정리 재시도 배치에서 삭제를 완료했습니다.', '2026-07-18 00:05:00+00', '2026-07-24 06:40:00+00'),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', 'admin_operational_errors', 'list_operational_errors', 'list_query', 'OPERATIONAL_ERROR_LIST_FAILED', 'INFO', 'IGNORED', '운영 오류 목록 조회 중 일시적인 네트워크 오류가 발생했습니다.', NULL, '11111111-1111-4111-8111-111111111111', 'seed:admin_operational_errors:list_operational_errors:list_query:OPERATIONAL_ERROR_LIST_FAILED', 1, '2026-07-19 14:05:00+00', '2026-07-19 14:05:00+00', '{"page": 1, "pageSize": 10, "sortField": "lastSeenAt"}', '2026-07-20 02:00:00+00', '11111111-1111-4111-8111-111111111111', '로컬 네트워크 단절로 인한 일회성 오류로 판단해 무시했습니다.', '2026-07-19 14:05:00+00', '2026-07-20 02:00:00+00'),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'admin_operational_errors', 'get_operational_error_detail', 'profile_query', 'OPERATIONAL_ERROR_PROFILES_FAILED', 'WARN', 'OPEN', '운영 오류 상세 화면에서 관련 사용자 정보를 불러오지 못했습니다.', '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'seed:admin_operational_errors:get_operational_error_detail:profile_query:OPERATIONAL_ERROR_PROFILES_FAILED', 4, '2026-07-16 04:55:00+00', '2026-07-27 09:12:00+00', '{"profileIds": ["33333333-3333-4333-8333-333333333333", "11111111-1111-4111-8111-111111111111"], "profileCount": 2, "operationalErrorId": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"}', NULL, NULL, NULL, '2026-07-16 04:55:00+00', '2026-07-27 09:12:00+00'),
	('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6', 'admin_operational_errors', 'update_operational_error_status', 'status_history_insert', 'OPERATIONAL_ERROR_HISTORY_INSERT_FAILED', 'ERROR', 'RESOLVED', '운영 오류 상태 변경 후 처리 이력 저장에 실패했습니다.', NULL, '11111111-1111-4111-8111-111111111111', 'seed:admin_operational_errors:update_operational_error_status:status_history_insert:OPERATIONAL_ERROR_HISTORY_INSERT_FAILED', 1, '2026-07-26 11:30:00+00', '2026-07-26 11:30:00+00', '{"hasNote": true, "toStatus": "RESOLVED", "fromStatus": "OPEN", "operationalErrorId": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5"}', '2026-07-27 03:15:00+00', '11111111-1111-4111-8111-111111111111', '상태 변경과 이력 저장 경로를 재검증했습니다.', '2026-07-26 11:30:00+00', '2026-07-27 03:15:00+00');


--
-- Data for Name: operational_error_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."operational_error_status_history" ("id", "operational_error_id", "from_status", "to_status", "note", "changed_by", "created_at") VALUES
	('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', NULL, 'OPEN', '운영 오류 최초 등록', NULL, '2026-07-18 00:05:00+00'),
	('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'OPEN', 'RESOLVED', '구독 정리 재시도 배치에서 삭제 완료', '11111111-1111-4111-8111-111111111111', '2026-07-24 06:40:00+00'),
	('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', NULL, 'OPEN', '운영 오류 최초 등록', NULL, '2026-07-19 14:05:00+00'),
	('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', 'OPEN', 'IGNORED', '일회성 네트워크 오류로 판단하여 제외', '11111111-1111-4111-8111-111111111111', '2026-07-20 02:00:00+00'),
	('dddddddd-dddd-4ddd-8ddd-ddddddddddd5', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6', NULL, 'OPEN', '운영 오류 최초 등록', NULL, '2026-07-26 11:30:00+00'),
	('dddddddd-dddd-4ddd-8ddd-ddddddddddd6', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6', 'OPEN', 'RESOLVED', '상태 변경과 이력 저장 경로 재검증 완료', '11111111-1111-4111-8111-111111111111', '2026-07-27 03:15:00+00');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "nickname", "avatar_url", "role", "created_at", "updated_at", "canonical_email") VALUES
	('11111111-1111-4111-8111-111111111111', 'adminfb', NULL, 'ADMIN', '2026-08-06 08:03:01.070496+00', '2026-08-06 08:03:01.734163+00', 'admin.feedback.local@example.com'),
	('22222222-2222-4222-8222-222222222222', 'fbuser1', NULL, 'USER', '2026-08-06 08:03:01.331127+00', '2026-08-06 08:03:01.331127+00', 'user.feedback.one@example.com'),
	('33333333-3333-4333-8333-333333333333', 'fbuser2', NULL, 'USER', '2026-08-06 08:03:01.573865+00', '2026-08-06 08:03:01.573865+00', 'user.feedback.two@example.com');


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quiz_generations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quizzes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: review_grading_generations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: review_gradings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_agreements; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_agreements" ("user_id", "terms_agreed_at", "privacy_agreed_at", "source", "created_at", "updated_at") VALUES
	('11111111-1111-4111-8111-111111111111', '2026-08-06 08:03:01.745+00', '2026-08-06 08:03:01.745+00', 'email_backfill', '2026-08-06 08:03:01.758302+00', '2026-08-06 08:03:01.745+00'),
	('22222222-2222-4222-8222-222222222222', '2026-08-06 08:03:01.745+00', '2026-08-06 08:03:01.745+00', 'email_backfill', '2026-08-06 08:03:01.758302+00', '2026-08-06 08:03:01.745+00'),
	('33333333-3333-4333-8333-333333333333', '2026-08-06 08:03:01.745+00', '2026-08-06 08:03:01.745+00', 'email_backfill', '2026-08-06 08:03:01.758302+00', '2026-08-06 08:03:01.745+00'),
	('c2df0ed1-1b44-44f3-8762-4ad68d66e46a', '2026-08-06 08:04:52.158+00', '2026-08-06 08:04:52.158+00', 'oauth', '2026-08-06 08:04:52.17571+00', '2026-08-06 08:04:52.17571+00');




--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('26e974fb-df72-476f-8ddc-187dd336d026', 'avatars', '5046767f-d23e-49d2-83e1-65613b99c7ff.jpg', NULL, '2026-04-13 08:15:58.030761+00', '2026-04-13 08:15:58.030761+00', '2026-04-13 08:15:58.030761+00', '{"eTag": "\"2a90414b2d21146eab2d43addb65d768\"", "size": 27033, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-04-13T08:15:58.000Z", "contentLength": 27033, "httpStatusCode": 200}', 'd9603135-fe4d-4f41-b1e0-2e64897a1311', NULL, '{}'),
	('dfa4ed93-8e15-4fcc-abf8-9a852ca78227', 'feedbacks', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c/038ce928-7e6c-42a1-8c42-3a9779f91758/d303d500-6d10-474d-be73-481a6d27ebef.jpeg', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', '2026-07-27 04:42:25.697073+00', '2026-07-27 04:42:25.697073+00', '2026-07-27 04:42:25.697073+00', '{"eTag": "\"2b6f8d5daf2c97392cfd321c50074cab\"", "size": 270202, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-27T04:42:26.000Z", "contentLength": 270202, "httpStatusCode": 200}', 'bb2b63ce-d3e0-4b79-92d1-ae0dda568ef6', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', '{}'),
	('6cf0d154-05d5-4350-ba3a-64b04bcc41cf', 'avatars', 'c2df0ed1-1b44-44f3-8762-4ad68d66e46a/avatar', 'c2df0ed1-1b44-44f3-8762-4ad68d66e46a', '2026-05-15 13:40:08.353054+00', '2026-05-15 13:40:08.353054+00', '2026-05-15 13:40:08.353054+00', '{"eTag": "\"24609e6ff10dbc7a5bfdc24154b8b4bf\"", "size": 200815, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-05-15T13:40:09.000Z", "contentLength": 200815, "httpStatusCode": 200}', 'c70bc205-be5e-4886-82ca-834a3f303785', 'c2df0ed1-1b44-44f3-8762-4ad68d66e46a', '{}'),
	('f46d32ea-d46b-4bc8-b837-8c3427ead052', 'avatars', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c/avatar', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', '2026-05-18 01:48:35.60899+00', '2026-05-18 01:48:35.60899+00', '2026-05-18 01:48:35.60899+00', '{"eTag": "\"24609e6ff10dbc7a5bfdc24154b8b4bf\"", "size": 200815, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-05-18T01:48:36.000Z", "contentLength": 200815, "httpStatusCode": 200}', '3f81bc72-472c-4132-afbc-3d6321d31af3', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', '{}'),
	('456f91bd-5afd-4301-817a-31fa4744ce4d', 'feedbacks', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c/038ce928-7e6c-42a1-8c42-3a9779f91758/0f8c7a86-a54a-44cf-855d-9e7b903a5342.jpeg', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', '2026-07-27 04:42:25.241205+00', '2026-07-27 04:42:25.241205+00', '2026-07-27 04:42:25.241205+00', '{"eTag": "\"2d25071a8042411aa9ad5b664e871b5e\"", "size": 656207, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-27T04:42:26.000Z", "contentLength": 656207, "httpStatusCode": 200}', '26f34699-91a6-4923-ab2f-daf69b108970', 'ecb8d3e5-e952-46de-a1b2-478a0523d49c', '{}'),
	('9c4bda99-c8cf-4381-b6a9-bdff51950f9d', 'feedbacks', '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/review-time-before.png', NULL, '2026-08-06 08:03:02.017141+00', '2026-08-06 08:03:02.017141+00', '2026-08-06 08:03:02.017141+00', '{"eTag": "\"f23d3a21ec788d5f20437e00b726ba12\"", "size": 118, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-06T08:03:01.996Z", "contentLength": 118, "httpStatusCode": 200}', '381c6aea-329f-46a3-86dd-d73e783ed640', NULL, '{}'),
	('b215f89a-a690-4f34-a8b7-f7b6d27ee3f4', 'feedbacks', '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/review-time-after.png', NULL, '2026-08-06 08:03:02.075495+00', '2026-08-06 08:03:02.075495+00', '2026-08-06 08:03:02.075495+00', '{"eTag": "\"1f0afd5f9e94b8697587b43ccff6c8ad\"", "size": 118, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-06T08:03:02.064Z", "contentLength": 118, "httpStatusCode": 200}', 'd4ac479e-0193-4da1-b2ab-891fd4acd948', NULL, '{}'),
	('46b5f157-def5-4b2f-a2c0-d0003c69a32c', 'feedbacks', '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3/mobile-settings.png', NULL, '2026-08-06 08:03:02.124218+00', '2026-08-06 08:03:02.124218+00', '2026-08-06 08:03:02.124218+00', '{"eTag": "\"192754792f5d73c57b8bbb96073c62fc\"", "size": 118, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-06T08:03:02.116Z", "contentLength": 118, "httpStatusCode": 200}', '9419932c-512c-4ce0-a4c5-e1d3cebc5b4f', NULL, '{}'),
	('cd2a26a2-1399-4225-b81e-07a2d3f290c8', 'feedbacks', '33333333-3333-4333-8333-333333333333/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6/upload-error.png', NULL, '2026-08-06 08:03:02.171826+00', '2026-08-06 08:03:02.171826+00', '2026-08-06 08:03:02.171826+00', '{"eTag": "\"ff9b9b69a09af0db2fcd738498a0638c\"", "size": 118, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-06T08:03:02.160Z", "contentLength": 118, "httpStatusCode": 200}', 'de098668-4d96-4292-8299-1589ac1b5e53', NULL, '{}'),
	('34cd87d9-7bc6-4c26-b7b0-f079d9704c7f', 'avatars', 'c2df0ed1-1b44-44f3-8762-4ad68d66e46a/oauth-avatar.png', NULL, '2026-08-06 08:04:52.697226+00', '2026-08-06 08:04:52.697226+00', '2026-08-06 08:04:52.697226+00', '{"eTag": "\"d76bf2515a6ec19df8b7906783a303b2\"", "size": 934, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-08-06T08:04:52.692Z", "contentLength": 934, "httpStatusCode": 200}', 'ee43e7c9-a7f9-4feb-8f73-b03c89903474', NULL, '{}');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 341, true);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict IATxcSd8C6cibK9MLndjYwVvUNKe0uk5YBBF6ijB836QL5NkOztjenFDclc9Xq9

RESET ALL;
