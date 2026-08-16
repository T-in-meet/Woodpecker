import { AdminAiSettingListQuery } from "../types/ai-settings-list";

export const ADMIN_AI_SETTINGS_QUERY_KEY = {
  all: ["admin", "ai", "settings"] as const,

  list: (query: AdminAiSettingListQuery) =>
    [...ADMIN_AI_SETTINGS_QUERY_KEY.all, "list", query] as const,

  detail: (settingId: string) =>
    [...ADMIN_AI_SETTINGS_QUERY_KEY.all, "detail", settingId] as const,

  byKey: (key: string) =>
    [...ADMIN_AI_SETTINGS_QUERY_KEY.all, "by-key", key] as const,
};

export const ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY = {
  all: ["admin", "ai", "setting-configurations"] as const,

  bySetting: (settingId: string) =>
    [...ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY.all, settingId] as const,
};
