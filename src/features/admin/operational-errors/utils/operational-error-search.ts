import { createAdminClient } from "@/lib/supabase/admin";

import { OperationalErrorListQuery } from "../types/operational-error-list";
import { escapePostgrestLikePattern } from "./operational-error-query";

export function applyOperationalErrorSearch(
  query: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  search: OperationalErrorListQuery["search"],
) {
  const normalizedQuery = search.query.trim();

  if (normalizedQuery.length === 0) {
    return query;
  }

  const pattern = `%${escapePostgrestLikePattern(normalizedQuery)}%`;

  if (search.field === "errorCode") {
    return query.ilike("error_code", pattern);
  }

  if (search.field === "feature") {
    return query.ilike("feature", pattern);
  }

  if (search.field === "operation") {
    return query.ilike("operation", pattern);
  }

  if (search.field === "stage") {
    return query.ilike("stage", pattern);
  }

  return query.ilike("message", pattern);
}
