import type { AdminListToolbarFilters } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminSearchValue } from "@/features/admin/types/search";
import type { AdminSort } from "@/features/admin/types/sort";

export type AdminAiSettingSearchField = "displayName" | "key" | "agent";

export type AdminAiSettingFilterField =
  | "chatModel"
  | "chatConfigurationCount"
  | "embeddingModel"
  | "embeddingConfigurationCount"
  | "createdAt"
  | "updatedAt";

export type AdminAiSettingSortField =
  | "displayName"
  | "key"
  | "createdAt"
  | "updatedAt";

export type AdminAiSettingBadgeItem = {
  id: string;
  displayName: string;
};

export type AdminAiSettingListItem = {
  id: string;

  displayName: string;

  key: string;

  agents: AdminAiSettingBadgeItem[];

  chatModels: AdminAiSettingBadgeItem[];

  embeddingModels: AdminAiSettingBadgeItem[];

  chatConfigurationCount: number;

  embeddingConfigurationCount: number;

  createdAt: string;

  updatedAt: string;
};

export type AdminAiSettingListQuery = {
  page: number;

  pageSize: number;

  search: AdminSearchValue<AdminAiSettingSearchField>;

  filters: AdminListToolbarFilters<AdminAiSettingFilterField>;

  sort: AdminSort<AdminAiSettingSortField>;
};

export type AdminAiSettingListResult = {
  items: AdminAiSettingListItem[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
