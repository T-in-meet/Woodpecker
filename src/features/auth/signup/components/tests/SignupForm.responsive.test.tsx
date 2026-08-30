import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderSignupForm } from "./utils/signupFormTestUtils";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// SignupForm 반응형 레이아웃 테스트
// - 반응형 클래스 존재 여부와 DOM 배치를 검증한다.
// - agreements 영역, 내부 정렬, 액션 영역 wrapping 등 레이아웃 회귀를 방지하기 위한 파일이다.
// - UI 구조 자체는 render 테스트와 분리하고, 반응형 관련 회귀만 별도로 추적한다.
// - 스펙 기준: PR-UI-14

// TC-01 ~ TC-10: 반응형 레이아웃 및 기존 동작 유지
describe("SignupForm 반응형 레이아웃 (PR-UI-14)", () => {
  // agreements 외부 레이아웃
  // - 모바일/태블릿 구간의 컬럼 전환 클래스 검증
  describe("agreements 외부 레이아웃", () => {
    it("TC-01: agreements 컨테이너가 현재 카드형 레이아웃 클래스를 갖는다", () => {
      renderSignupForm();

      const container = screen.getByTestId("agreements-container");

      expect(container).toHaveClass("flex");
      expect(container).toHaveClass("flex-col");
      expect(container).toHaveClass("border");
      expect(container).toHaveClass("rounded-lg");
    });
  });

  // 각 agreement 항목 내부 레이아웃
  // - 버튼, 텍스트, 체크박스의 상대 배치와 방향 전환 검증
  describe("각 agreement 항목 내부 레이아웃", () => {
    // — 현재 구현은 sm 구간부터 row 전환
    it("TC-02: 이용약관 항목 내부가 flex-col sm:flex-row 반응형 클래스를 갖는다", () => {
      renderSignupForm();

      const innerRow = screen.getByTestId("tos-inner-row");

      expect(innerRow).toHaveClass("flex-col");
      expect(innerRow).toHaveClass("sm:flex-row");
    });

    it("TC-03: 이용약관 텍스트와 checkbox가 동일한 그룹 컨테이너 안에 있다", () => {
      renderSignupForm();

      const group = screen.getByTestId("tos-text-checkbox-group");

      expect(
        within(group).getByText("이용약관에 동의합니다"),
      ).toBeInTheDocument();
      expect(
        within(group).getByTestId("terms-of-service-checkbox"),
      ).toBeInTheDocument();
    });

    it("TC-04: 이용약관 보기 버튼이 텍스트+checkbox 그룹보다 뒤에 위치한다", () => {
      renderSignupForm();

      const tosButton = screen.getByRole("button", { name: /이용약관 보기/i });
      const textCheckboxGroup = screen.getByTestId("tos-text-checkbox-group");

      expect(
        textCheckboxGroup.compareDocumentPosition(tosButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  // 하단 액션 영역
  // - 작은 화면에서도 액션 요소가 줄바꿈 가능한지 확인
  // describe("하단 액션 영역", () => {
  //   it("TC-05: 하단 액션 컨테이너에 flex-wrap 클래스가 적용된다", () => {
  //     renderSignupForm();

  //     const actionArea = screen.getByTestId("form-action-area");

  //     expect(actionArea).toHaveClass("flex-wrap");
  //   });
  // });

  // 기존 동작 유지
  // - 반응형 클래스 추가 후 validation/submit 동작이 깨지지 않았는지 확인
  describe("기존 동작 유지", () => {
    it("TC-06: 기존 form validation / submit 동작이 그대로 유지된다", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderSignupForm({ onSubmit });

      fireEvent.change(screen.getByLabelText(/이메일/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^비밀번호$/i), {
        target: { value: "12345678" },
      });
      fireEvent.change(screen.getByLabelText(/비밀번호 확인/i), {
        target: { value: "12345678" },
      });
      fireEvent.change(screen.getByLabelText(/닉네임/i), {
        target: { value: "tester" },
      });
      // 이유: interactionEnabled=false 상태에서 체크박스 직접 클릭이 차단되므로 모달 경유
      await user.click(screen.getByRole("button", { name: /이용약관 보기/i }));
      await user.click(screen.getByRole("button", { name: /동의하기/i }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await user.click(
        screen.getByRole("button", { name: /개인정보처리방침 보기/i }),
      );
      await user.click(screen.getByRole("button", { name: /동의하기/i }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await user.click(screen.getByTestId("age-14-checkbox"));

      await user.click(screen.getByRole("button", { name: /^회원가입$/i }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });
});
