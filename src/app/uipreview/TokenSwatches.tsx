import { Bell, CircleAlert, Clock, FileText, Wallet } from "lucide-react";
import { Panel, PanelHead, Pill, ProgressBar, StatCard, TONE, type ToneKey } from "@/components/studio/ui";

/* ═══════════════════════════════════════════════════════════════════════════
   BẢNG MÀU — MÀN CANH LỖI "TOKEN RỖNG"

   Vì sao có màn này: bộ token của khu quản lý từng chỉ khai trong
   `.studio-shell` và `.client-doc`. Màn nào chạy NGOÀI shell (studio gói free
   dùng header thường, màn bảo trì, trang tài khoản) mà gọi một token chỉ có
   trong shell thì `var()` không giải được → khai báo hỏng ở computed-value
   time: nền tụt về trong suốt, chữ tụt về màu kế thừa. Không có lỗi, không có
   cảnh báo, chỉ có một viên trạng thái mất màu mà mắt rất dễ bỏ qua.

   Màn này vẽ MỌI cặp màu trong BA khung một lúc — ngoài shell, shell sáng,
   shell tối — nên hụt một token ở khung nào là thấy ngay: ô đó trắng trơn.
   Chụp bằng `npm run ui:shot bang-mau`.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Mọi token màu đôi (chữ + nền nhạt) mà app đang dùng, kèm nơi dùng thật. */
const PAIRS: { fg: string; soft: string; name: string; used: string }[] = [
  { fg: "--ac", soft: "--acS", name: "Màu nhấn", used: "nút chính, mục nav đang mở" },
  { fg: "--gn", soft: "--gnS", name: "Thành công", used: "đã thu, đã giao" },
  { fg: "--am", soft: "--amS", name: "Cảnh báo", used: "chờ xử lý, sắp tới hạn" },
  { fg: "--rd", soft: "--rdS", name: "Lỗi", used: "quá hạn, huỷ" },
  { fg: "--bl", soft: "--blS", name: "Thông tin", used: "ghi chú, nhãn hệ thống" },
  { fg: "--tl", soft: "--tlS", name: "Mòng két", used: "hợp đồng đang thực hiện" },
  { fg: "--nu", soft: "--nuS", name: "Trung tính", used: "báo giá nháp" },
];

/** Token một màu — nền, bề mặt, viền, chữ. */
const SINGLES: { token: string; name: string }[] = [
  { token: "--bg", name: "Nền trang" },
  { token: "--sf", name: "Bề mặt thẻ" },
  { token: "--sf2", name: "Bề mặt phụ" },
  { token: "--panel", name: "Nền khối (tên cũ)" },
  { token: "--card", name: "Nền thẻ (tên cũ)" },
  { token: "--bd", name: "Viền" },
  { token: "--bd2", name: "Viền phân cách" },
  { token: "--bdS", name: "Viền đậm" },
  { token: "--tx", name: "Chữ chính" },
  { token: "--tx2", name: "Chữ phụ" },
  { token: "--tx3", name: "Chữ mờ" },
  { token: "--brand", name: "Màu nhấn (tên cũ)" },
  { token: "--brandSoft", name: "Nhấn nhạt (tên cũ)" },
  { token: "--warn", name: "Cảnh báo (tên cũ)" },
];

function PairRow({ p }: { p: (typeof PAIRS)[number] }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2" style={{ borderTop: "1px solid var(--bd2)" }}>
      {/* Ô vuông nền nhạt + chữ đậm: token hụt thì ô này trắng trơn và chữ
          biến mất, khác hẳn mọi ô còn lại. */}
      <span
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] text-[12px] font-bold"
        style={{ background: `var(${p.soft})`, color: `var(${p.fg})`, border: "1px solid var(--bd)" }}
      >
        Aa
      </span>
      <span className="h-9 w-9 flex-none rounded-[9px]" style={{ background: `var(${p.fg})` }} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold">{p.name}</p>
        <p className="truncate text-[11px]" style={{ color: "var(--tx3)" }}>{p.used}</p>
      </div>
      <code className="flex-none text-[10.5px]" style={{ color: "var(--tx3)" }}>
        {p.fg} / {p.soft}
      </code>
    </div>
  );
}

