import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { noStoreFetch } from "./no-cache-fetch";

/**
 * Service-role client — bypasses RLS. SERVER ONLY.
 * Used for customer-facing operations (writing selections, reading published
 * albums without a session) and admin user management.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key",
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Bắt buộc: Next 14 cache CẢ câu đọc lẫn câu ghi đi qua fetch, kể cả trong
      // route đã khai force-dynamic. Xem ./no-cache-fetch để biết đã đo thế nào.
      global: { fetch: noStoreFetch },
    }
  );
}
