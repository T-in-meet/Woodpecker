"use client";

import { useEffect } from "react";

/**
 * admin 레이아웃 진입 시 body 스크롤을 잠그고,
 * scrollbar-gutter로 예약된 여백을 해제하는 컴포넌트입니다.
 *
 * - AdminLayout은 자체적으로 header/sidebar를 고정하고 main 영역만 스크롤되도록 구성되어 있어, body 자체의
 *   스크롤은 불필요하고 오히려 이중 스크롤처럼 보이는 원인이 되므로 잠급니다.
 * - globals.css에서 html에 scrollbar-gutter: stable이
 *   전역으로 적용되어 있는데, admin 페이지는 스크롤바가 생기지 않으므로 예약된 자리가 빈 여백(세로줄)으로
 *   보이는 문제가 있었습니다. admin-no-gutter 클래스로 이 페이지에서만 해당 속성을 해제합니다.
 * - 다른 페이지(admin이 아닌 페이지)의 body 스크롤에는 영향을 주지 않기 위해, AdminLayout이 마운트된 동안만
 *   클래스를 추가하고 언마운트 시 정리(cleanup)합니다.
 */
export function AdminBodyOverflowLock() {
  useEffect(() => {
    // admin 진입 시 body 스크롤 잠금 + gutter 여백 해제
    document.body.classList.add("overflow-hidden");
    document.documentElement.classList.add("admin-no-gutter");

    return () => {
      // admin을 벗어나면 원래 상태로 복구
      document.body.classList.remove("overflow-hidden");
      document.documentElement.classList.remove("admin-no-gutter");
    };
  }, []);

  // 화면에 아무것도 렌더링하지 않는 순수 side-effect 컴포넌트
  return null;
}
