import type { AdminAppliedFilter } from "@/features/admin/types/filter";
import type { AdminSearchValue } from "@/features/admin/types/search";

import type { ComponentPlaygroundFilterField } from "../constants/filters";
import type { ComponentPlaygroundSearchField } from "../constants/search";
import type { MockUser } from "./mock-user";

export type GetMockUsersFilters = Partial<
  Record<
    ComponentPlaygroundFilterField,
    AdminAppliedFilter<ComponentPlaygroundFilterField>
  >
>;

export interface GetMockUsersParams {
  page: number;

  pageSize: number;

  search: AdminSearchValue<ComponentPlaygroundSearchField>;

  filters: GetMockUsersFilters;
}

export interface GetMockUsersResult {
  items: MockUser[];

  pagination: {
    page: number;

    pageSize: number;

    total: number;

    totalPages: number;
  };
}
