/**
 * 회원가입 API avatar 업로드 전용 테스트
 *
 * 이 파일은 multipart + storage + profile update 흐름만 검증한다.
 * - avatarFile 포함 multipart 요청 처리
 * - storage.upload 호출
 * - 업로드 경로 기반 getPublicUrl 호출
 * - 생성된 public URL로 profiles.avatar_url 업데이트
 * - 업로드 실패 시에도 회원가입 성공 계약 유지
 * - 실패 시 getPublicUrl / profile update 미호출
 * - 응답 data에 avatar_url이 직접 노출되지 않음
 *
 * 핵심 목적:
 * 회원가입 성공 자체와 파일 업로드 부수효과를 분리해 검증한다.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

// 테스트 간 rate limit store 공유 상태 제거
beforeEach(() => {
  resetRateLimitStores();
});

describe("PR-API-07 프로필 이미지 업로드 성공 시 avatar_url 반영", () => {
  const mockSignUp = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockProfileUpdate = vi.fn();
  const mockProfileEq = vi.fn();

  // 업로드 성공 시 storage path → public URL → profile update 순서의 부수효과를 검증한다
  const MOCK_UPLOAD_PATH = "avatars/mock-image.png";
  const MOCK_PUBLIC_URL = "https://example.com/storage/avatars/mock-image.png";

  // multipart/form-data 요청을 테스트하기 위한 helper
  // 실제 FormData 파싱 대신 request.formData()를 spy 하여 필요한 필드만 주입한다
  function makeMultipartRequest(): NextRequest {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=boundary",
      },
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
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    mockProfileUpdate.mockReturnValue({ eq: mockProfileEq });
    mockProfileEq.mockResolvedValue({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
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
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-id", email: "test@example.com" } },
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

  // TC-01: 프로필 이미지 포함 회원가입 성공 응답 반환
  it("TC-01. 프로필 이미지 포함 회원가입 성공 시 성공 응답을 반환한다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);

    // contract 검증
    expect(body.data.email).toBe("test@example.com");
    expect(body.data.redirectTo).toBe(ROUTES.LOGIN);
  });

  // TC-02: avatarFile 제공 시 storage.upload 호출
  it("TC-02. avatarFile가 포함된 요청 시 storage.upload가 1회 호출된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
  });

  // TC-03: upload 경로로 getPublicUrl 호출
  it("TC-03. upload 경로로 getPublicUrl이 1회 호출된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockGetPublicUrl).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledWith(MOCK_UPLOAD_PATH);
  });

  // TC-04: 생성된 public URL로 avatar_url 업데이트
  it("TC-04. 생성된 public URL로 profiles 테이블의 avatar_url이 업데이트된다", async () => {
    await POST(makeMultipartRequest());

    expect(mockProfileUpdate).toHaveBeenCalledTimes(1);
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: MOCK_PUBLIC_URL }),
    );
  });
});

describe("PR-API-08 프로필 이미지 업로드 실패 시 회원가입 성공 유지", () => {
  const mockSignUp = vi.fn();
  const mockStorageUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockProfileUpdate = vi.fn();

  function makeMultipartRequest(): NextRequest {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=boundary",
      },
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
    vi.mocked(getUserByEmail).mockResolvedValue(null);
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
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
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-id", email: "test@example.com" } },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({
      data: null,
      error: { message: "upload failed" },
    });
  });

  // TC-01: 이미지 업로드 실패 시에도 회원 가입 성공 유지
  it("TC-01. 업로드 실패 시에도 회원가입은 200 성공 응답 계약을 유지한다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    // 업로드 실패는 회원가입 자체를 실패시키지 않는 부수효과 실패로 취급한다
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);

    expect(body.data.email).toBe("test@example.com");
    expect(body.data.redirectTo).toBe(ROUTES.LOGIN);
  });

  // TC-02: 업로드 실패 시 getPublicUrl 미호출
  it("TC-02. 업로드 실패 시 getPublicUrl은 호출되지 않는다", async () => {
    await POST(makeMultipartRequest());

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockGetPublicUrl).toHaveBeenCalledTimes(0);
  });

  // TC-03: 업로드 실패 시 profile update 미호출
  it("TC-03. 업로드 실패 시 profiles 테이블 업데이트는 호출되지 않는다", async () => {
    await POST(makeMultipartRequest());

    expect(mockProfileUpdate).toHaveBeenCalledTimes(0);
  });

  // TC-04: 응답 data에 avatar_url 미포함
  it("TC-04. 업로드 실패 시 응답 data에 avatar_url이 포함되지 않는다", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(body.data).not.toHaveProperty("avatar_url");
  });
});
