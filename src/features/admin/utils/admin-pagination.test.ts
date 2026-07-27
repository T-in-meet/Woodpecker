import { describe, expect, it } from "vitest";

import { ADMIN_PAGINATION } from "../constants/admin-pagination";
import { getAdminPagination } from "./admin-pagination";

describe("getAdminPagination", () => {
  it("전체 데이터가 없으면 빈 페이지네이션 정보를 반환한다", () => {
    const result = getAdminPagination({
      currentPage: 1,
      totalCount: 0,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result).toEqual({
      currentPage: ADMIN_PAGINATION.FIRST_PAGE,
      totalPages: ADMIN_PAGINATION.EMPTY_TOTAL_PAGES,
      pages: [],
      firstPage: ADMIN_PAGINATION.FIRST_PAGE,
      lastPage: ADMIN_PAGINATION.FIRST_PAGE,
      previousPage: ADMIN_PAGINATION.FIRST_PAGE,
      nextPage: ADMIN_PAGINATION.FIRST_PAGE,
      previousPageGroup: ADMIN_PAGINATION.FIRST_PAGE,
      nextPageGroup: ADMIN_PAGINATION.FIRST_PAGE,
      hasPreviousPage: false,
      hasNextPage: false,
      hasPreviousPageGroup: false,
      hasNextPageGroup: false,
    });
  });

  it("첫 페이지의 페이지네이션 정보를 계산한다", () => {
    const result = getAdminPagination({
      currentPage: 1,
      totalCount: 237,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.currentPage).toBe(1);
    expect(result.totalPages).toBe(24);
    expect(result.pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.previousPage).toBe(1);
    expect(result.nextPage).toBe(2);
    expect(result.previousPageGroup).toBe(1);
    expect(result.nextPageGroup).toBe(11);
    expect(result.hasPreviousPage).toBe(false);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPageGroup).toBe(false);
    expect(result.hasNextPageGroup).toBe(true);
  });

  it("중간 페이지의 페이지네이션 정보를 계산한다", () => {
    const result = getAdminPagination({
      currentPage: 17,
      totalCount: 237,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.currentPage).toBe(17);
    expect(result.totalPages).toBe(24);
    expect(result.pages).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(result.previousPage).toBe(16);
    expect(result.nextPage).toBe(18);
    expect(result.previousPageGroup).toBe(1);
    expect(result.nextPageGroup).toBe(21);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPageGroup).toBe(true);
    expect(result.hasNextPageGroup).toBe(true);
  });

  it("마지막 페이지의 페이지네이션 정보를 계산한다", () => {
    const result = getAdminPagination({
      currentPage: 24,
      totalCount: 237,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.currentPage).toBe(24);
    expect(result.totalPages).toBe(24);
    expect(result.pages).toEqual([21, 22, 23, 24]);
    expect(result.previousPage).toBe(23);
    expect(result.nextPage).toBe(24);
    expect(result.previousPageGroup).toBe(11);
    expect(result.nextPageGroup).toBe(24);
    expect(result.hasPreviousPage).toBe(true);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPageGroup).toBe(true);
    expect(result.hasNextPageGroup).toBe(false);
  });

  it("현재 페이지가 전체 페이지보다 크면 마지막 페이지로 보정한다", () => {
    const result = getAdminPagination({
      currentPage: 999,
      totalCount: 45,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.currentPage).toBe(5);
    expect(result.pages).toEqual([1, 2, 3, 4, 5]);
    expect(result.lastPage).toBe(5);
  });

  it("현재 페이지가 1보다 작으면 첫 페이지로 보정한다", () => {
    const result = getAdminPagination({
      currentPage: -10,
      totalCount: 45,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.currentPage).toBe(1);
    expect(result.previousPage).toBe(1);
    expect(result.hasPreviousPage).toBe(false);
  });

  it("소수로 전달된 값은 정수로 보정한다", () => {
    const result = getAdminPagination({
      currentPage: 2.9,
      totalCount: 45.8,
      pageSize: 10.9,
      pageCount: 3.9,
    });

    expect(result.currentPage).toBe(2);
    expect(result.totalPages).toBe(5);
    expect(result.pages).toEqual([1, 2, 3]);
  });

  it("유효하지 않은 pageSize는 공통 기본값으로 보정한다", () => {
    const result = getAdminPagination({
      currentPage: 1,
      totalCount: 100,
      pageSize: 0,
      pageCount: 10,
    });

    expect(result.totalPages).toBe(
      Math.ceil(100 / ADMIN_PAGINATION.DEFAULT_PAGE_SIZE),
    );
  });

  it("유효하지 않은 pageCount는 공통 기본값으로 보정한다", () => {
    const result = getAdminPagination({
      currentPage: 1,
      totalCount: 200,
      pageSize: 10,
      pageCount: 0,
    });

    expect(result.pages).toEqual(
      Array.from(
        { length: ADMIN_PAGINATION.DEFAULT_PAGE_COUNT },
        (_, index) => index + ADMIN_PAGINATION.FIRST_PAGE,
      ),
    );
  });

  it("유효하지 않은 전체 데이터 개수는 0으로 보정한다", () => {
    const result = getAdminPagination({
      currentPage: 1,
      totalCount: Number.NaN,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.totalPages).toBe(ADMIN_PAGINATION.EMPTY_TOTAL_PAGES);
    expect(result.pages).toEqual([]);
  });

  it("페이지 개수가 pageCount보다 작으면 존재하는 페이지만 반환한다", () => {
    const result = getAdminPagination({
      currentPage: 1,
      totalCount: 45,
      pageSize: 10,
      pageCount: 10,
    });

    expect(result.totalPages).toBe(5);
    expect(result.pages).toEqual([1, 2, 3, 4, 5]);
    expect(result.hasNextPageGroup).toBe(false);
  });
});
