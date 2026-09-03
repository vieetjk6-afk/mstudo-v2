import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { guardCaptcha } from "@/lib/captcha-guard";
import { limitByIp } from "@/lib/rate-limit";
import { depositFor, newDepositCode, newDepositToken } from "@/lib/booking-deposit";
import { digitsOnly, isUsablePhone, samePhone } from "@/lib/referral";
import { isLeadSource, type Utm } from "@/lib/lead-source";

export const dynamic = "force-dynamic";

/** Public booking request for a studio (resolved by booking_token). */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const limited = limitByIp(req, "book", 8, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    service?: string;
    preferred_date?: string;
    note?: string;
    package_name?: string;
    package_price?: number;
    facebook?: string;
    referrer_phone?: string;
    captcha?: string;
    /** Nguồn khách — trình duyệt suy ra rồi gửi kèm (xem @/lib/lead-source). */
    source?: string;
    utm?: Utm;
    landing_path?: string;
  };

  const captcha = await guardCaptcha(req, `book:${params.token}`, body.captcha);
  if (captcha) return captcha;

  if (!body.name?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: owner } = await db
    .from("profiles")
    .select("id, booking_deposit, referral_reward")
    .eq("booking_token", params.token)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Nguồn khách do CLIENT gửi lên nên phải lọc lại ở server: chỉ nhận nhãn nằm
  // trong tập đóng, và chỉ giữ 5 khoá utm đã biết với độ dài có hạn. Không lọc
  // thì cột này thành chỗ ai cũng nhét được chuỗi tuỳ ý vào DB của studio.
  const source = isLeadSource(body.source) ? body.source : null;
  const utm = pickUtm(body.utm);
  const landingPath =
    typeof body.landing_path === "string" && body.landing_path.startsWith("/")
      ? body.landing_path.slice(0, 200)
      : null;

  const pkgName = body.package_name?.trim() || null;
  const pkgPrice =
    body.package_price != null && Number.isFinite(body.package_price) ? Math.max(0, Math.round(body.package_price)) : null;

  // Cọc giữ ngày — chốt số tiền NGAY tại đây rồi lưu vào bản ghi. Đọc lại chính
  // sách lúc hiển thị thì studio đổi mức cọc hôm sau sẽ làm đổi số tiền của một
  // yêu cầu đã gửi đi.
  const depositAmount = depositFor(owner.booking_deposit ?? 0, pkgPrice);
  const wantsDeposit = depositAmount > 0;

  const core = {
    owner_id: owner.id,
    name: body.name.trim(),
    phone: body.phone.trim(),
    service: body.service?.trim() || null,
    preferred_date: body.preferred_date || null,
    note: body.note?.trim() || null,
    package_name: pkgName,
    package_price: pkgPrice,
    facebook: body.facebook?.trim() || null,
    referrer_phone: isUsablePhone(body.referrer_phone) ? digitsOnly(body.referrer_phone) : null,
    deposit_amount: wantsDeposit ? depositAmount : null,
    deposit_status: wantsDeposit ? "awaiting" : "none",
    deposit_code: wantsDeposit ? newDepositCode() : null,
    deposit_token: wantsDeposit ? newDepositToken() : null,
  };
  const cols = "id, deposit_amount, deposit_code, deposit_token";

  // Ghi kèm nguồn khách. Nếu project chưa chạy migration `nguon_khach.sql` thì
  // ba cột đó chưa tồn tại và Postgres từ chối CẢ câu insert — mà đây là đường
  // KHÁCH đặt lịch, hỏng nó là studio mất đơn thật chứ không phải mất một biểu
  // đồ. Nên: thử có nguồn, hỏng thì ghi lại đúng phần cốt lõi. Cùng cách
  // `getStudioHost` đang đỡ cột `custom_domain_verified` chưa migrate.
  let { data: booking, error } = await db
    .from("studio_bookings")
    .insert({ ...core, source, utm, landing_path: landingPath })
    .select(cols)
    .single();
  if (error) {
    console.warn("[book] ghi nguồn khách hỏng, thử lại không kèm nguồn:", error.message);
    ({ data: booking, error } = await db.from("studio_bookings").insert(core).select(cols).single());
  }
  if (error || !booking) return NextResponse.json({ error: "server_error" }, { status: 500 });

  // ── Giới thiệu ────────────────────────────────────────────────────────────
  // Chỉ ghi sổ khi người giới thiệu THẬT SỰ là khách cũ của chính studio này —
  // nếu không, ai cũng gõ một số bất kỳ để lấy ưu đãi. Tra bằng hợp đồng đã có.
  if (isUsablePhone(body.referrer_phone) && !samePhone(body.referrer_phone, body.phone)) {
    const refDigits = digitsOnly(body.referrer_phone);
    const { data: past } = await db
      .from("studio_contracts")
      .select("client_name, client_phone")
      .eq("owner_id", owner.id)
      .neq("status", "cancelled")
      .limit(500);
    const match = (past ?? []).find((c) => samePhone(c.client_phone as string, refDigits));
    if (match) {
      // Chỉ số 0 dòng: khách mới CHƯA chốt hợp đồng, thưởng chỉ ghi nhận chờ.
      // Studio tự chuyển sang "đã chốt" khi hợp đồng thành.
      await db.from("studio_referrals").insert({
        owner_id: owner.id,
        referrer_phone: refDigits,
        referrer_name: (match.client_name as string) || null,
        referred_phone: digitsOnly(body.phone),
        referred_name: body.name.trim(),
        booking_id: booking.id,
        reward_amount: Math.max(0, Math.round(owner.referral_reward ?? 0)),
        status: "pending",
      });
    }
  }

  const bookMsg = `Yêu cầu đặt lịch mới từ ${body.name.trim()}${pkgName ? ` · ${pkgName}` : ""}${body.preferred_date ? ` · ${body.preferred_date}` : ""}`;
  await db.from("studio_notifications").insert({
    owner_id: owner.id,
    contract_id: null,
    kind: "info",
    message: bookMsg,
  });
  await sendPushToOwner(owner.id, { title: "Đặt lịch mới", body: bookMsg, url: "/dashboard/studio/bookings", tag: "booking" });

  // Trả thông tin cọc để form chuyển sang bước quét QR. Không có cọc thì trả
  // đúng { ok: true } như cũ và form hiện màn cảm ơn.
  return NextResponse.json({
    ok: true,
    deposit: booking.deposit_token
      ? { amount: booking.deposit_amount, code: booking.deposit_code, token: booking.deposit_token }
      : null,
  });
}

/** Chỉ giữ 5 khoá utm đã biết, mỗi khoá tối đa 120 ký tự. Trả `null` (không
 *  phải `{}`) khi rỗng để cột jsonb không đầy những object trống. */
function pickUtm(raw: unknown): Utm | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: Utm = {};
  for (const k of ["source", "medium", "campaign", "content", "term"] as const) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 120);
  }
  return Object.keys(out).length ? out : null;
}
