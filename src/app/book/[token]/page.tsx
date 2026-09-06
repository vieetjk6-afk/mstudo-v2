import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICE_LISTS } from "@/lib/pricelist-seeds";
import BookingForm, { type PkgOption } from "./BookingForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const params = await props.params;
  const db = createAdminClient();
  const { data: owner } = await db
    .from("profiles")
    .select("full_name")
    .eq("booking_token", params.token)
    .maybeSingle();
  const studioName = owner?.full_name || "Studio";
  const title = `Đặt lịch · ${studioName}`;
  const description = `Đặt lịch chụp ảnh với ${studioName} — nhanh chóng, tiện lợi.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BookingPage(
  props: {
    params: Promise<{ token: string }>;
    searchParams?: Promise<{ pkg?: string; list?: string; ref?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const db = createAdminClient();
  const { data: owner } = await db
    .from("profiles")
    .select("id, full_name, referral_discount, booking_deposit, pl_bank_bin, pl_bank_account, pl_bank_holder, pl_bank_name")
    .eq("booking_token", params.token)
    .maybeSingle();

  if (!owner) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không tìm thấy</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Link đặt lịch không hợp lệ.</p>
        </div>
      </div>
    );
  }

  let plq = db
    .from("studio_pricelist")
    .select("id, list_key, name, price, category")
    .eq("owner_id", owner.id)
    .eq("active", true)
    .gt("price", 0)
    .order("position");
  // Booking from a specific price list → only show that list's packages, so the
  // customer isn't overwhelmed by every list's packages.
  const scoped = (searchParams?.list || "").trim();
  if (scoped) plq = plq.eq("list_key", scoped);
  const { data: pl } = await plq;

  const label = (k: string) => PRICE_LISTS.find((l) => l.key === k)?.label || "";
  const packages: PkgOption[] = (pl ?? []).map((p) => ({
    // When scoped to one list, drop the list-name prefix (it's redundant).
    name: scoped ? (p.name as string) : `${label(p.list_key as string) ? label(p.list_key as string) + " · " : ""}${p.name}`,
    price: (p.price as number) || 0,
  }));

  // Tài khoản nhận cọc — chỉ truyền khi studio ĐÃ bật cọc, để form không dựng
  // bước QR cho một studio không thu cọc.
  const bank =
    (owner.booking_deposit ?? 0) > 0
      ? {
          bin: (owner.pl_bank_bin as string | null) ?? null,
          account: (owner.pl_bank_account as string | null) ?? null,
          holder: (owner.pl_bank_holder as string | null) ?? null,
          name: (owner.pl_bank_name as string | null) ?? null,
        }
      : null;

  return (
    <BookingForm
      token={params.token}
      studioName={owner.full_name || "Studio"}
      packages={packages}
      presetPackage={searchParams?.pkg || ""}
      presetReferrer={searchParams?.ref || ""}
      referralDiscount={(owner.referral_discount as number | null) ?? 0}
      bank={bank}
    />
  );
}
