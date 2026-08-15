/** 관리자 AI mutation 결과입니다. */
export type AdminAiActionResult =
  | {
      id?: string;
      message?: string;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

/** 관리자 AI 목록 페이지네이션 메타데이터입니다. */
type AdminAiListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** 관리자 AI 목록 결과입니다. */
export type AdminAiListResult<TItem> = {
  items: TItem[];
  pagination: AdminAiListPagination;
};
