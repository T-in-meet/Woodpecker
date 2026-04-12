import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { issueAuthEmailLinkAndSend } from "../issueAuthEmailLinkAndSend";
import { sendAuthEmail } from "../sendAuthEmail";

vi.mock("@/lib/supabase/admin");
vi.mock("../sendAuthEmail");

const TEST_EMAIL = "test@example.com";
const TEST_TOKEN_HASH = "hashed-token-abc";

const mockGenerateLink = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(createAdminClient).mockReturnValue({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  } as never);

  mockGenerateLink.mockResolvedValue({
    data: {
      properties: {
        hashed_token: TEST_TOKEN_HASH,
      },
    },
    error: null,
  });

  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
});

describe("issueAuthEmailLinkAndSend", () => {
  it("TC-01. generateLink를 호출하고 sendAuthEmail에 hashed_token을 전달한다", async () => {
    await issueAuthEmailLinkAndSend({
      type: "magiclink",
      email: TEST_EMAIL,
    });

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: TEST_EMAIL,
    });
    expect(sendAuthEmail).toHaveBeenCalledTimes(1);
    expect(sendAuthEmail).toHaveBeenCalledWith(
      TEST_EMAIL,
      TEST_TOKEN_HASH,
      "magiclink",
    );
  });

  it("TC-02. generateLink 에러는 throw한다", async () => {
    mockGenerateLink.mockResolvedValueOnce({
      data: null,
      error: { message: "generate failed" },
    });

    await expect(
      issueAuthEmailLinkAndSend({
        type: "signup",
        email: TEST_EMAIL,
        password: "Password123!",
      }),
    ).rejects.toThrow("generate failed");
  });

  it("TC-03. hashed_token 누락은 throw한다", async () => {
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: null,
    });

    await expect(
      issueAuthEmailLinkAndSend({
        type: "signup",
        email: TEST_EMAIL,
        password: "Password123!",
      }),
    ).rejects.toThrow("Missing hashed_token from generateLink");
  });

  it("TC-04. sendAuthEmail 실패는 상위로 전파한다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValueOnce(new Error("smtp failed"));

    await expect(
      issueAuthEmailLinkAndSend({
        type: "magiclink",
        email: TEST_EMAIL,
      }),
    ).rejects.toThrow("smtp failed");
  });
});
