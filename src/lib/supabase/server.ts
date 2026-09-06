import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cookieDomainForHost } from "@/lib/hosts";
import { noStoreFetch } from "@/lib/no-store-fetch";

/**
 * Supabase client bound to the current request's cookies (RLS-aware).
 * Use inside Server Components, Route Handlers and Server Actions.
 */
export async function createClient() {
  // Next 16: cookies() và headers() là BẤT ĐỒNG BỘ. Vì hai thứ đó nằm ngay đây
  // nên hàm này buộc phải async, và mọi chỗ gọi phải `await createClient()`.
  const cookieStore = await cookies();
  // Match the cookie domain to the actual request host (see cookieDomainForHost).
  let domain: string | undefined;
  try { domain = cookieDomainForHost((await headers()).get("host")); } catch { domain = undefined; }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      // Share the session cookie across mstudo.com subdomains (album / img).
      ...(domain ? { cookieOptions: { domain } } : {}),
      // Bắt buộc: Next 14 cache cả câu đọc lẫn câu ghi đi qua fetch. Một trang
      // dashboard đọc phải dữ liệu của request trước là sai, không phải nhanh.
      // Xem @/lib/no-store-fetch.
      global: { fetch: noStoreFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Called from a Server Component — middleware refreshes the session.
          }
        },
      },
    }
  );
}
