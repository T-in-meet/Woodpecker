import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_LOCAL_STORAGE_KEY,
  type AdminLocalStorageData,
} from "@/features/admin/constants/admin-local-storage";

import {
  clearAdminLocalStorage,
  getAdminLocalStorage,
  getAdminLocalStorageItem,
  removeAdminLocalStorageItem,
  setAdminLocalStorageItem,
} from "./admin-local-storage";

describe("admin-local-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getAdminLocalStorage", () => {
    it("저장된 설정이 없으면 빈 객체를 반환한다", () => {
      expect(getAdminLocalStorage()).toEqual({});
    });

    it("저장된 관리자 설정을 반환한다", () => {
      const storedData: AdminLocalStorageData = {
        sidebarOpen: true,
      };

      window.localStorage.setItem(
        ADMIN_LOCAL_STORAGE_KEY,
        JSON.stringify(storedData),
      );

      expect(getAdminLocalStorage()).toEqual(storedData);
    });

    it("저장된 값이 올바르지 않은 JSON이면 빈 객체를 반환한다", () => {
      window.localStorage.setItem(ADMIN_LOCAL_STORAGE_KEY, "{invalid-json");

      expect(getAdminLocalStorage()).toEqual({});
    });

    it.each([
      ["null", "null"],
      ["문자열", JSON.stringify("sidebar")],
      ["숫자", JSON.stringify(1)],
      ["배열", JSON.stringify([true])],
    ])("저장된 값이 %s이면 빈 객체를 반환한다", (_, storedValue) => {
      window.localStorage.setItem(ADMIN_LOCAL_STORAGE_KEY, storedValue);

      expect(getAdminLocalStorage()).toEqual({});
    });

    it("window가 없는 환경에서는 빈 객체를 반환한다", () => {
      vi.stubGlobal("window", undefined);

      expect(getAdminLocalStorage()).toEqual({});
    });
  });

  describe("getAdminLocalStorageItem", () => {
    it("지정한 관리자 설정값을 반환한다", () => {
      window.localStorage.setItem(
        ADMIN_LOCAL_STORAGE_KEY,
        JSON.stringify({
          sidebarOpen: false,
        } satisfies AdminLocalStorageData),
      );

      expect(getAdminLocalStorageItem("sidebarOpen")).toBe(false);
    });

    it("설정값이 없으면 undefined를 반환한다", () => {
      expect(getAdminLocalStorageItem("sidebarOpen")).toBeUndefined();
    });
  });

  describe("setAdminLocalStorageItem", () => {
    it("지정한 관리자 설정값을 저장한다", () => {
      setAdminLocalStorageItem("sidebarOpen", true);

      expect(
        JSON.parse(
          window.localStorage.getItem(ADMIN_LOCAL_STORAGE_KEY) ?? "{}",
        ),
      ).toEqual({
        sidebarOpen: true,
      });
    });

    it("기존 관리자 설정을 유지하며 지정한 값만 변경한다", () => {
      window.localStorage.setItem(
        ADMIN_LOCAL_STORAGE_KEY,
        JSON.stringify({
          sidebarOpen: false,
        } satisfies AdminLocalStorageData),
      );

      setAdminLocalStorageItem("sidebarOpen", true);

      expect(getAdminLocalStorage()).toEqual({
        sidebarOpen: true,
      });
    });

    it("기존 저장값이 손상되어 있으면 새 설정으로 초기화한다", () => {
      window.localStorage.setItem(ADMIN_LOCAL_STORAGE_KEY, "{invalid-json");

      setAdminLocalStorageItem("sidebarOpen", true);

      expect(getAdminLocalStorage()).toEqual({
        sidebarOpen: true,
      });
    });

    it("window가 없는 환경에서는 저장을 시도하지 않는다", () => {
      vi.stubGlobal("window", undefined);

      expect(() => {
        setAdminLocalStorageItem("sidebarOpen", true);
      }).not.toThrow();
    });
  });

  describe("removeAdminLocalStorageItem", () => {
    it("지정한 관리자 설정값을 제거한다", () => {
      window.localStorage.setItem(
        ADMIN_LOCAL_STORAGE_KEY,
        JSON.stringify({
          sidebarOpen: true,
        } satisfies AdminLocalStorageData),
      );

      removeAdminLocalStorageItem("sidebarOpen");

      expect(getAdminLocalStorage()).toEqual({});
    });

    it("제거할 설정이 없어도 오류가 발생하지 않는다", () => {
      expect(() => {
        removeAdminLocalStorageItem("sidebarOpen");
      }).not.toThrow();

      expect(getAdminLocalStorage()).toEqual({});
    });

    it("window가 없는 환경에서는 제거를 시도하지 않는다", () => {
      vi.stubGlobal("window", undefined);

      expect(() => {
        removeAdminLocalStorageItem("sidebarOpen");
      }).not.toThrow();
    });
  });

  describe("clearAdminLocalStorage", () => {
    it("관리자 localStorage 설정 전체를 제거한다", () => {
      window.localStorage.setItem(
        ADMIN_LOCAL_STORAGE_KEY,
        JSON.stringify({
          sidebarOpen: true,
        } satisfies AdminLocalStorageData),
      );

      clearAdminLocalStorage();

      expect(window.localStorage.getItem(ADMIN_LOCAL_STORAGE_KEY)).toBeNull();
    });

    it("window가 없는 환경에서는 전체 제거를 시도하지 않는다", () => {
      vi.stubGlobal("window", undefined);

      expect(() => {
        clearAdminLocalStorage();
      }).not.toThrow();
    });
  });
});
