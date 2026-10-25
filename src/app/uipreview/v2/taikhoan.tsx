/* Màn xem trước GIAO DIỆN MỚI của nhóm "taikhoan" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import AccountV2 from "@/app/dashboard/account/AccountV2";
import type { AccountProps } from "@/app/dashboard/account/useAccount";
import PaymentView from "@/app/dashboard/upgrade/thanh-toan/[id]/PaymentView";
import UpgradeV2 from "@/app/dashboard/upgrade/UpgradeV2";

/** Ngày TƯƠNG ĐỐI so với hôm nay, để nhãn "x ngày trước" luôn đúng nghĩa. */
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const account: AccountProps = {
  userId: "o",
  email: "mrlee@studio.vn",
  fullName: "Mr Lee",
  plan: "studio",
  planExpiresAt: "2027-03-12T00:00:00Z",
  planCycle: "year",
  createdAt: "2025-04-02T08:00:00Z",
  providers: ["email", "google"],
  hasPassword: true,
  role: "photographer",
  studioBrandName: "Mai Studio",
  studioLogo: null,
};

const noBank = { bin: null, account: null, holder: null, name: null };

export const SCREENS_TAIKHOAN: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-tai-khoan": {
    title: "Giao diện mới — Tài khoản & bảo mật (đã bật 2 lớp)",
    render: () => (
      <PreviewV2 path="/dashboard/account">
        <AccountV2 {...account} mfaSeed={{ factors: [{ id: "f1", friendly_name: "mstudo 2026-08-14", status: "verified", created_at: ago(72) }] }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-tai-khoan-moi": {
    title: "Giao diện mới — Tài khoản (Google, chưa có mật khẩu, chưa bật 2 lớp)",
    render: () => (
      <PreviewV2 path="/dashboard/account">
        <AccountV2
          {...account}
          fullName="Nguyễn Thị Lan Phương"
          email="lanphuong.photo@gmail.com"
          plan="free"
          planExpiresAt={null}
          planCycle={null}
          providers={["google"]}
          hasPassword={false}
          studioBrandName={null}
          mfaSeed={{ factors: [] }}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-goi-phan-mem": {
    title: "Giao diện mới — Gói phần mềm (đang dùng Photographer, theo năm)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade">
        <UpgradeV2
          usage={{ used: 41, limit: 50, pro: true, plan: "photographer", expiresAt: "2026-12-02T00:00:00Z" }}
          seed={{ currentPlan: "photographer", trialUsed: true }}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-goi-phan-mem-free": {
    title: "Giao diện mới — Gói phần mềm (miễn phí, chưa dùng thử)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade">
        <UpgradeV2 usage={{ used: 5, limit: 5, pro: false, plan: "free", expiresAt: null }} seed={{ currentPlan: "free", trialUsed: false }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan": {
    title: "Giao diện mới — Thanh toán gói (chờ chuyển khoản)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/a">
        <PaymentView id="a" plan="studio" cycle="year" amount={1_500_000} code="MS-4K7Q" initialStatus="none" initialNote={null} bank={f.bank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-cho": {
    title: "Giao diện mới — Thanh toán gói (đã báo chuyển, chờ xác nhận)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/b">
        <PaymentView id="b" plan="basic" cycle="month" amount={50_000} code="MS-7QW2" initialStatus="awaiting_confirm" initialNote={null} bank={f.bank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-loi": {
    title: "Giao diện mới — Thanh toán gói (chưa nhận được tiền)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/c">
        <PaymentView id="c" plan="photographer" cycle="month" amount={100_000} code="MS-9XZ3" initialStatus="failed" initialNote="Bên mình chưa thấy tiền về, nhờ anh kiểm tra lại nội dung chuyển khoản." bank={f.bank} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-xong": {
    title: "Giao diện mới — Thanh toán gói (đã nâng cấp, SePay tự xác nhận)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/d">
        <PaymentView id="d" plan="studio" cycle="month" amount={300_000} code="MS-2AB4" initialStatus="paid" initialNote={null} bank={f.bank} autoConfirm />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-thanh-toan-chua-cau-hinh": {
    title: "Giao diện mới — Thanh toán gói (chưa cấu hình tài khoản nhận)",
    render: () => (
      <PreviewV2 path="/dashboard/upgrade/thanh-toan/e">
        <PaymentView id="e" plan="studio" cycle="month" amount={300_000} code="MS-2AB4" initialStatus="none" initialNote={null} bank={noBank} />
      </PreviewV2>
    ),
    bare: true,
  },
};
