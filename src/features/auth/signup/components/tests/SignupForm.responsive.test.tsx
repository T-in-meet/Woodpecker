import { screen, waitFor, within } from "@testing-library/react";
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
    it("TC-01: agreements 컨테이너가 grid-cols-1 md:grid-cols-2 반응형 클래스를 갖는다", () => {
      renderSignupForm();

      const container = screen.getByTestId("agreements-container");

      expect(container).toHaveClass("grid-cols-1");
      expect(container).toHaveClass("md:grid-cols-2");
    });
  });

  // 각 agreement 항목 내부 레이아웃
  // - 버튼, 텍스트, 체크박스의 상대 배치와 방향 전환 검증
  describe("각 agreement 항목 내부 레이아웃", () => {
    // — flex-col lg:flex-row 클래스가 동시에 존재해야 모든 breakpoint를 커버
    it("TC-02: 이용약관 항목 내부가 flex-col lg:flex-row 반응형 클래스를 갖는다", () => {
      renderSignupForm();

      const innerRow = screen.getByTestId("tos-inner-row");

      expect(innerRow).toHaveClass("flex-col");
      expect(innerRow).toHaveClass("lg:flex-row");
    });

    it("TC-03: 이용약관 텍스트와 checkbox가 동일한 그룹 컨테이너 안에 있다", () => {
      renderSignupForm();

      const group = screen.getByTestId("tos-text-checkbox-group");

      expect(
        within(group).getByText("이용약관에 동의합니다"),
      ).toBeInTheDocument();
      expect(
        within(group).getByRole("checkbox", { name: /이용약관/i }),
      ).toBeInTheDocument();
    });

    it("TC-04: 이용약관 보기 버튼이 텍스트+checkbox 그룹보다 앞에 위치한다", () => {
      renderSignupForm();

      const tosButton = screen.getByRole("button", { name: /이용약관 보기/i });
      const textCheckboxGroup = screen.getByTestId("tos-text-checkbox-group");

      expect(
        tosButton.compareDocumentPosition(textCheckboxGroup) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  // 하단 액션 영역
  // - 작은 화면에서도 액션 요소가 줄바꿈 가능한지 확인
  describe("하단 액션 영역", () => {
    it("TC-05: 하단 액션 컨테이너에 flex-wrap 클래스가 적용된다", () => {
      renderSignupForm();

      const actionArea = screen.getByTestId("form-action-area");

      expect(actionArea).toHaveClass("flex-wrap");
    });
  });

  // 기존 동작 유지
  // - 반응형 클래스 추가 후 validation/submit 동작이 깨지지 않았는지 확인
  describe("기존 동작 유지", () => {
    it("TC-06: 기존 form validation / submit 동작이 그대로 유지된다", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderSignupForm({ onSubmit });

      await user.type(screen.getByLabelText(/이메일/i), "test@example.com");
      await user.type(screen.getByLabelText(/^비밀번호$/i), "12345678");
      await user.type(screen.getByLabelText(/비밀번호 확인/i), "12345678");
      await user.type(screen.getByLabelText(/닉네임/i), "tester");
      await user.click(screen.getByRole("checkbox", { name: /이용약관/i }));
      await user.click(screen.getByRole("checkbox", { name: /개인정보/i }));

      await user.click(screen.getByRole("button", { name: /^회원가입$/i }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });
});
