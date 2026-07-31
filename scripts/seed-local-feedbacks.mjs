import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

/**
 * `.env.local`의 환경 변수를 현재 Node.js 프로세스에 불러옵니다.
 */
function loadLocalEnv() {
  if (!existsSync(".env.local")) return;

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local.",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const users = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin.feedback.local@example.com",
    nickname: "adminfb",
    role: "ADMIN",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "user.feedback.one@example.com",
    nickname: "fbuser1",
    role: "USER",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "user.feedback.two@example.com",
    nickname: "fbuser2",
    role: "USER",
  },
];

const notes = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    user_id: users[1].id,
    title: "간격 반복 설정 메모",
    content:
      "복습 알림 시간이 바뀌는 상황을 확인하기 위한 로컬 seed 메모입니다.",
    review_round: 1,
    next_review_at: "2026-07-25T00:00:00.000Z",
    notification_time_of_day: "09:00:00",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    user_id: users[2].id,
    title: "이미지 첨부 테스트 메모",
    content: "피드백 상세에서 note_id 연결 표시를 확인하기 위한 메모입니다.",
    review_round: 2,
    next_review_at: "2026-07-28T00:00:00.000Z",
    notification_time_of_day: "21:30:00",
  },
];

const feedbacks = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    user_id: users[1].id,
    note_id: notes[0].id,
    category: "BUG",
    title: "복습 완료 후 다음 알림 시간이 달라집니다",
    content:
      "오전 9시로 설정했는데 복습 완료 후 다음 알림이 자정 기준으로 보이는 것 같습니다. 같은 노트에서 두 번 재현했습니다.",
    image_urls: [
      `${users[1].id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/review-time-before.png`,
      `${users[1].id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/review-time-after.png`,
    ],
    status: "OPEN",
    created_at: "2026-07-23T01:10:00.000Z",
    updated_at: "2026-07-23T01:10:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    user_id: users[2].id,
    note_id: notes[1].id,
    category: "FEATURE",
    title: "피드백에 처리 메모가 있으면 좋겠습니다",
    content:
      "관리자가 처리 상태를 바꿀 때 내부 메모를 남기고, 나중에 같은 유형의 요청을 묶어볼 수 있으면 좋겠습니다.",
    image_urls: [],
    status: "OPEN",
    created_at: "2026-07-22T06:45:00.000Z",
    updated_at: "2026-07-22T06:45:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
    user_id: users[1].id,
    note_id: null,
    category: "ETC",
    title: "모바일에서 설정 화면이 조금 답답합니다",
    content:
      "프로필과 알림 설정 사이 간격이 좁아서 스크롤 중에 항목 구분이 어렵습니다. 첨부 이미지는 모바일 화면 예시입니다.",
    image_urls: [
      `${users[1].id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3/mobile-settings.png`,
    ],
    status: "RESOLVED",
    created_at: "2026-07-20T11:20:00.000Z",
    updated_at: "2026-07-21T03:30:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
    user_id: users[2].id,
    note_id: null,
    category: "BUG",
    title: "로그아웃 직후 뒤로가기 시 이전 화면이 보입니다",
    content:
      "로그아웃 후 브라우저 뒤로가기를 누르면 잠깐 노트 목록이 보입니다. 새로고침하면 로그인 화면으로 돌아갑니다.",
    image_urls: [],
    status: "OPEN",
    created_at: "2026-07-19T14:05:00.000Z",
    updated_at: "2026-07-19T14:05:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
    user_id: users[1].id,
    note_id: notes[0].id,
    category: "FEATURE",
    title: "노트별 복습 통계를 보고 싶습니다",
    content:
      "각 노트에서 최근 복습 성공률과 밀린 횟수를 간단히 볼 수 있으면 복습 우선순위를 정하기 쉬울 것 같습니다.",
    image_urls: [],
    status: "RESOLVED",
    created_at: "2026-07-17T02:30:00.000Z",
    updated_at: "2026-07-18T08:00:00.000Z",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
    user_id: users[2].id,
    note_id: null,
    category: "BUG",
    title: "첨부 이미지 업로드 실패 메시지가 불명확합니다",
    content:
      "5MB가 넘는 이미지를 올렸을 때 실패는 하는데 왜 실패했는지 알기 어렵습니다. 제한 크기를 메시지에 보여주면 좋겠습니다.",
    image_urls: [
      `${users[2].id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6/upload-error.png`,
    ],
    status: "OPEN",
    created_at: "2026-07-16T04:55:00.000Z",
    updated_at: "2026-07-16T04:55:00.000Z",
  },
];

const pngByName = {
  "review-time-before.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAtp4yBAAAAOUlEQVR4nO3PAQ0AAAgDINc/9C3hHaQKVrPzJpmZWR0AAL+YC0aYEGFC2GBC2GBC2GBC2GBC2GBC2GBCKwB1KgHgS8JZ8AAAAABJRU5ErkJggg==",
  "review-time-after.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAtp4yBAAAAOUlEQVR4nO3PAQ0AAAgDINc/9C3hHaQKVrPzJpmZmR0AAL+YC0aYEGFC2GBC2GBC2GBC2GBC2GBC2GBCKwB1KgHgQeCwUgAAAABJRU5ErkJggg==",
  "mobile-settings.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAtp4yBAAAAOUlEQVR4nO3PAQ0AAAgDINc/9C3hHaQKVrPzJpmZmZ0AAL+YC0aYEGFC2GBC2GBC2GBC2GBC2GBC2GBCKwB1KgHgU6ynfwAAAABJRU5ErkJggg==",
  "upload-error.png":
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAtp4yBAAAAOUlEQVR4nO3PAQ0AAAgDINc/9C3hHaQKVrPzJpmZmT0AAL+YC0aYEGFC2GBC2GBC2GBC2GBC2GBC2GBCKwB1KgHgAByDOAAAAABJRU5ErkJggg==",
};

