import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("비밀번호 표시 상태를 토글한다", async () => {
    const user = userEvent.setup();

    render(<PasswordInput aria-label="비밀번호" />);

    const input = screen.getByLabelText("비밀번호");
    const showButton = screen.getByRole("button", {
      name: "비밀번호 보기",
    });

    // 1. 최초 렌더링은 password 타입이다.
    expect(input).toHaveAttribute("type", "password");

    await user.click(showButton);

    // 2. 보기 버튼을 누르면 text 타입으로 변경된다.
    expect(input).toHaveAttribute("type", "text");

    // 3. 표시 상태에서는 접근성 속성도 함께 변경된다.
    const hideButton = screen.getByRole("button", {
      name: "비밀번호 숨기기",
    });
    expect(hideButton).toHaveAttribute("aria-pressed", "true");

    await user.click(hideButton);

    // 4. 다시 누르면 password 타입으로 복원된다.
    expect(input).toHaveAttribute("type", "password");
  });
});
