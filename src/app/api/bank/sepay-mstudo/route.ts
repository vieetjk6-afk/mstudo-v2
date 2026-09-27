import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify-admin";
import { UPGRADE_REVIEW_HREF } from "@/lib/notifications";
import { vnd } from "@/lib/types";
import { parseSepay, hookSecretFromHeader, upgradeCodeCandidates } from "@/lib/bank-reconcile";
import { confirmUpgrade, UPGRADE_ROW_COLUMNS, type UpgradeRow } from "@/lib/upgrade-confirm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Webhook SePay của CHÍNH mstudo: tiền studio trả cho gói dịch vụ về tài khoản
 * của mstudo → tự nâng gói, thay cho việc admin mở sao kê rồi bấm "Đã nhận tiền".
 *
 * Tách hẳn khỏi /api/bank/sepay (tiền khách trả cho studio): ở đây chỉ có MỘT
 * tài khoản, nên khoá nằm trong biến môi trường SEPAY_MSTUDO_KEY chứ không nằm
 * trong database. Chưa đặt biến → 503, không có cửa nào mở.
 *
 * Chỉ tự nâng gói khi nội dung có mã "MS-XXXX" của một yêu cầu đang chờ VÀ số
 * tiền đủ. Thiếu tiền hay mã lạ thì để nguyên cho admin xem, như trước giờ:
 * nâng gói nhầm là cho không, còn chậm vài phút thì chẳng mất gì.
 */

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  const expected = (process.env.SEPAY_MSTUDO_KEY || "").trim();
  if (!expected) return NextResponse.json({ success: false, error: "not_configured" }, { status: 503 });

  const got = hookSecretFromHeader(req.headers.get("authorization"));
  if (!got || !sameSecret(got, expected)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const txn = parseSepay(await req.json().catch(() => null));
  if (!txn) return NextResponse.json({ success: false, error: "bad_payload" }, { status: 400 });
  if (txn.direction !== "in") return NextResponse.json({ success: true, skipped: "outgoing" });

  const codes = upgradeCodeCandidates(txn.content);
  if (codes.length === 0) return NextResponse.json({ success: true, matched: false });

  const db = createAdminClient();
  const { data: rows } = await db
    .from("upgrade_requests")
    .select(UPGRADE_ROW_COLUMNS)
    .in("payment_code", codes)
    .limit(1);
  const row = (rows?.[0] ?? null) as UpgradeRow | null;
  if (!row) return NextResponse.json({ success: true, matched: false });

  // SePay gửi lại, hoặc admin đã duyệt tay trước đó → không làm gì thêm.
  if (row.payment_status === "paid") return NextResponse.json({ success: true, duplicate: true });

  const due = Math.max(0, Math.round(Number(row.payment_amount) || 0));
  const stamp = `SePay ${vnd(txn.amount)}${txn.referenceCode ? ` · ${txn.referenceCode}` : ""}`;

  if (txn.amount < due) {
    // Thiếu tiền: KHÔNG nâng gói. Đưa về hàng chờ admin, kèm số đã nhận.
    await db
      .from("upgrade_requests")
      .update({
        payment_status: "awaiting_confirm",
        declared_at: new Date().toISOString(),
        handled: false,
        review_note: `${stamp}: thiếu ${vnd(due - txn.amount)} so với ${vnd(due)}`,
      })
      .eq("id", row.id)
      .neq("payment_status", "paid");
    await notifyAdmins(
      "upgrade_request",
      `${row.email || "Studio"} chuyển THIẾU cho gói ${row.plan}/${row.cycle} · ${row.payment_code}: nhận ${vnd(txn.amount)}, cần ${vnd(due)} — cần xem`,
      { push: true, url: UPGRADE_REVIEW_HREF },
    );
    return NextResponse.json({ success: true, matched: true, underpaid: true });
  }

  const res = await confirmUpgrade(db, row, {
    reviewedBy: null,
    note: `Tự xác nhận qua ${stamp}`,
    // Hoa hồng tính trên giá gói, không phải trên phần khách lỡ chuyển dư.
    saleAmount: due,
  });
  if (res.ok) {
    await notifyAdmins(
      "upgrade_request",
      `Đã TỰ nâng gói ${row.plan}/${row.cycle} cho ${row.email || "studio"} · ${row.payment_code} · ${vnd(txn.amount)} (SePay)`,
      { url: UPGRADE_REVIEW_HREF },
    );
  }
  return NextResponse.json({ success: true, matched: true, activated: res.ok });
}
