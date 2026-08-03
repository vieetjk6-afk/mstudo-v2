import type { LucideIcon } from "lucide-react";
import { vndShort } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   BỘ KHỐI DÙNG CHUNG CỦA KHU QUẢN LÝ STUDIO
   Đúng hình khối của bản thiết kế (README, mục "Khoảng cách & hình khối"):
   thẻ bo 14px + viền, KHÔNG đổ bóng; pill bo 20px; nhãn viết hoa 10.5px/800.
   Mọi màn dựng lại đều dùng lại các khối này để không mỗi nơi một kiểu.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Bảng màu trạng thái (bản thiết kế: 4 cặp màu + trung tính) ───────────── */
export const TONE = {
  green: { fg: "var(--gn)", soft: "var(--gnS)" },
  amber: { fg: "var(--am)", soft: "var(--amS)" },
  red: { fg: "var(--rd)", soft: "var(--rdS)" },
  blue: { fg: "var(--bl)", soft: "var(--blS)" },
  purple: { fg: "var(--pu)", soft: "var(--puS)" },
  brand: { fg: "var(--ac)", soft: "var(--acS)" },
  gray: { fg: "var(--tx2)", soft: "var(--sf2)" },
} as const;
export type ToneKey = keyof typeof TONE;

/** Pill trạng thái: 11–11.5px / 650, bo 20px, không bao giờ xuống dòng. */
export function Pill({ tone, children, dot = false }: { tone: ToneKey; children: React.ReactNode; dot?: boolean }) {
  return (
    <span
      className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold"
      style={{ background: TONE[tone].soft, color: TONE[tone].fg }}
    >
      {dot && <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: TONE[tone].fg }} />}
      {children}
    </span>
  );
}

/** Thẻ trắng, viền, bo 14px, KHÔNG đổ bóng — hình khối chuẩn của bản thiết kế. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[14px] ${className}`} style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      {children}
    </div>
  );
}

/** Đầu khối: icon + tiêu đề + badge đếm + ghi chú xám bên phải. */
export function PanelHead({
  icon: Icon, tone, title, count, note,
}: { icon: LucideIcon; tone: ToneKey; title: string; count?: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-[13px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <Icon size={18} style={{ flex: "none", color: TONE[tone].fg }} />
      <h2 className="text-[14px] font-bold">{title}</h2>
      {count ? (
        <span className="flex-none rounded-[20px] px-2 py-0.5 text-[11px] font-bold" style={{ background: TONE[tone].soft, color: TONE[tone].fg }}>
          {count}
        </span>
      ) : null}
      {note ? <span className="ml-auto hidden text-[11.5px] lg:block" style={{ color: "var(--tx3)" }}>{note}</span> : null}
    </div>
  );
}

/**
 * Thẻ KPI: icon nền nhạt + pill biến động ở hàng trên, số liệu 25px/750 tabular,
 * rồi nhãn và chú thích.
 */
export function StatCard({
  icon: Icon, tone = "brand", label, value, sub, delta, deltaTone = "gray",
}: {
  icon: LucideIcon; tone?: ToneKey; label: string; value: string;
  sub?: string; delta?: string; deltaTone?: ToneKey;
}) {
  return (
    <Panel className="px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between gap-2">
        <span className="flex-none rounded-[9px] p-[7px]" style={{ background: TONE[tone].soft, color: TONE[tone].fg, lineHeight: 0 }}>
          <Icon size={19} />
        </span>
        {delta ? (
          <span
            className="flex-none whitespace-nowrap rounded-[20px] px-[7px] py-[3px] text-[10.5px] font-bold"
            style={{ background: TONE[deltaTone].soft, color: TONE[deltaTone].fg }}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className="tnum text-[25px] font-bold leading-none" style={{ letterSpacing: "-.8px" }}>{value}</p>
      <p className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{label}</p>
      {sub ? <p className="mt-px text-[11px]" style={{ color: "var(--tx3)" }}>{sub}</p> : null}
    </Panel>
  );
}

/** Biểu đồ cột doanh thu 6 tháng — cột màu nhấn, nền cột là viền phân cách. */
export function RevenueChart({ bars, headline, delta }: { bars: { label: string; value: number }[]; headline: string; delta: string | null }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <Panel className="px-[18px] pb-2.5 pt-4">
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold">Doanh thu 6 tháng</h2>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>Tiền thực thu về studio</p>
        </div>
        <div className="text-right">
          <p className="tnum text-[21px] font-bold" style={{ letterSpacing: "-.5px", color: "var(--ac)" }}>{headline}</p>
          {delta ? <p className="mt-px text-[11px] font-semibold" style={{ color: delta.startsWith("▼") ? "var(--rd)" : "var(--gn)" }}>{delta}</p> : null}
        </div>
      </div>
      <div className="flex h-[168px] items-end gap-2 pt-2">
        {bars.map((b) => (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="tnum text-[10px] font-semibold" style={{ color: "var(--tx3)" }}>
              {b.value > 0 ? vndShort(b.value) : ""}
            </span>
            <div
              className="w-full max-w-[44px] rounded-t-[6px]"
              style={{
                height: `${Math.max(3, (b.value / max) * 100)}%`,
                minHeight: 5,
                background: b.value > 0 ? "var(--ac)" : "var(--bd2)",
              }}
            />
            <span className="text-[11px] font-semibold" style={{ color: "var(--tx2)" }}>{b.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Trạng thái trống có hướng dẫn (tính năng mới số 10) — không để ô trắng trơn. */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="px-5 py-9 text-center">
      <Icon size={26} style={{ color: "var(--tx3)", margin: "0 auto" }} />
      <p className="mt-2 text-[13px] font-semibold">{title}</p>
      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>{hint}</p>
    </div>
  );
}
