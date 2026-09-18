import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Next contract code for a studio: HD-{MM}-{YYYY}-{NNN}, sequence per month.
 * e.g. the 1st contract in June 2026 → "HD-06-2026-001".
 */
export async function nextContractCode(supabase: SupabaseClient, ownerId: string): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const prefix = `HD-${mm}-${yyyy}-`;
  const { count } = await supabase
    .from("studio_contracts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .like("code", `${prefix}%`);
  return `${prefix}${String((count || 0) + 1).padStart(3, "0")}`;
}

/**
 * Next quote code for a studio: BG-{MM}-{YYYY}-{NNN}, sequence per month.
 * e.g. the 1st quote in June 2026 → "BG-06-2026-001".
 */
export async function nextQuoteCode(supabase: SupabaseClient, ownerId: string): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const prefix = `BG-${mm}-${yyyy}-`;
  const { count } = await supabase
    .from("studio_quotes")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .like("code", `${prefix}%`);
  return `${prefix}${String((count || 0) + 1).padStart(3, "0")}`;
}

/** Generate a URL-safe random token for /q/[token] and /c/[token] sharing. */
export function newShareToken(): string {
  const base =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return base.replace(/-/g, "");
}
