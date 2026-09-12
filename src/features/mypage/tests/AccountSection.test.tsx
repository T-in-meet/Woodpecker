import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const changePasswordActionMock = vi.hoisted(() => vi.fn());

vi.mock("../actions", () => ({
  changePasswordAction: changePasswordActionMock,
}));

import { AccountSection } from "../components/AccountSection";

describe("AccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changePasswordActionMock.mockResolvedValue(null);
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

    it("비밀번호 설정 안내와 링크는 보여주지 않는다", () => {
      render(<AccountSection hasPasswordLogin />);

      expect(
        screen.queryByRole("link", { name: "비밀번호 설정하기" }),
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
    it("비밀번호 변경 폼 대신 설정 안내를 보여준다", () => {
      render(<AccountSection hasPasswordLogin={false} />);

      expect(
        screen.getByRole("heading", { name: "비밀번호 설정" }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("현재 비밀번호")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "비밀번호 변경" }),
      ).not.toBeInTheDocument();
    });

    it("계정 관리로 돌아오는 redirect를 붙여 set-password로 링크한다", () => {
      render(<AccountSection hasPasswordLogin={false} />);

      const link = screen.getByRole("link", { name: "비밀번호 설정하기" });
      expect(link).toHaveAttribute(
        "href",
        `/set-password?redirect=${encodeURIComponent("/mypage?section=profile")}`,
      );
    });
  });
});
