"use client";

/* Lớp bọc client cho các màn xem trước nhóm "conlai" (mảnh dùng chung trong
 * giao diện mới). Tách khỏi ./conlai.tsx vì các mảnh này cần HÀM (onChange,
 * onClose…) hoặc cần giả câu trả lời của API — hàm không đi qua được ranh giới
 * server → client. Máy dev không có Supabase / SePay / Drive thật. */

import { useEffect, useState } from "react";
import { ChevronUp, Filter, ImageIcon, Palette, ScrollText } from "lucide-react";
import AlbumModePicker, { type AlbumModeStatus } from "@/components/AlbumModePicker";
import AiFilterPanel from "@/components/AiFilterPanel";
import ClauseInserter from "@/components/ClauseInserter";
import FilterDialog from "@/components/FilterDialog";
import LogoUpload from "@/components/LogoUpload";
import { FaceSetupNoticeV2View, type FaceSetupNoticeState } from "@/components/FaceSetupNoticeV2";
import { useToast } from "@/components/studio/Toast";
import BankAutoCard from "@/components/studio/BankAutoCard";
import { Field, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import type { AlbumMode } from "@/lib/album-mode";

/* ── Giả API: thay window.fetch cho đúng vài đường dẫn ───────────────────── */
const ROUTES = new Map<string, unknown>();
let installed = false;
function installFetchMock(map: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  for (const [k, v] of Object.entries(map)) ROUTES.set(k, v);
  if (installed) return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = url.replace(window.location.origin, "").split("?")[0];
    const method = (init?.method || "GET").toUpperCase();
    if (method === "GET" && ROUTES.has(path)) {
      return Promise.resolve(new Response(JSON.stringify(ROUTES.get(path)), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return orig(input, init);
  };
}

/** Cài giả API NGAY lúc dựng (trước mọi useEffect của cây con) rồi vẽ con. */
export function MockFetch({ routes, children }: { routes: Record<string, unknown>; children: React.ReactNode }) {
  installFetchMock(routes);
  return <>{children}</>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

/* ── Tự xác nhận chuyển khoản: đã bật, có giao dịch chờ gán ─────────────── */
const BANK_HOOK_DATA = {
  hook: { secret: "msk_9f2c4e7a1b8d3f60c5e2a9b7d4f1e8c3", enabled: true, last_event_at: ago(42), created_at: ago(60 * 24 * 30) },
  txns: [
    { id: "t1", amount: 5_000_000, content: "MS8F2A1C3D coc chup cuoi Thao Nam", gateway: "Vietcombank", txn_at: ago(42), created_at: ago(42), status: "matched", note: null, contract_id: "c1", booking_id: null },
    { id: "t2", amount: 3_000_000, content: "chuyen tien chup ky yeu 12A3", gateway: "Vietcombank", txn_at: ago(60 * 5), created_at: ago(60 * 5), status: "unmatched", note: "no_code", contract_id: null, booking_id: null },
    { id: "t3", amount: 300_000, content: "COC-7Q2M giu ngay 12/11", gateway: "MB Bank", txn_at: ago(60 * 26), created_at: ago(60 * 26), status: "unmatched", note: "deposit_under", contract_id: null, booking_id: "b1" },
    { id: "t4", amount: 10_000, content: "test sepay", gateway: "Vietcombank", txn_at: ago(60 * 24 * 3), created_at: ago(60 * 24 * 3), status: "ignored", note: null, contract_id: null, booking_id: null },
  ],
  plans: [
    { id: "p1", label: "Đợt 2", amount: 3_000_000, due_date: "2026-11-02", contract: { id: "c2", code: "HD-0412", title: "Chụp kỷ yếu 12A3", client_name: "Cô Hương" } },
    { id: "p2", label: "Cọc", amount: 2_000_000, due_date: "2026-11-10", contract: { id: "c3", code: "HD-0415", title: "Cưới Minh Anh & Quốc Bảo", client_name: "Minh Anh" } },
  ],
};

export function BankAutoDemo() {
  return (
    <MockFetch routes={{ "/api/studio/bank-hook": BANK_HOOK_DATA }}>
      <BankAutoCard />
    </MockFetch>
  );
}

/** Trạng thái Drive ở chân sidebar: đã kết nối. */
export function DriveStatusMock({ children }: { children: React.ReactNode }) {
  return (
    <MockFetch routes={{ "/api/studio/drive/status": { configured: true, connected: true, rootFolderName: "MStudo · Mây Studio" } }}>
      {children}
    </MockFetch>
  );
}

/* ── Báo khuôn mặt: dữ liệu giả cho phần hình ───────────────────────────── */
export function FaceSetupDemoV2() {
  const missing: FaceSetupNoticeState = {
    missing: ["album_people", "album_faces"],
    copied: "",
    thieuCron: false,
    duAn: { ma: "abcd1234efgh", sqlEditor: "https://supabase.com/dashboard/project/abcd1234efgh/sql/new" },
    chepSql: async () => {},
    kiemTraLai: () => {},
  };
  const cron: FaceSetupNoticeState = { ...missing, missing: [], thieuCron: true };
  return (
    <Stack>
      <FaceSetupNoticeV2View s={missing} />
      <FaceSetupNoticeV2View s={cron} />
    </Stack>
  );
}

/* ── Chọn kiểu album của hợp đồng: ba trạng thái kết nối ─────────────────── */
export function AlbumModeDemo() {
  const [a, setA] = useState<AlbumMode | null>("manual");
  const [b, setB] = useState<AlbumMode | null>("desktop");
  const notReady: AlbumModeStatus = { driveConfigured: true, driveConnected: true, rootFolderReady: false, desktopConnected: false };
  const ready: AlbumModeStatus = { driveConfigured: true, driveConnected: true, rootFolderReady: true, desktopConnected: true, ready: true };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Section title="Chưa đủ điều kiện album mặc định" desc="Thiếu kết nối desktop / thư mục gốc.">
        <AlbumModePicker name="demo-a" value={a} onChange={setA} status={notReady} />
      </Section>
      <Section title="Đã kết nối" desc="Chọn album mặc định.">
        <AlbumModePicker name="demo-b" value={b} onChange={setB} status={ready} />
      </Section>
    </div>
  );
}

/* ── Lọc ảnh bằng AI: nguồn 248 ảnh trên máy (chưa quét) ────────────────── */
export function AiFilterDemo() {
  const files = Array.from({ length: 248 }, (_, i) => ({
    key: `f${i}`,
    name: i % 31 === 0 ? `IMG_${String(1000 + i)}.CR3` : `IMG_${String(1000 + i)}.JPG`,
    file: new File([""], `IMG_${1000 + i}.JPG`, { type: "image/jpeg" }),
  }));
  return (
    <div className="v2-card overflow-hidden">
      {/* Giống FilterToolV2: thẻ có thanh "Thu gọn" phía trên phần thân. */}
      <div className="flex items-center justify-end px-3 pt-2">
        <button type="button" className={btn("ghost", "sm")}>
          <ChevronUp size={15} /> Thu gọn
        </button>
      </div>
      <AiFilterPanel sourceFiles={files} sourceLabel={`${files.length} ảnh trong thư mục trên máy`} onUseNames={() => {}} />
    </div>
  );
}

/* ── Chèn điều khoản + tải logo ─────────────────────────────────────────── */
export function FormBitsDemo() {
  const [note, setNote] = useState("1. Bên B đặt cọc 30% giá trị hợp đồng để giữ lịch.");
  const [logo, setLogo] = useState("");
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Section icon={ScrollText} title="Điều khoản / ghi chú mặc định" desc="In cuối hợp đồng tạo từ mẫu này.">
        <textarea className={`${inputCls} !min-h-[120px]`} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Điều khoản" />
        <ClauseInserter onInsert={(x) => setNote((n) => (n.trim() ? `${n.trim()}\n\n${x}` : x))} />
      </Section>
      <Section icon={Palette} title="Màu & logo" desc="Áp cho mọi bảng giá gửi khách.">
        <div className="flex flex-col gap-4">
          <Field label="Tên hiển thị">
            <input className={inputCls} defaultValue="Mây Studio" />
          </Field>
          <LogoUpload value={logo} onChange={setLogo} />
        </div>
      </Section>
    </div>
  );
}

/* ── Popup lọc ảnh trong thư viện album ─────────────────────────────────── */
export function FilterDialogDemo() {
  const [open, setOpen] = useState(true);
  return (
    <Stack>
      <Section icon={ImageIcon} title="Thư viện album" desc="Bấm Lọc ảnh trên thẻ album để mở công cụ ngay tại chỗ.">
        <button type="button" onClick={() => setOpen(true)} className={btn("primary")}>
          <Filter size={16} /> Lọc ảnh
        </button>
      </Section>
      {open && <FilterDialog albumId="a1" albumTitle="ALBUM SU KIEN" onClose={() => setOpen(false)} />}
    </Stack>
  );
}

/* ── Toast của các màn quản lý (nhân sự, voucher, chi nhánh…) ──────────── */
export function ToastDemo() {
  const { toast, toastNode } = useToast();
  useEffect(() => {
    // Hiện lại liên tục để ảnh chụp lúc nào cũng thấy.
    toast("Đã lưu thay đổi của nhân sự Phạm Minh Khoa.");
    const id = setInterval(() => toast("Đã lưu thay đổi của nhân sự Phạm Minh Khoa."), 2000);
    return () => clearInterval(id);
  }, [toast]);
  return (
    <Section title="Toast xác nhận" desc="Nổi giữa đáy màn hình; trên điện thoại nằm trên thanh tab.">
      <button type="button" className={btn("secondary")} onClick={() => toast("Đã chép link.")}>
        Hiện toast
      </button>
      {toastNode}
    </Section>
  );
}
