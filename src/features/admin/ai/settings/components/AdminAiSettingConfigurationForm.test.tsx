import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UseFormRegister } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiSettingConfigurationFormValues } from "../types";
import { AdminAiSettingConfigurationForm } from "./AdminAiSettingConfigurationForm";

const useAdminAiSettingConfigurationsMock = vi.hoisted(() => vi.fn());
const useSaveAdminAiSettingConfigurationsMock = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());
const mutateMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin/components/common/AdminAlertDialog", () => ({
  AdminAlertDialog: ({
    cancelLabel,
    confirmLabel,
    onConfirm,
    onOpenChange,
    open,
    pending,
    title,
  }: {
    /** 취소 버튼 라벨입니다. */
    cancelLabel: string;

    /** 확인 버튼 라벨입니다. */
    confirmLabel: string;

    /** 확인 버튼을 눌렀을 때 실행할 함수입니다. */
    onConfirm: () => void;

    /** 다이얼로그 열림 상태 변경 함수입니다. */
    onOpenChange: (open: boolean) => void;

    /** 다이얼로그 열림 상태입니다. */
    open: boolean;

    /** 확인 처리 대기 상태입니다. */
    pending: boolean;

    /** 다이얼로그 제목입니다. */
    title: string;
  }) =>
    open ? (
      <div role="alertdialog" aria-label={title}>
        <button type="button" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
        <button type="button" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("../hooks/use-admin-ai-setting-configuration-queries", () => ({
  useAdminAiSettingConfigurations: useAdminAiSettingConfigurationsMock,
}));

vi.mock("../hooks/use-admin-ai-setting-configuration-mutations", () => ({
  useSaveAdminAiSettingConfigurations: useSaveAdminAiSettingConfigurationsMock,
}));

vi.mock("./AdminAiSettingConfigurationsSection", async () => {
  const { useFormContext } =
    await vi.importActual<typeof import("react-hook-form")>("react-hook-form");

  return {
    AdminAiSettingConfigurationsSection: ({
      fields,
      onRemove,
      showRelatedNotesEmbeddingNotice,
    }: {
      /** 테스트에서 렌더링할 필드 배열입니다. */
      fields: {
        /** React Hook Form 필드 ID입니다. */
        fieldArrayId: string;
      }[];

      /** 지정한 index의 구성을 제거하는 함수입니다. */
      onRemove: (index: number) => void;

      /** Related Notes Embedding 안내 표시 여부입니다. */
      showRelatedNotesEmbeddingNotice?: boolean;
    }) => {
      const { register } =
        useFormContext<AdminAiSettingConfigurationFormValues>();
      const typedRegister: UseFormRegister<AdminAiSettingConfigurationFormValues> =
        register;

      return (
        <section aria-label="setting configurations">
          {showRelatedNotesEmbeddingNotice && (
            <span data-testid="related-notes-embedding-notice" />
          )}

          {fields.map((field, index) => (
            <div key={field.fieldArrayId}>
              <input
                aria-label={`role-key-${index}`}
                {...typedRegister(`configurations.${index}.roleKey`)}
              />
              <button type="button" onClick={() => onRemove(index)}>
                remove-{index}
              </button>
            </div>
          ))}
        </section>
      );
    },
  };
});

/** useAdminAiSettingConfigurations 테스트 double이 반환하는 최소 Query 결과입니다. */
type AdminAiSettingConfigurationsQueryState = {
  /** 조회된 AI 설정 구성 목록입니다. */
  data?: AdminAiSettingConfigurationFormValues["configurations"];

  /** 조회 오류입니다. */
  error: Error | null;

  /** 최초 조회 대기 상태입니다. */
  isPending: boolean;

  /** 구성 Query를 수동으로 다시 실행하는 함수입니다. */
  refetch: () => Promise<unknown>;
};

/**
 * 구성 Query 훅 mock의 다음 반환값을 설정합니다.
 *
 * @param state 테스트에 사용할 Query 상태
 */
function mockConfigurationsQueryState(
  state: AdminAiSettingConfigurationsQueryState,
) {
  useAdminAiSettingConfigurationsMock.mockReturnValue(state);
}

describe("AdminAiSettingConfigurationForm", () => {
  beforeEach(() => {
    useAdminAiSettingConfigurationsMock.mockReset();
    useSaveAdminAiSettingConfigurationsMock.mockReset();
    refetchMock.mockReset();
    refetchMock.mockResolvedValue({ data: undefined });
    useSaveAdminAiSettingConfigurationsMock.mockReturnValue({
      isPending: false,
      mutate: mutateMock,
    });
    mutateMock.mockReset();
  });

  it("구성 조회 오류 상태에서 다시 시도 버튼을 누르면 AI 설정 구성 Query를 다시 실행한다", async () => {
    const user = userEvent.setup();

    mockConfigurationsQueryState({
      error: new Error("setting configurations failed"),
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiSettingConfigurationForm
        settingId="11111111-1111-4111-8111-111111111111"
        settingKey="note-chat"
      />,
    );

    await user.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it("Related Notes 설정이면 Embedding 안내 표시 상태를 전달한다", () => {
    mockConfigurationsQueryState({
      data: [],
      error: null,
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiSettingConfigurationForm
        settingId="11111111-1111-4111-8111-111111111111"
        settingKey="related-notes"
      />,
    );

    expect(
      screen.getByTestId("related-notes-embedding-notice"),
    ).toBeInTheDocument();
  });

  it("가운데 구성을 삭제해도 남은 구성의 Role Key 변경 경고를 열지 않고 저장한다", async () => {
    const user = userEvent.setup();

    mockConfigurationsQueryState({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          kind: "embedding",
          roleKey: "a",
          modelConfigId: "11111111-1111-4111-8111-111111111111",
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "embedding",
          roleKey: "b",
          modelConfigId: "22222222-2222-4222-8222-222222222222",
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          kind: "embedding",
          roleKey: "c",
          modelConfigId: "33333333-3333-4333-8333-333333333333",
        },
      ],
      error: null,
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiSettingConfigurationForm
        settingId="11111111-1111-4111-8111-111111111111"
        settingKey="note-chat"
      />,
    );

    await user.click(screen.getByRole("button", { name: "remove-1" }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(
      screen.queryByRole("alertdialog", {
        name: "Role Key를 변경하시겠습니까?",
      }),
    ).not.toBeInTheDocument();
    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configurations: [
          expect.objectContaining({ roleKey: "a" }),
          expect.objectContaining({ roleKey: "c" }),
        ],
      }),
      expect.any(Object),
    );
  });

  it("기존 구성의 같은 id에서 Role Key가 바뀌면 경고를 열고 취소 시 보류 값을 비운다", async () => {
    const user = userEvent.setup();

    mockConfigurationsQueryState({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          kind: "embedding",
          roleKey: "a",
          modelConfigId: "11111111-1111-4111-8111-111111111111",
        },
      ],
      error: null,
      isPending: false,
      refetch: refetchMock,
    });

    render(
      <AdminAiSettingConfigurationForm
        settingId="11111111-1111-4111-8111-111111111111"
        settingKey="note-chat"
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: "role-key-0" }));
    await user.type(screen.getByRole("textbox", { name: "role-key-0" }), "z");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(
      screen.getByRole("alertdialog", {
        name: "Role Key를 변경하시겠습니까?",
      }),
    ).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(
      screen.queryByRole("alertdialog", {
        name: "Role Key를 변경하시겠습니까?",
      }),
    ).not.toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
