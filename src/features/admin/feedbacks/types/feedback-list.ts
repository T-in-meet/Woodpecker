import type { AdminListToolbarFilters } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminSearchValue } from "@/features/admin/types/search";

export type FeedbackCategory = "BUG" | "FEATURE" | "ETC";

export type FeedbackStatus = "OPEN" | "RESOLVED";

export type FeedbackSearchField = "title" | "content" | "user";

export type FeedbackFilterField =
  | "category"
  | "status"
  | "createdAt"
  | "hasImages"
  | "noteLinked";

export interface AdminFeedbackListQuery {
  page: number;
  pageSize: number;
  search: AdminSearchValue<FeedbackSearchField>;
  filters: AdminListToolbarFilters<FeedbackFilterField>;
}

export interface AdminFeedbackListItem {
  id: string;
  userId: string;
  userLabel: string;
  userEmail: string | null;
  noteId: string | null;
  noteTitle: string | null;
  category: FeedbackCategory;
  status: FeedbackStatus;
  title: string;
  contentPreview: string;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeedbackListResult {
  items: AdminFeedbackListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
