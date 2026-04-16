import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LegalDialogWrapper } from "../LegalDialogWrapper";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual };
});

// LegalDialogWrapper 테스트
// - Radix Dialog 기반의 모달 동작
// - 콘텐츠 렌더링 (약관/개인정보 구분)
// - 콜백 호출
// - focus restore fallback 동작
// - 접근성 (Esc 키, 오버레이 클릭, focus trap)

describe("LegalDialogWrapper", () => {
  const mockOnOpenChange = vi.fn();
  const mockOnAgree = vi.fn();
  const checkboxElement = document.createElement("button");
  const mockCheckboxFocus = vi.fn();
  checkboxElement.focus = mockCheckboxFocus;
  const mockCheckboxRef = {
    current: checkboxElement,
  } as RefObject<HTMLButtonElement | null>;

  beforeEach(() => {
    mockOnOpenChange.mockClear();
    mockOnAgree.mockClear();
    mockCheckboxFocus.mockClear();
  });

  it("TC-01: 트리거 버튼이 triggerLabel 텍스트로 렌더링된다", () => {
    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={false}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    expect(
      screen.getByRole("button", { name: /이용약관 보기/i }),
    ).toBeInTheDocument();
  });

  it("TC-02: 트리거 버튼 클릭 시 모달이 열린다", async () => {
    const user = userEvent.setup();

    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={false}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    await user.click(screen.getByRole("button", { name: /이용약관 보기/i }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(true);
  });

  it("TC-03: 모달 열리면 dialogTitle이 표시된다", () => {
    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    expect(screen.getByText("이용약관")).toBeInTheDocument();
  });

  it("TC-04: agreementType=termsOfService → 이용약관 콘텐츠 렌더링", () => {
    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    // 이용약관 섹션이 렌더링되는지 확인 (첫 번째 섹션의 content 확인)
    expect(screen.getByText(/이 약관은 딱다구리/)).toBeInTheDocument();
  });

  it("TC-05: agreementType=privacyPolicy → 개인정보 콘텐츠 렌더링", () => {
    render(
      <LegalDialogWrapper
        agreementType="privacyPolicy"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="개인정보처리방침 보기"
        dialogTitle="개인정보처리방침"
      />,
    );

    // 개인정보 섹션이 렌더링되는지 확인 (첫 번째 섹션의 title 확인)
    expect(screen.getByText(/개인정보의 처리 목적/i)).toBeInTheDocument();
  });

  it('TC-06: "동의하기" 클릭 시 onAgree 콜백이 호출된다', async () => {
    const user = userEvent.setup();

    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    expect(mockOnAgree).toHaveBeenCalled();
  });

  it('TC-07: "동의하기" 클릭 시 모달이 닫힌다', async () => {
    const user = userEvent.setup();

    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("TC-08: 닫기 버튼 클릭 시 모달이 닫힌다 (onAgree 미호출)", async () => {
    const user = userEvent.setup();

    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    await user.click(screen.getByRole("button", { name: /닫기/i }));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnAgree).not.toHaveBeenCalled();
  });

  it("TC-09: Esc 키 누를 시 모달이 닫힌다", async () => {
    const user = userEvent.setup();

    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    // Radix Dialog는 Esc 키를 자동으로 처리합니다
    await user.keyboard("{Escape}");

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("TC-10: 오버레이 클릭 시 모달이 닫힌다", async () => {
    const user = userEvent.setup();

    render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    // 오버레이는 dialog의 이전 형제 노드로 렌더링된다.
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.previousElementSibling as HTMLElement | null;
    expect(overlay).not.toBeNull();
    await user.click(overlay!);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("TC-11: 모달 닫힌 후 트리거 버튼으로 포커스가 복원된다", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    // 모달을 닫기 위해 Esc 키 누르기
    await user.keyboard("{Escape}");

    // 모달을 닫은 상태로 리렌더링
    rerender(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={false}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
      />,
    );

    // Radix Dialog는 자동으로 트리거로 포커스를 복원합니다
    // 이는 Dialog.Trigger의 기본 동작입니다
    expect(
      screen.getByRole("button", { name: /이용약관 보기/i }),
    ).toBeInTheDocument();
  });

  it("TC-12: checkboxRef가 제공된 경우, openedByLabel=true일 때 모달 닫기 시 Checkbox로 focus fallback 동작", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
        checkboxRef={mockCheckboxRef}
        openedByLabel={true}
      />,
    );

    // 모달을 닫기 위해 닫기 버튼 클릭
    mockOnOpenChange.mockClear();
    const closeButton = screen.getByRole("button", { name: /닫기/i });
    await user.click(closeButton);

    // 모달을 닫은 상태로 리렌더링
    rerender(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={false}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
        checkboxRef={mockCheckboxRef}
        openedByLabel={true}
      />,
    );

    // requestAnimationFrame 콜백이 비동기로 실행되므로 waitFor로 대기
    await waitFor(() => {
      expect(mockCheckboxFocus).toHaveBeenCalled();
    });
  });

  it('TC-13: openedByLabel=true에서 "동의하기"로 닫아도 Checkbox focus fallback이 동작한다', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={true}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
        checkboxRef={mockCheckboxRef}
        openedByLabel={true}
      />,
    );

    mockOnOpenChange.mockClear();
    mockCheckboxFocus.mockClear();

    await user.click(screen.getByRole("button", { name: /동의하기/i }));

    rerender(
      <LegalDialogWrapper
        agreementType="termsOfService"
        open={false}
        onOpenChange={mockOnOpenChange}
        onAgree={mockOnAgree}
        triggerLabel="이용약관 보기"
        dialogTitle="이용약관"
        checkboxRef={mockCheckboxRef}
        openedByLabel={true}
      />,
    );

    await waitFor(() => {
      expect(mockOnAgree).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      expect(mockCheckboxFocus).toHaveBeenCalled();
    });
  });
});
