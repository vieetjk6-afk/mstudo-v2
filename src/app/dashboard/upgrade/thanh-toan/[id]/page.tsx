import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BankInfo } from "@/components/VietQR";
import { isUpgradePaymentStatus } from "@/lib/upgrade-payment";
import PaymentView from "./PaymentView";

export const dynamic = "force-dynamic";

/**
 * Trang thanh toán một yêu cầu nâng cấp: mã QR đúng số tiền & nội dung của gói
 * studio vừa chọn, kèm nút "Tôi đã chuyển khoản".
 *
 * Đọc phía MÁY CHỦ và chỉ trả về đơn của chính người đang đăng nhập — số tiền
 * hiện ở đây là số đã chốt lúc tạo yêu cầu, không phải số trình duyệt tự tính.
 */
export default async function UpgradePaymentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();
  const [{ data: row }, { data: settings }] = await Promise.all([
    db
      .from("upgrade_requests")
      .select("id, user_id, plan, cycle, payment_amount, payment_code, payment_status, review_note")
      .eq("id", params.id)
      .maybeSingle(),
    db
      .from("site_settings")
      .select("pay_bank_bin, pay_bank_account, pay_bank_holder, pay_bank_name")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  // Đơn của người khác → coi như không có, đừng để lộ số tiền/đơn hàng.
  if (!row || row.user_id !== user.id) notFound();

  const bank: BankInfo = {
    bin: settings?.pay_bank_bin ?? null,
    account: settings?.pay_bank_account ?? null,
    holder: settings?.pay_bank_holder ?? null,
    name: settings?.pay_bank_name ?? null,
  };

  return (
    <PaymentView
      id={row.id}
      plan={row.plan}
      cycle={row.cycle === "year" ? "year" : "month"}
      amount={row.payment_amount ?? 0}
      code={row.payment_code}
      initialStatus={isUpgradePaymentStatus(row.payment_status) ? row.payment_status : "none"}
      initialNote={row.review_note ?? null}
      bank={bank}
    />
  );
}