/**
 * Supabase 요청 결과에 오류가 있으면 예외를 발생시킵니다.
 *
 * @param {string} label 오류 메시지에 표시할 작업 이름
 * @param {{ data: unknown; error: { message: string } | null }} response
 * Supabase 요청 결과
 * @returns {Promise<unknown>} 요청 결과 데이터
 */
async function assertOk(label, response) {
  if (response.error) {
    throw new Error(`${label}: ${response.error.message}`);
  }

  return response.data;
}

/**
 * 로컬 Auth 사용자와 profiles 데이터를 생성합니다.
 */
async function seedUsers() {
  for (const user of users) {
    const { data: existing, error: getError } =
      await supabase.auth.admin.getUserById(user.id);

    if (getError && getError.status !== 404) {
      throw new Error(`getUserById ${user.email}: ${getError.message}`);
    }

    if (!existing?.user) {
      const created = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: "password123",
        email_confirm: true,
        user_metadata: {
          nickname: user.nickname,
          canonical_email: user.email,
        },
      });

      await assertOk(`createUser ${user.email}`, created);
    }
  }

  await assertOk(
    "upsert profiles",
    await supabase.from("profiles").upsert(
      users.map((user) => ({
        id: user.id,
        nickname: user.nickname,
        canonical_email: user.email,
        role: user.role,
      })),
      { onConflict: "id" },
    ),
  );
}

/**
 * 생성한 로컬 사용자들의 약관 및 개인정보 처리방침 동의 정보를 생성합니다.
 */
async function seedUserAgreements() {
  const agreedAt = new Date().toISOString();

  await assertOk(
    "upsert user agreements",
    await supabase.from("user_agreements").upsert(
      users.map((user) => ({
        user_id: user.id,
        terms_agreed_at: agreedAt,
        privacy_agreed_at: agreedAt,
        source: "email_backfill",
        updated_at: agreedAt,
      })),
      { onConflict: "user_id" },
    ),
  );
}

/**
 * 피드백 연결 테스트에 사용할 노트를 생성합니다.
 */
async function seedNotes() {
  await assertOk(
    "upsert notes",
    await supabase.from("notes").upsert(notes, { onConflict: "id" }),
  );
}

/**
 * 피드백 이미지 Storage 버킷이 없으면 생성합니다.
 */
async function seedBucket() {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`listBuckets: ${listError.message}`);
  }

  if (!buckets.some((bucket) => bucket.id === "feedbacks")) {
    const created = await supabase.storage.createBucket("feedbacks", {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    });

    await assertOk("create feedbacks bucket", created);
  }
}

/**
 * 피드백에 연결된 테스트 PNG 이미지를 Storage에 업로드합니다.
 */
async function seedImages() {
  const imagePaths = feedbacks.flatMap((feedback) => feedback.image_urls);

  for (const path of imagePaths) {
    const fileName = path.split("/").at(-1);
    const base64 = pngByName[fileName];

    if (!base64) {
      throw new Error(`No PNG fixture for ${fileName}`);
    }

    const uploaded = await supabase.storage
      .from("feedbacks")
      .upload(path, Buffer.from(base64, "base64"), {
        contentType: "image/png",
        upsert: true,
      });

    await assertOk(`upload ${path}`, uploaded);
  }
}

/**
 * 관리자 피드백 화면 테스트에 사용할 피드백 데이터를 생성합니다.
 */
async function seedFeedbacks() {
  await assertOk(
    "upsert feedbacks",
    await supabase.from("feedbacks").upsert(feedbacks, { onConflict: "id" }),
  );
}

/**
 * 생성된 피드백, 동의 정보와 Storage 파일을 확인합니다.
 *
 * @returns {Promise<{
 *   agreementCount: number;
 *   feedbackCount: number;
 *   imageCount: number;
 *   sampleStorageFiles: string[];
 * }>} 생성 결과 요약
 */
async function verify() {
  const feedbackResult = await supabase
    .from("feedbacks")
    .select("id, category, status, image_urls")
    .in(
      "id",
      feedbacks.map((feedback) => feedback.id),
    );

  const seededFeedbacks = await assertOk("verify feedbacks", feedbackResult);

  const agreementResult = await supabase
    .from("user_agreements")
    .select("user_id, terms_agreed_at, privacy_agreed_at, source")
    .in(
      "user_id",
      users.map((user) => user.id),
    );

  const seededAgreements = await assertOk(
    "verify user agreements",
    agreementResult,
  );

  const { data: files, error } = await supabase.storage
    .from("feedbacks")
    .list(`${users[1].id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1`);

  if (error) {
    throw new Error(`verify storage list: ${error.message}`);
  }

  return {
    agreementCount: seededAgreements.length,
    feedbackCount: seededFeedbacks.length,
    imageCount: seededFeedbacks.reduce(
      (total, feedback) => total + feedback.image_urls.length,
      0,
    ),
    sampleStorageFiles: files.map((file) => file.name),
  };
}

/**
 * 로컬 관리자 피드백 테스트 데이터를 순서대로 생성합니다.
 */
async function main() {
  await seedUsers();
  await seedUserAgreements();
  await seedNotes();
  await seedBucket();
  await seedImages();
  await seedFeedbacks();

  const result = await verify();

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
