import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_PRICING, type Plan } from "@/lib/plans";
import { activatePlan } from "@/lib/upgrade-activate";
import { newUpgradePaymentCode, upgradeAmount } from "@/lib/upgrade-payment";
import { notifyAdmins } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

type PaidPlan = "basic" | "photographer" | "photographer_plus" | "studio";

/**
 * Giá gốc + % giảm khuyến mãi của một gói, ĐỌC TỪ MÁY CHỦ.
 *
 * Trình duyệt cũng tự tính con số này để hiển thị, nhưng số dùng để THU TIỀN
 * (in lên mã QR) phải do máy chủ chốt — sửa một dòng JSON là mua gói Studio
 * giá 1.000đ.
 */
async function serverPrice(
  db: ReturnType<typeof createAdminClient>,
  plan: PaidPlan,
  cycle: "month" | "year",
): Promise<{ base: number; promoPct: number }> {
  const priceKey = `price_${plan}_${cycle}` as const;
  const discKey = `${plan}_discount_${cycle}_percent` as const;
  const { data } = await db.from("site_settings").select(`${priceKey}, ${discKey}`).eq("id", 1).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  const base = Number(row[priceKey]);
  const promo = Number(row[discKey]);
  return {
    base: Number.isFinite(base) && base > 0 ? Math.round(base) : PLAN_PRICING[plan][cycle],
    promoPct: Number.isFinite(promo) ? Math.min(100, Math.max(0, promo)) : 0,
  };
}

/** A logged-in photographer requests an account upgrade. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { note, plan, cycle, discount_code, phone } = (await req.json().catch(() => ({}))) as {
    note?: string;
    plan?: string;
    cycle?: string;
    discount_code?: string;
    phone?: string;
  };

  const validPlan = plan === "basic" || plan === "photographer" || plan === "photographer_plus" || plan === "studio" ? (plan as PaidPlan) : null;
  const validCycle = cycle === "year" ? "year" : "month";
  const code = discount_code?.trim().toUpperCase() || null;
  const db = createAdminClient();

  // Đọc trạng thái mã (thông tin) + đã đổi theo tài khoản chưa. Việc chốt lượt
  // thật sự làm ATOMIC bên dưới nên các đọc này chỉ để quyết định luồng.
  type CodeRow = { percent: number; plan: string | null; cycle: string | null; active: boolean; max_uses: number | null; used_count: number | null; expires_at: string | null };
  let alreadyRedeemed = false;
  let dc: CodeRow | null = null;
  if (code) {
    const { data: red } = await db.from("discount_redemptions").select("id").eq("code", code).eq("user_id", user.id).maybeSingle();
    const { data: codeRow } = await db.from("discount_codes").select("percent, plan, cycle, active, max_uses, used_count, expires_at").eq("code", code).maybeSingle();
    alreadyRedeemed = !!red;
    dc = (codeRow as CodeRow | null) ?? null;
  }

  // Mã có áp dụng cho gói/chu kỳ này không? (max_uses được kiểm tra atomic khi chốt).
  const applicable = !!(
    dc && dc.active &&
    (!dc.expires_at || new Date(dc.expires_at).getTime() >= Date.now()) &&
    (!dc.plan || dc.plan === validPlan) &&
    (!dc.cycle || dc.cycle === validCycle)
  );

  // Chốt lượt dùng mã ATOMIC: ghi redemption (unique theo tài khoản) rồi trừ
  // used_count qua RPC (UPDATE … WHERE max_uses … RETURNING). Không còn cảnh hai
  // request cùng vượt max_uses hay mất lượt đếm.
  let claimed = false;
  if (code && applicable && !alreadyRedeemed) {
    const { error: redErr } = await db.from("discount_redemptions").insert({ code, user_id: user.id });
    if (!redErr) {
      const { data: ok } = await db.rpc("consume_discount_code", { p_code: code });
      claimed = ok === true;
      // Hết lượt ngay trước ta → gỡ redemption để không khoá nhầm tài khoản.
      if (!claimed) await db.from("discount_redemptions").delete().eq("code", code).eq("user_id", user.id);
    }
  }

  // Số tiền phải trả — CHỐT Ở ĐÂY và dùng cho cả mã QR lẫn lúc admin đối chiếu.
  // Lấy mức giảm CAO HƠN giữa khuyến mãi của gói và mã giảm giá đã chốt được,
  // đúng như trang nâng cấp hiển thị.
  let payAmount = 0;
  if (validPlan) {
    const { base, promoPct } = await serverPrice(db, validPlan, validCycle);
    const codePct = claimed && dc ? Math.min(100, Math.max(0, dc.percent)) : 0;
    payAmount = upgradeAmount(base, Math.max(promoPct, codePct));
  }

  // Không phải trả đồng nào (mã 100% đã chốt được lượt, hoặc gói đang khuyến
  // mãi 100%) → kích hoạt ngay. Nếu không xử ở đây thì studio bị đẩy sang trang
  // thanh toán với số tiền 0đ và không có đường nào đi tiếp.
  const freeNow = !!validPlan && payAmount === 0;
  let activated = false;
  if (validPlan && (freeNow || (claimed && dc && dc.percent >= 100))) {
    await activatePlan({
      db,
      userId: user.id,
      userEmail: user.email ?? "",
      plan: validPlan as Plan,
      cycle: validCycle,
      saleAmount: payAmount,
    });
    activated = true;
  }

  const row = {
    user_id: user.id,
    email: user.email,
    note: note?.trim() || null,
    plan: validPlan,
    cycle: validCycle,
    discount_code: code,
    phone: phone?.trim() || null,
    amount: payAmount || null,
    payment_amount: payAmount || null,
    payment_status: activated ? "paid" : "none",
    handled: activated, // auto-activated requests are already done
  };

  // Mã nội dung chuyển khoản chỉ có 4 ký tự cho studio gõ tay được, mà cột lại
  // UNIQUE — nên đụng mã là chuyện sẽ xảy ra, không phải nếu. Sinh lại vài lần
  // thay vì để studio nhận lỗi 500 ngay ở bước trả tiền.
  const needsCode = !activated && !!validPlan && payAmount > 0;
  let inserted: { id: string } | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from("upgrade_requests")
      .insert({ ...row, payment_code: needsCode ? newUpgradePaymentCode() : null })
      .select("id")
      .single();
    if (!error) {
      inserted = data as { id: string };
      break;
    }
    lastError = error.message;
    // 23505 = unique_violation → chỉ có thể do trùng payment_code.
    if (error.code !== "23505" || !needsCode) break;
  }
  if (!inserted) return NextResponse.json({ error: lastError || "insert_failed" }, { status: 500 });

  // Báo cho quản trị viên có yêu cầu nâng cấp mới.
  const planLabel = validPlan ? ` gói ${validPlan}/${validCycle}` : "";
  // push: true — đây là việc CÓ TIỀN đang chờ duyệt, để nằm im ở chuông thì
  // admin chỉ thấy khi tình cờ mở dashboard. Ba loại thông báo hệ thống
  // (tài khoản mới, liên hệ, nâng cấp) thì đây là loại duy nhất mất doanh thu
  // nếu trả lời chậm.
  await notifyAdmins(
    "upgrade_request",
    `Yêu cầu nâng cấp${planLabel} từ ${user.email}${activated ? " (đã tự kích hoạt bằng mã giảm giá)" : ""}`,
    { push: true },
  );

  return NextResponse.json({ ok: true, activated, requestId: inserted.id, amount: payAmount });
}
