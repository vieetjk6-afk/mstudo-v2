/* Màn xem trước GIAO DIỆN MỚI của nhóm "conlai" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Trang khách tự bọc
 * <CustomerRootV2>; màn trong khu quản lý bọc <PreviewV2 path="..."> (./shell).
 *
 * Nhóm này là các MẢNH DÙNG CHUNG (src/components/*) nằm trong màn V2: mỗi
 * mảnh có bản V2 riêng, tự chọn theo useUiV2(). Mảnh cần hàm hoặc giả API thì
 * dựng qua ./conlai-demo (client). */
import { Globe, Sparkles, Wallet } from "lucide-react";
import AccountingExportCard from "@/components/studio/AccountingExportCard";
import AutomationsCard from "@/components/studio/AutomationsCard";
import BankAutoCard from "@/components/studio/BankAutoCard";
import StudioPolicyCard from "@/components/studio/StudioPolicyCard";
import CollectButton from "@/components/studio/CollectButton";
import CustomDomain from "@/components/CustomDomain";
import AutoEmailToggle from "@/components/AutoEmailToggle";
import PlanUsage from "@/components/PlanUsage";
import StudioTrialButton from "@/components/StudioTrialButton";
import MessengerButton from "@/components/MessengerButton";
import EmailButton from "@/components/EmailButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import PushToggle from "@/components/PushToggle";
import StudioShellV2 from "@/components/v2/StudioShellV2";
import { Callout, PageHead, Section, Stack } from "@/components/v2/kit";
import PlanLockedV2 from "@/app/dashboard/studio/calendar/PlanLockedV2";
import { PreviewV2, previewProfile } from "./shell";
import {
  AiFilterDemo,
  AlbumModeDemo,
  BankAutoDemo,
  DriveStatusMock,
  FaceSetupDemoV2,
  FilterDialogDemo,
  FormBitsDemo,
  ToastDemo,
} from "./conlai-demo";

const BRANCHES = [
  { id: "b1", name: "Mây Studio · Quận 1", code: "Q1", active: true },
  { id: "b2", name: "Mây Studio · Thủ Đức", code: "TĐ", active: true },
  { id: "b3", name: "Kho đồ cưới Gò Vấp", code: null, active: false },
];

function ShellWithBranches({ selected, locked = false }: { selected: string | null; locked?: boolean }) {
  return (
    <DriveStatusMock>
      <StudioShellV2
        profile={previewProfile}
        tier="full"
        role="owner"
        accent="blue"
        previewPath="/dashboard/studio"
        branches={BRANCHES}
        branchSelected={selected}
        branchCookie="mstudo_branch"
        branchLocked={locked}
      >
        <Stack>
          <PageHead desc="Ô chọn chi nhánh, ô tìm ⌘K, trạng thái Drive ở chân menu — các mảnh của khung dùng chung." />
          <Section title="Nội dung màn" desc="Phần thân chỉ để làm nền cho khung.">
            <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>
              Bấm ô chi nhánh trên thanh trên cùng để mở danh sách; bấm ô tìm (hoặc ⌘K) để mở bảng lệnh.
            </p>
          </Section>
        </Stack>
      </StudioShellV2>
    </DriveStatusMock>
  );
}

