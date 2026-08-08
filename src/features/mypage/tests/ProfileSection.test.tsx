import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    replace: replaceMock,
  }),
  usePathname: () => "/mypage",
  useSearchParams: () =>
    new URLSearchParams("section=profile&profile_nickname=fallback"),
}));

vi.mock("../actions", () => ({
  deleteAvatarAction: vi.fn(),
  updateProfileAction: vi.fn(),
  uploadAvatarAction: vi.fn(),
}));

import { ProfileSection } from "../components/ProfileSection";

const profile = {
  nickname: "GoogleName",
  avatar_url: null,
  role: "USER" as const,
  created_at: "2026-03-01T00:00:00.000Z",
};

describe("ProfileSection", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    replaceMock.mockReset();
  });

  it("provider 이름으로 nickname이 설정된 경우 안내 문구를 표시한다", () => {
    render(
      <ProfileSection
        profile={profile}
        email="user@example.com"
        nicknameNotice="provider"
      />,
    );

    expect(
      screen.getByText(
        "Google 계정 이름으로 닉네임이 설정되었습니다. 언제든 변경할 수 있습니다.",
      ),
    ).toBeInTheDocument();
  });

  it("fallback nickname이 생성된 경우 안내 문구를 표시한다", () => {
    render(
      <ProfileSection
        profile={{ ...profile, nickname: "user_abcde" }}
        email="user@example.com"
        nicknameNotice="fallback"
      />,
    );

    expect(
      screen.getByText(
        "기본 닉네임이 생성되었습니다. 프로필에서 원하는 닉네임으로 변경할 수 있습니다.",
      ),
    ).toBeInTheDocument();
  });

  it("닉네임 안내를 닫으면 화면에서 숨기고 query를 제거한다", async () => {
    const user = userEvent.setup();

    render(
      <ProfileSection
        profile={{ ...profile, nickname: "user_abcde" }}
        email="user@example.com"
        nicknameNotice="fallback"
      />,
    );

    await user.click(screen.getByRole("button", { name: "닉네임 안내 닫기" }));

    expect(
      screen.queryByText(
        "기본 닉네임이 생성되었습니다. 프로필에서 원하는 닉네임으로 변경할 수 있습니다.",
      ),
    ).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/mypage?section=profile", {
      scroll: false,
    });
  });
});
