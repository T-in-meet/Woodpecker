import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type CreateAdminClientOptions = {
  fetch?: typeof fetch;
};

export function createAdminClient(options?: CreateAdminClientOptions) {
  if (!options?.fetch) {
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: options.fetch,
      },
    },
  );
}
