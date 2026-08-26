import { notFound } from "next/navigation";
import UpgradeRequests from "@/app/dashboard/admin/UpgradeRequests";
import DiscountCodes from "@/app/dashboard/admin/DiscountCodes";
import PaymentView from "@/app/dashboard/upgrade/thanh-toan/[id]/PaymentView";
import type { DiscountCode, UpgradeRequest } from "@/lib/types";

const req = (over: Partial<UpgradeRequest>): UpgradeRequest => ({
  id: Math.random().toString(36).slice(2),
  user_id: "u1",
  email: "studio.anhcuoi@gmail.com",
  note: null,
  plan: "studio",
  cycle: "year",
  discount_code: null,
  phone: "0912345678",
  amount: 3000000,
  payment_amount: 3000000,
  payment_code: "MS-4K7Q",
  payment_status: "none",
  declared_at: null,
  reviewed_at: null,
  reviewed_by: null,
  review_note: null,
  handled: false,
  created_at: "2026-08-26T09:12:00Z",
  ...over,
});

const codes: DiscountCode[] = [
  { id: "1", code: "TET2026", percent: 30, plan: null, cycle: null, max_uses: null, used_count: 12, expires_at: "2026-12-31", trial_days: null, active: true, created_at: "2026-01-01" } as DiscountCode,
  { id: "2", code: "THUSTUDIO", percent: 0, plan: "studio", cycle: null, max_uses: 1, used_count: 1, expires_at: "2026-01-01", trial_days: 1, active: true, created_at: "2026-01-01" } as DiscountCode,
];

/**
 * XEM TRƯỚC GIAO DIỆN — chỉ chạy ở máy dev, KHÔNG tồn tại trên production.
 *
 * Vì sao cần: gần hết màn hình của app nằm sau đăng nhập + Supabase, nên không
 * mở được để nhìn nếu chỉ có mã nguồn. Trang này dựng thẳng các component bằng
 * DỮ LIỆU GIẢ, đủ mọi trạng thái, nên xem được bố cục thật (và chụp ảnh bằng
 * `node scripts/chup-giao-dien.mjs`) mà không cần tài khoản hay cơ sở dữ liệu.
 *
 * Thêm component mới vào đây khi sửa một màn khó mở — nhất là các trạng thái
 * hiếm (lỗi, rỗng, chưa cấu hình) vốn gần như không dựng lại được bằng tay.
 */
export default function UiPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <p className="rounded-lg px-3 py-2 text-[12px]" style={{ background: "var(--surface2)", color: "var(--text3)" }}>
        Trang xem trước giao diện — dữ liệu giả, chỉ có ở bản dev.
      </p>
      <h1 className="text-xl font-bold">1. Yêu cầu nâng cấp (4 trạng thái)</h1>
      <UpgradeRequests
        initial={[
          req({ payment_status: "awaiting_confirm", declared_at: "2026-08-26T09:30:00Z" }),
          req({ payment_status: "paid", handled: true, plan: "basic", cycle: "month", payment_amount: 50000 }),
          req({ payment_status: "failed", plan: "photographer", payment_amount: 999000, review_note: "Chưa thấy tiền về" }),
          req({ payment_status: "none", discount_code: "TET2026", payment_amount: 2100000, note: "Cần xuất hoá đơn" }),
        ]}
      />

      <h1 className="text-xl font-bold">2. Mã giảm giá</h1>
      <DiscountCodes initial={codes} />

      <h1 className="text-xl font-bold">3. Trang thanh toán — chờ chuyển khoản</h1>
      <PaymentView id="a" plan="studio" cycle="year" amount={3000000} code="MS-4K7Q" initialStatus="none" initialNote={null}
        bank={{ bin: "970436", account: "0123456789", holder: "NGUYEN VAN A", name: "Vietcombank" }} />

      <h1 className="text-xl font-bold">4. Trang thanh toán — chờ admin xác nhận</h1>
      <PaymentView id="b" plan="basic" cycle="month" amount={50000} code="MS-7QW2" initialStatus="awaiting_confirm" initialNote={null}
        bank={{ bin: "970436", account: "0123456789", holder: "NGUYEN VAN A", name: "Vietcombank" }} />

      <h1 className="text-xl font-bold">5. Trang thanh toán — thất bại</h1>
      <PaymentView id="c" plan="photographer" cycle="month" amount={100000} code="MS-9XZ3" initialStatus="failed"
        initialNote="Bên mình chưa thấy tiền về, nhờ anh kiểm tra lại nội dung chuyển khoản." 
        bank={{ bin: "970436", account: "0123456789", holder: "NGUYEN VAN A", name: "Vietcombank" }} />

      <h1 className="text-xl font-bold">6. Trang thanh toán — chưa cấu hình ngân hàng</h1>
      <PaymentView id="d" plan="studio" cycle="month" amount={300000} code="MS-2AB4" initialStatus="none" initialNote={null}
        bank={{ bin: null, account: null, holder: null, name: null }} />
    </div>
  );
}
