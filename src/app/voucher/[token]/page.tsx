import { notFound } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandFrom } from "@/lib/studio-brand";
import { getStudioHost } from "@/lib/studio-site";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, todayVN } from "@/lib/date";
import { ensureBookingToken, voucherBookingUrl } from "@/lib/voucher-links";
import { VOUCHER_COLS, VOUCHER_STATE_LABEL, voucherState, voucherValueLabel, type Voucher } from "@/lib/vouchers";
import VoucherPublicView from "./VoucherPublicView";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   /voucher/<public_token> — trang khách mở khi quét QR trên voucher ưu đãi.
   Hai việc: đặt lịch ngay (mã điền sẵn vào form đặt lịch) hoặc lưu ảnh voucher
   về điện thoại để dùng sau. Không lộ gì ngoài chính tấm voucher.
   ═══════════════════════════════════════════════════════════════════════════ */

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const db = createAdminClient();
  const { data } = await db.from("studio_vouchers").select(`owner_id, ${VOUCHER_COLS}`).eq("public_token", token).maybeSingle();
  if (!data) return null;
  const v = data as Voucher & { owner_id: string };
  if (v.status === "void") return null;
  const { data: owner } = await db
    .from("profiles")
    .select("full_name, studio_brand_name, studio_logo_url, pl_logo_url, pl_phone")
    .eq("id", v.owner_id)
    .maybeSingle();
  return { db, v, owner };
}

export async function generateMetadata(props: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await props.params;
  const r = await load(token);
  if (!r) return { title: "Voucher" };
  const studio = brandFrom(r.owner).name;
  const title = `${voucherValueLabel(r.v)} · ${studio}`;
  return { title, description: `Voucher ưu đãi ${r.v.code} của ${studio}.`, robots: { index: false } };
}

export default async function VoucherPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const r = await load(token);
  if (!r) notFound();
  const { db, v, owner } = r;

  const host = await getStudioHost(db, v.owner_id);
  const pageUrl = studioUrl(host, `/voucher/${token}`);
  const state = voucherState(v, todayVN());
  const usable = state === "usable";
  const bookingToken = usable ? await ensureBookingToken(db, v.owner_id) : null;
  const qr = await QRCode.toDataURL(pageUrl, { margin: 1, width: 480, color: { dark: "#2b2118", light: "#ffffff" } });
  const brand = brandFrom(owner);

  return (
    <VoucherPublicView
      ticket={{
        studio: brand.name,
        title: v.title,
        value: voucherValueLabel(v),
        code: v.code,
        expires: v.expires_on ? fmtDate(v.expires_on) : null,
        recipient: v.recipient_name,
        qr,
        stateLabel: usable ? null : VOUCHER_STATE_LABEL[state],
      }}
      logo={brand.logoUrl}
      bookUrl={bookingToken ? voucherBookingUrl(host, bookingToken, v.code) : null}
      studioPhone={(owner?.pl_phone as string | null) ?? null}
      usable={usable}
    />
  );
}