export const SCREENS_CONLAI: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-manh-ten-mien": {
    title: "Giao diện mới — mảnh: Tên miền riêng (chờ DNS / đã xác minh / trống)",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/site">
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Section icon={Globe} title="Địa chỉ trang" desc="Đã lưu tên miền, đang chờ trỏ DNS.">
            <p className="text-[13px]" style={{ color: "var(--tx2)" }}>(ô tên miền phụ ở đây)</p>
            <CustomDomain initialDomain="maystudio.vn" initialVerified={false} />
          </Section>
          <Stack>
            <Section icon={Globe} title="Địa chỉ trang" desc="Tên miền đã xác minh.">
              <p className="text-[13px]" style={{ color: "var(--tx2)" }}>(ô tên miền phụ ở đây)</p>
              <CustomDomain initialDomain="www.maystudio.vn" initialVerified />
            </Section>
            <Section icon={Globe} title="Địa chỉ trang" desc="Chưa có tên miền riêng.">
              <p className="text-[13px]" style={{ color: "var(--tx2)" }}>(ô tên miền phụ ở đây)</p>
              <CustomDomain initialDomain={null} initialVerified={false} />
            </Section>
          </Stack>
        </div>
      </PreviewV2>
    ),
  },
  "v2-manh-ke-toan": {
    title: "Giao diện mới — mảnh: Xuất kế toán & khoá sổ",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/reports">
        <Stack>
          <AccountingExportCard ownerId="o" initialClosedUntil="2026-09-30" canClose />
          <AccountingExportCard ownerId="o" initialClosedUntil={null} canClose={false} />
        </Stack>
      </PreviewV2>
    ),
  },
  "v2-manh-viec-tu-dong": {
    title: "Giao diện mới — mảnh: Việc tự động",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/services">
        <div className="max-w-[920px]">
          <AutomationsCard ownerId="o" initial={{}} />
        </div>
      </PreviewV2>
    ),
  },
  "v2-manh-chinh-sach": {
    title: "Giao diện mới — mảnh: Chính sách studio",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/services">
        <div className="max-w-[920px]">
          <StudioPolicyCard ownerId="o" initialStorageMonths={6} initialQuoteValidDays={15} initialDeposit={500_000} initialReferralReward={200_000} />
        </div>
      </PreviewV2>
    ),
  },
  "v2-manh-chuyen-khoan": {
    title: "Giao diện mới — mảnh: Tự xác nhận chuyển khoản (đã bật, có giao dịch chờ gán)",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/pricing">
        <BankAutoDemo />
      </PreviewV2>
    ),
  },
  "v2-manh-chuyen-khoan-chua-bat": {
    title: "Giao diện mới — mảnh: Tự xác nhận chuyển khoản (chưa bật)",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/pricing">
        <BankAutoCard />
      </PreviewV2>
    ),
  },
  "v2-manh-nho": {
    title: "Giao diện mới — mảnh nhỏ: email tự động, gói, dùng thử, nút gửi khách, thu tiền, thông báo đẩy",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/albums">
        <Stack>
          <Callout tone="brand" icon={Sparkles} title="Trải nghiệm gói Studio miễn phí 1 ngày" action={<StudioTrialButton used={false} />}>
            Hợp đồng, lịch chụp, quản lý khách hàng và toàn bộ tính năng Studio trong 24 giờ.
          </Callout>
          <PlanUsage initial={{ used: 5, limit: 5, pro: false, plan: "free", expiresAt: null }} />
          <PlanUsage initial={{ used: 12, limit: null, pro: true, plan: "studio", expiresAt: "2026-12-31" }} />
          <AutoEmailToggle ownerId="o" initial />
          <Section icon={Wallet} title="Nút gửi khách & thu tiền" desc="Nút gửi khách khi chỗ gọi không truyền lớp riêng, cạnh nút thu tiền của thẻ việc.">
            <div className="flex flex-wrap items-center gap-2">
              <CollectButton planId="p1" contractId="c1" amountLabel="15.000.000đ" />
              <MessengerButton message="Chào anh chị, studio gửi lịch chụp ngày mai…" />
              <EmailButton to="khach@example.com" subject="Lịch chụp" message="Chào anh chị…" label="Email" />
              <ZaloSendButton phone="0909000000" name="Minh Anh" message="Chào anh chị…" wrapClassName="w-auto" />
              <ZaloSendButton askPhone message="Chào anh chị…" label="Gửi Zalo" wrapClassName="w-auto" friendsLabel="Chọn bạn" />
            </div>
          </Section>
          <PushToggle />
        </Stack>
      </PreviewV2>
    ),
  },
  "v2-manh-khuon-mat": {
    title: "Giao diện mới — mảnh: Báo tìm ảnh theo khuôn mặt chưa bật (thiếu bảng / thiếu CRON_SECRET)",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/albums">
        <FaceSetupDemoV2 />
      </PreviewV2>
    ),
  },
  "v2-manh-album-hop-dong": {
    title: "Giao diện mới — mảnh: Chọn album ảnh của hợp đồng",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/contracts/new">
        <AlbumModeDemo />
      </PreviewV2>
    ),
  },
  "v2-manh-loc-anh-ai": {
    title: "Giao diện mới — mảnh: Lọc ảnh bằng AI (chưa quét)",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/filter">
        <AiFilterDemo />
      </PreviewV2>
    ),
  },
  "v2-manh-dieu-khoan-logo": {
    title: "Giao diện mới — mảnh: Chèn điều khoản mẫu + Logo",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/templates">
        <FormBitsDemo />
      </PreviewV2>
    ),
  },
  "v2-manh-loc-anh-popup": {
    title: "Giao diện mới — mảnh: Popup lọc ảnh từ thư viện album",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/albums">
        <FilterDialogDemo />
      </PreviewV2>
    ),
  },
  "v2-manh-toast": {
    title: "Giao diện mới — mảnh: Toast xác nhận",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/staff">
        <ToastDemo />
      </PreviewV2>
    ),
  },
  "v2-manh-goi-lich": {
    title: "Giao diện mới — mảnh: Lịch làm việc khi gói chưa có tính năng",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/calendar">
        <PlanLockedV2 title="Cần gói Studio" hint="Tính năng này chỉ dành cho tài khoản gói Studio." cta="Xem gói Studio" />
      </PreviewV2>
    ),
  },
  "v2-manh-khung-chi-nhanh": {
    title: "Giao diện mới — mảnh khung: chọn chi nhánh, ô ⌘K, trạng thái Drive",
    bare: true,
    render: () => <ShellWithBranches selected="b1" />,
  },
  "v2-manh-khung-chi-nhanh-gop": {
    title: "Giao diện mới — mảnh khung: chi nhánh xem gộp",
    bare: true,
    render: () => <ShellWithBranches selected={null} />,
  },
  "v2-manh-khung-chi-nhanh-khoa": {
    title: "Giao diện mới — mảnh khung: chi nhánh bị khoá theo vai trò",
    bare: true,
    render: () => <ShellWithBranches selected="b2" locked />,
  },
};