/** Một khung màu: tiêu đề + mọi cặp màu + mọi token đơn + các khối thật. */
function Scope({ label, note }: { label: string; note: string }) {
  const tones: ToneKey[] = Object.keys(TONE) as ToneKey[];
  return (
    <div className="p-4" style={{ background: "var(--bg)", color: "var(--tx)" }}>
      <div className="mb-3">
        <h2 className="text-[15px] font-bold">{label}</h2>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>{note}</p>
      </div>

      {/* Viên trạng thái — cách token màu lộ ra nhiều nhất trong app thật. */}
      <Panel className="mb-3 px-4 py-3">
        <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
          Viên trạng thái (mọi tone của Pill)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tones.map((t) => (
            <Pill key={t} tone={t} dot>
              {t}
            </Pill>
          ))}
        </div>
      </Panel>

      <Panel className="mb-3">
        <PanelHead icon={Bell} tone="brand" title="Cặp màu chữ + nền nhạt" count={String(PAIRS.length)} note="ô trắng trơn = token hụt trong khung này" />
        {PAIRS.map((p) => (
          <PairRow key={p.fg} p={p} />
        ))}
      </Panel>

      <Panel className="mb-3 px-4 py-3">
        <p className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
          Token đơn
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SINGLES.map((s) => (
            <div key={s.token} className="rounded-[9px] p-2" style={{ border: "1px solid var(--bd)" }}>
              <span className="block h-8 rounded-[6px]" style={{ background: `var(${s.token})`, border: "1px solid var(--bd)" }} />
              <p className="mt-1.5 text-[11px] font-semibold">{s.name}</p>
              <code className="text-[10px]" style={{ color: "var(--tx3)" }}>{s.token}</code>
            </div>
          ))}
        </div>
      </Panel>

      {/* Khối thật, không phải ô màu: thẻ KPI, nút, ô nhập, thanh tiến độ —
          để thấy cả hình khối lẫn màu, đúng như trên app. */}
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Hợp đồng" value="18" delta="+3" deltaTone="green" />
        <StatCard icon={Wallet} tone="green" label="Đã thu" value="42,5tr" sub="tháng này" />
        <StatCard icon={Clock} tone="amber" label="Chờ xử lý" value="4" delta="cần xem" deltaTone="amber" />
        <StatCard icon={CircleAlert} tone="red" label="Quá hạn" value="2" delta="gấp" deltaTone="red" />
      </div>

      <Panel className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary">Nút chính</button>
          <button className="btn-ghost">Nút viền</button>
          <button className="btn-danger">Nút xoá</button>
          <button className="btn-primary" disabled>
            Đang khoá
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Ô nhập — bấm Tab để xem vòng focus" />
          <select className="input">
            <option>Ô chọn</option>
          </select>
        </div>
        <div className="mt-3 space-y-2">
          <ProgressBar pct={72} />
          <ProgressBar pct={38} color="var(--am)" />
          <ProgressBar pct={12} color="var(--rd)" />
        </div>
      </Panel>
    </div>
  );
}

/**
 * Ba khung cạnh nhau. Khung đầu KHÔNG bọc `.studio-shell` — đó chính là khung
 * hay hụt token, nên nó phải được vẽ đúng như ngoài shell (vì thế màn này khai
 * `bare: true` ở screens.tsx để route không tự bọc shell vào).
 */
export default function TokenSwatches() {
  return (
    <div className="grid gap-px lg:grid-cols-3" style={{ background: "var(--border)" }}>
      <Scope label="Ngoài shell (:root)" note="Studio gói free, màn bảo trì, đăng nhập, landing" />
      <div className="studio-shell" data-theme="light">
        <Scope label="Trong shell — nền sáng" note="Khu quản lý studio, mặc định" />
      </div>
      <div className="studio-shell" data-theme="dark">
        <Scope label="Trong shell — nền tối" note="Khu quản lý studio, người dùng chọn nền tối" />
      </div>
    </div>
  );
}
