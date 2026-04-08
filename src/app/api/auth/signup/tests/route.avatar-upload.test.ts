/**
 * 회원가입 API avatar 업로드 전용 테스트
 */

import { after, NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((cb: () => unknown) => cb()) };
});
vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/lib/supabase/admin");

beforeEach(() => {
  resetRateLimitStores();
});

describe("PR-API-07 프로필 이미지 업로드 성공 시 avatar_url 반영", () => {
  const mockGenerateLink = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockProfileUpdate = vi.fn();
  const mockProfileEq = vi.fn();

  const MOCK_UPLOAD_PATH = "avatars/mock-image.png";
  const MOCK_PUBLIC_URL = "https://example.com/storage/avatars/mock-image.png";

  function makeMultipartRequest(): NextRequest {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=boundary" },
      body: "dummy",
    });

    const mockFile = new File(["image-content"], "profile.jpg", {
      type: "image/jpeg",
    });
    const fields: Record<string, string | File> = {
      email: "test@example.com",
      password: "Password123!",
      nickname: "테스터",
      agreements: JSON.stringify({ termsOfService: true, privacyPolicy: true }),
      avatarFile: mockFile,
    };

    vi.spyOn(request, "formData").mockResolvedValue({
      get: (key: string) => fields[key] ?? null,
    } as unknown as FormData);

    return request;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);

    mockProfileUpdate.mockReturnValue({ eq: mockProfileEq });
    mockProfileEq.mockResolvedValue({ data: null, error: null });

    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
      storage: {
        from: vi.fn(() => ({
          upload: mockStorageUpload,
          getPublicUrl: mockGetPublicUrl,
        })),
      },
      from: vi.fn(() => ({
        update: mockProfileUpdate,
      })),
    } as never);

    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
        properties: { hashed_token: "hashed-token" },
      },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({
      data: { path: MOCK_UPLOAD_PATH },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: MOCK_PUBLIC_URL },
    });
  });

  it("TC-01. 프로필 이미지 포함 회원가입 성공 시 성공 응답을 반환한다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.redirectTo).toBe(ROUTES.LOGIN);
  });

  it("TC-02. avatarFile가 포함된 요청 시 storage.upload가 1회 호출된다", async () => {
    await POST(makeMultipartRequest());
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
  });

  it("TC-03. upload 경로로 getPublicUrl이 1회 호출된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockGetPublicUrl).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledWith(MOCK_UPLOAD_PATH);
  });

  it("TC-04. 생성된 public URL로 profiles 테이블의 avatar_url이 업데이트된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockProfileUpdate).toHaveBeenCalledTimes(1);
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: MOCK_PUBLIC_URL }),
    );
  });

  it("TC-05. avatarFile이 있으면 after가 1회 호출된다", async () => {
    await POST(makeMultipartRequest());

    expect(vi.mocked(after)).toHaveBeenCalledTimes(1);
  });
});

describe("PR-API-08 프로필 이미지 업로드 실패 시 회원가입 성공 유지", () => {
  const mockGenerateLink = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockProfileUpdate = vi.fn();

  function makeMultipartRequest(): NextRequest {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=boundary" },
      body: "dummy",
    });

    const mockFile = new File(["image-content"], "profile.jpg", {
      type: "image/jpeg",
    });
    const fields: Record<string, string | File> = {
      email: "test@example.com",
      password: "Password123!",
      nickname: "Tester",
      agreements: JSON.stringify({ termsOfService: true, privacyPolicy: true }),
      avatarFile: mockFile,
    };

    vi.spyOn(request, "formData").mockResolvedValue({
      get: (key: string) => fields[key] ?? null,
    } as unknown as FormData);

    return request;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);

    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
      storage: {
        from: vi.fn(() => ({
          upload: mockStorageUpload,
          getPublicUrl: mockGetPublicUrl,
        })),
      },
      from: vi.fn(() => ({
        update: mockProfileUpdate,
      })),
    } as never);

    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
        properties: { hashed_token: "hashed-token" },
      },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: { message: "upload failed" },
    });
  });

  it("TC-01. 업로드 실패 시에도 회원가입은 200 성공 응답 계약을 유지한다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.redirectTo).toBe(ROUTES.LOGIN);
  });

  it("TC-02. 업로드 실패 시 getPublicUrl은 호출되지 않는다", async () => {
    await POST(makeMultipartRequest());

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledTimes(0);
  });

  it("TC-03. 업로드 실패 시 profiles 테이블 업데이트는 호출되지 않는다", async () => {
    await POST(makeMultipartRequest());
    expect(mockProfileUpdate).toHaveBeenCalledTimes(0);
  });

  it("TC-04. 업로드 실패 시 응답 data에 avatar_url이 포함되지 않는다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(body.data).not.toHaveProperty("avatar_url");
  });
});

describe("PR-API-09 아바타 없는 가입 시 after 미호출", () => {
  const mockGenerateLink = vi.fn();

  const BASE_BODY = {
    email: "test@example.com",
    password: "Password123!",
    nickname: "테스터",
    agreements: { termsOfService: true as const, privacyPolicy: true as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(sendAuthEmail).mockResolvedValue(undefined);

    vi.mocked(createAdminClient).mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink } },
    } as never);

    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "user-id", email: "test@example.com" },
        properties: { hashed_token: "hashed-token" },
      },
      error: null,
    });
  });

  it("TC-01. avatarFile이 없으면 after가 호출되지 않는다", async () => {
    const response = await POST(makeRequest(BASE_BODY));

    expect(response.status).toBe(200);
    expect(vi.mocked(after)).not.toHaveBeenCalled();
  });
});
