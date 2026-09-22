import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { changePasswordActionMock, startSetPasswordFromMypageActionMock } =
  vi.hoisted(() => ({
    changePasswordActionMock: vi.fn(),
    startSetPasswordFromMypageActionMock: vi.fn(),
  }));

vi.mock("../actions", () => ({
  changePasswordAction: changePasswordActionMock,
}));

vi.mock(
  "@/features/auth/set-password/actions/startSetPasswordFromMypageAction",
  () => ({
    startSetPasswordFromMypageAction: startSetPasswordFromMypageActionMock,
  }),
);

import { AccountSection } from "../components/AccountSection";

describe("AccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changePasswordActionMock.mockResolvedValue(null);
    startSetPasswordFromMypageActionMock.mockResolvedValue(undefined);
  });

  describe("비밀번호 로그인이 연결된 계정", () => {
    it("비밀번호 변경 폼을 보여준다", () => {
      render(<AccountSection hasPasswordLogin />);

      expect(
        screen.getByRole("heading", { name: "비밀번호 변경" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("현재 비밀번호")).toBeInTheDocument();
      expect(screen.getByLabelText("새 비밀번호")).toBeInTheDocument();
      expect(screen.getByLabelText("새 비밀번호 확인")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "비밀번호 변경" }),
      ).toBeInTheDocument();
    });

    it("비밀번호 설정 안내와 버튼은 보여주지 않는다", () => {
      render(<AccountSection hasPasswordLogin />);

      expect(
        screen.queryByRole("button", { name: "비밀번호 설정하기" }),
      ).not.toBeInTheDocument();
    });

    it("제출하면 changePasswordAction을 호출한다", async () => {
      const user = userEvent.setup();
      render(<AccountSection hasPasswordLogin />);

      await user.type(screen.getByLabelText("현재 비밀번호"), "current-pw");
      await user.type(screen.getByLabelText("새 비밀번호"), "new-password");
      await user.type(
        screen.getByLabelText("새 비밀번호 확인"),
        "new-password",
      );
      await user.click(screen.getByRole("button", { name: "비밀번호 변경" }));

      expect(changePasswordActionMock).toHaveBeenCalledTimes(1);

      const formData = changePasswordActionMock.mock.calls[0]?.[1] as FormData;
      expect(formData.get("currentPassword")).toBe("current-pw");
      expect(formData.get("newPassword")).toBe("new-password");
      expect(formData.get("confirmNewPassword")).toBe("new-password");
    });
  });

  describe("소셜 로그인만 연결된 계정", () => {
    it("비밀번호 변경 폼 대신 설정 안내와 시작 버튼을 보여준다", () => {
      render(<AccountSection hasPasswordLogin={false} />);

      expect(
        screen.getByRole("heading", { name: "비밀번호 설정" }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("현재 비밀번호")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "비밀번호 변경" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "비밀번호 설정하기" }),
      ).toBeInTheDocument();
    });

    it("비밀번호 설정하기를 누르면 서버의 Set Password 시작 Action을 호출한다", async () => {
      const user = userEvent.setup();

      render(<AccountSection hasPasswordLogin={false} />);

      await user.click(
        screen.getByRole("button", { name: "비밀번호 설정하기" }),
      );

      expect(startSetPasswordFromMypageActionMock).toHaveBeenCalledTimes(1);
    });
  });
});
