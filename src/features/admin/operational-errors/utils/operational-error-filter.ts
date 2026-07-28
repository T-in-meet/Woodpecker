import { createAdminClient } from "@/lib/supabase/admin";

import { AdminAppliedFilter } from "../../types/filter";
import {
  OperationalErrorFilterField,
  OperationalErrorListQuery,
} from "../types/operational-error-list";
import {
  nextDayIsoString,
  startOfDayIsoString,
} from "./operational-error-query";

function applyOperationalErrorFilter(
  query: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  filter: AdminAppliedFilter<OperationalErrorFilterField>,
) {
  switch (filter.field) {
    case "lastSeenAt": {
      if (filter.type !== "date-range") {
        return query;
      }

      const { from, to } = filter.value;

      if (from) {
        query = query.gte("last_seen_at", startOfDayIsoString(from));
      }

      if (to) {
        query = query.lt("last_seen_at", nextDayIsoString(to));
      }

      return query;
    }

    case "feature":
      if (filter.type === "multi-select") {
        return query.in("feature", filter.value);
      }

      return query;

    case "occurrenceCount":
      if (filter.type !== "number-range") {
        return query;
      }

      if (filter.value.min !== null) {
        query = query.gte("occurrence_count", filter.value.min);
      }

      if (filter.value.max !== null) {
        query = query.lte("occurrence_count", filter.value.max);
      }

      return query;

    case "severity":
      if (filter.type === "multi-select") {
        return query.in("severity", filter.value);
      }

      return query;

    case "status":
      if (filter.type === "multi-select") {
        return query.in("status", filter.value);
      }

      return query;

    default:
      return query;
  }
}

export function applyOperationalErrorFilters(
  query: ReturnType<ReturnType<typeof createAdminClient>["from"]>,
  filters: OperationalErrorListQuery["filters"],
) {
  let filteredQuery = query;

  for (const filter of Object.values(filters)) {
    if (filter) {
      filteredQuery = applyOperationalErrorFilter(filteredQuery, filter);
    }
  }

  return filteredQuery;
}
