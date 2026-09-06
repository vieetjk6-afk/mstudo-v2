import { createAdminClient } from "@/lib/supabase/admin";
import { PRICE_LISTS } from "@/lib/pricelist-seeds";
import PricelistPoster from "@/components/PricelistPoster";
import type { PricelistItem } from "@/lib/types";

// Bảng giá công khai theo token — hiếm đổi → ISR + CDN cache 5' thay vì no-store.
export const revalidate = 300;

function buildLists(allItems: PricelistItem[], hidden: string[] = [], labels: Record<string, string> = {}) {
  const builtIn = PRICE_LISTS.filter(
    (l) => !hidden.includes(l.key) && allItems.some((i) => (i.list_key || "cuoi") === l.key)
  ).map((l) => ({ ...l, label: labels[l.key] || l.label, title: labels[l.key] ? `Bảng giá ${labels[l.key]}` : l.title }));
  const builtInKeys = new Set(PRICE_LISTS.map((l) => l.key));
  const customKeys = [...new Set(allItems.map((i) => i.list_key || "cuoi"))].filter((k) => !builtInKeys.has(k));
  const custom = customKeys.map((k) => { const lb = labels[k] || k; return { key: k, label: lb, title: `Bảng giá ${lb}` }; });
  const combined = [...builtIn, ...custom];
  return combined.length ? combined : PRICE_LISTS.slice(0, 1);
}

export default async function PublicPricelist(
  props: { params: Promise<{ token: string }>; searchParams?: Promise<{ list?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const db = createAdminClient();
  const { data: owner } = await db
    .from("profiles")
    .select("id, full_name, pl_phone, pl_facebook, pl_bank_holder, pl_bank_account, pl_bank_name")
    .eq("booking_token", params.token)
    .maybeSingle();

  if (!owner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không tìm thấy</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Link bảng giá không hợp lệ.</p>
        </div>
      </div>
    );
  }

  const { data } = await db
    .from("studio_pricelist")
    .select("*")
    .eq("owner_id", owner.id)
    .eq("active", true)
    .order("position");
  const allItems = (data ?? []) as PricelistItem[];

  const { data: th } = await db
    .from("profiles")
    .select("pl_bg, pl_text, pl_accent, pl_logo_url, pl_hidden_lists, pl_list_labels, pl_show_clauses")
    .eq("id", owner.id)
    .maybeSingle();
  const hidden = ((th?.pl_hidden_lists as string[] | null) ?? []);
  const labels = ((th?.pl_list_labels as Record<string, string> | null) ?? {});

  const lists = buildLists(allItems, hidden, labels);
  const selected = (searchParams?.list && lists.find((l) => l.key === searchParams.list)?.key) || lists[0].key;
  const items = allItems.filter((i) => (i.list_key || "cuoi") === selected);

  // Optionally show the selected service's contract clauses under the prices.
  let clauses = "";
  if (th?.pl_show_clauses) {
    const { data: svc } = await db
      .from("studio_services")
      .select("clauses")
      .eq("id", selected)
      .eq("owner_id", owner.id)
      .maybeSingle();
    clauses = (svc?.clauses as string) || "";
  }

  let theme: { bg?: string | null; text?: string | null; accent?: string | null; logo?: string | null } | undefined;
  if (th) theme = { bg: th.pl_bg, text: th.pl_text, accent: th.pl_accent, logo: th.pl_logo_url };

  return (
    <PricelistPoster
      contact={owner as never}
      items={items}
      lists={lists}
      selected={selected}
      tabBase={`/gia/${params.token}`}
      bookHref={`/book/${params.token}?list=${encodeURIComponent(selected)}`}
      theme={theme}
      clauses={clauses}
    />
  );
}
