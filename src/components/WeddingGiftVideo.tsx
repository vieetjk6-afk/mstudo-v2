"use client";

/*
 * VIDEO "CHỐT LỊCH CƯỚI — NHẬN 2 QUÀ": thiệp cưới online + kế hoạch cưới.
 * ~35 giây, 6 cảnh, hai khổ cùng một nội dung:
 *   · DỌC 1080×1920 — Reels / TikTok / gửi Zalo, cặp đôi xem trên điện thoại;
 *   · NGANG 1920×1080 — Facebook, YouTube, màn hình ở quầy tư vấn của studio.
 * Mỗi cảnh tự sắp lại bố cục theo khổ (`useLayout`), không phải hai video riêng.
 *
 * Dựng bằng React/CSS như SepayGuideVideo (không quay màn hình): sửa chữ là
 * xong, không phải quay lại. Màn thiệp và màn kế hoạch trong video là MINH HOẠ
 * vẽ lại theo giao diện thật, không phải ảnh chụp — đổi giao diện thì video
 * không lệch tới mức người xem bối rối.
 *
 * Không dùng ảnh nào: chỉ chữ, biểu tượng vẽ bằng SVG và màn minh hoạ. Muốn có
 * ảnh cưới thì dùng ảnh thật của studio (có quyền dùng), không dùng ảnh tạo.
 *
 * Tên + SĐT studio là tuỳ chọn: video không có tên studio vẫn dùng được cho mọi
 * studio; xuất bản riêng thì truyền `studio` / `phone` (scripts/xuat-video-qua-cuoi.mjs
 * nhận --studio, --phone).
 *
 * `renderMode`: ẩn nút, đứng yên ở t=0 và mở window.__giftVideo.setTime(t) để
 * script chụp từng khung rồi ghép thành MP4.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

export type GiftVideoOrientation = "portrait" | "landscape";
export const GIFT_VIDEO_SIZE: Record<GiftVideoOrientation, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
};

// ── Thời gian ───────────────────────────────────────────────────────────────
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
/** 0→1 trong khoảng [a, a+d], có easing. */
const prog = (t: number, a: number, d = 0.6, e = easeOut) => e(clamp((t - a) / d, 0, 1));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const SCENES = [
  { key: "hook", start: 0, end: 4.2 },
  { key: "invite", start: 4.2, end: 11 },
  { key: "planner", start: 11, end: 18 },
  { key: "features", start: 18, end: 25.5 },
  { key: "sync", start: 25.5, end: 30.5 },
  { key: "cta", start: 30.5, end: 35.5 },
] as const;
export const GIFT_VIDEO_DURATION = SCENES[SCENES.length - 1].end;

const Timeline = createContext(0);
const Local = createContext({ t: 0, d: 0 });
const useLocal = () => useContext(Local);
/** Khổ đang dựng — mỗi cảnh đọc để chọn bố cục. */
const LayoutCtx = createContext({ land: false, W: 1080, H: 1920 });
const useLayout = () => useContext(LayoutCtx);

function Scene({ start, end, children }: { start: number; end: number; children: ReactNode }) {
  const time = useContext(Timeline);
  if (time < start || time >= end) return null;
  const t = time - start;
  const d = end - start;
  // Mờ vào / mờ ra 0.4s để cảnh không giật.
  const o = clamp(t / 0.4, 0, 1) * clamp((d - t) / 0.4, 0, 1);
  return (
    <Local.Provider value={{ t, d }}>
      <div style={{ position: "absolute", inset: 0, opacity: o }}>{children}</div>
    </Local.Provider>
  );
}

// ── Bảng màu: đỏ rượu vang & hồng phấn của bộ ảnh mẫu ───────────────────────
const WINE = "#862828";
const WINE_D = "#5e1a1a";
const ROSE = "#e8c6c2";
const BLUSH = "#f6e9e4";
const CREAM = "#fbf6f1";
const GOLD = "#c9a35b";
const INK = "#2a1d1d";
const MUT = "#7a6461";
const GREEN = "#1e9e72"; // màu nhấn thật của cổng khách / trang kế hoạch
const SANS = "var(--font-be-vietnam), 'Be Vietnam Pro', system-ui, sans-serif";
const SERIF = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const SCRIPT = "var(--font-hand), 'Great Vibes', cursive";

// ── Khối dựng chung ─────────────────────────────────────────────────────────

/** Nền kem với ba đốm hồng trôi chậm — giữ nguyên qua các cảnh để không nháy. */
function Backdrop() {
  const time = useContext(Timeline);
  const { W, H } = useLayout();
  const blob = (x: number, y: number, r: number, c: string, k: number): CSSProperties => ({
    position: "absolute",
    left: x * W + Math.sin(time * 0.35 + k) * 40,
    top: y * H + Math.cos(time * 0.3 + k) * 50,
    width: r,
    height: r,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${c} 0%, rgba(255,255,255,0) 68%)`,
  });
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${CREAM} 0%, ${BLUSH} 100%)`, overflow: "hidden" }}>
      <div style={blob(-0.24, -0.1, 900, "rgba(232,198,194,0.85)", 0)} />
      <div style={blob(0.52, 0.27, 820, "rgba(246,214,206,0.9)", 2)} />
      <div style={blob(-0.18, 0.68, 900, "rgba(232,198,194,0.7)", 4)} />
    </div>
  );
}

function Fade({ at, d = 0.6, y = 40, children, style }: { at: number; d?: number; y?: number; children: ReactNode; style?: CSSProperties }) {
  const { t } = useLocal();
  const p = prog(t, at, d);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
}

function Pop({ at, d = 0.55, children, style }: { at: number; d?: number; children: ReactNode; style?: CSSProperties }) {
  const { t } = useLocal();
  const p = clamp((t - at) / d, 0, 1);
  return <div style={{ opacity: clamp(p * 2, 0, 1), transform: `scale(${lerp(0.6, 1, easeBack(p))})`, ...style }}>{children}</div>;
}

/** Nhãn nhỏ viết hoa có gạch hai bên. */
function Kicker({ children, color = WINE, align = "center" }: { children: ReactNode; color?: string; align?: "center" | "left" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: align === "center" ? "center" : "flex-start", gap: 18, fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.22em", color, textTransform: "uppercase" }}>
      {align === "center" && <span style={{ width: 70, height: 2, background: color, opacity: 0.5 }} />}
      {children}
      <span style={{ width: 70, height: 2, background: color, opacity: 0.5 }} />
    </div>
  );
}

function Heart({ size = 40, color = WINE, style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2.2 4.5 6 4.5c2.2 0 3.6 1.2 4.4 2.4h3.2C14.4 5.7 15.8 4.5 18 4.5c3.8 0 5.6 3.8 4 7.2C19.5 16.4 12 21 12 21z" fill={color} />
    </svg>
  );
}

/** Khung điện thoại; nội dung bên trong vẽ ở toạ độ màn hình 460×1000. */
function Phone({ children, w = 520, style }: { children: ReactNode; w?: number; style?: CSSProperties }) {
  const k = w / 520;
  return (
    <div style={{ width: w, height: 1060 * k, ...style }}>
      <div style={{ width: 520, height: 1060, transform: `scale(${k})`, transformOrigin: "top left", borderRadius: 72, background: "#1b1416", padding: 30,
        boxShadow: "0 60px 120px rgba(94,26,26,0.35), inset 0 0 0 3px #3a2d30" }}>
        <div style={{ position: "relative", width: 460, height: 1000, borderRadius: 48, overflow: "hidden", background: "#fff" }}>
          <div style={{ position: "absolute", top: 14, left: "50%", marginLeft: -60, width: 120, height: 34, borderRadius: 20, background: "#1b1416", zIndex: 5 }} />
          {children}
        </div>
      </div>
    </div>
  );
}

function Bullet({ at, children }: { at: number; children: ReactNode }) {
  return (
    <Fade at={at} y={24} style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: SANS, fontSize: 36, fontWeight: 600, color: INK }}>
      <span style={{ width: 48, height: 48, flex: "none", borderRadius: "50%", background: WINE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span>{children}</span>
    </Fade>
  );
}

// ── Màn thiệp (minh hoạ) ────────────────────────────────────────────────────
function InviteScreen({ t0 = 0, compact = false }: { t0?: number; compact?: boolean }) {
  const { t } = useLocal();
  const live = Math.max(0, t - t0);
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${BLUSH}, #fff 55%, ${BLUSH})`, fontFamily: SANS, color: INK, textAlign: "center" }}>
      <div style={{ position: "absolute", inset: 22, border: `2px solid ${ROSE}`, borderRadius: 34 }} />
      <div style={{ position: "absolute", inset: 32, border: `1px solid ${GOLD}`, borderRadius: 28, opacity: 0.6 }} />
      <div style={{ paddingTop: compact ? 110 : 120 }}>
        <div style={{ fontSize: 17, letterSpacing: "0.3em", color: MUT, fontWeight: 600 }}>TRÂN TRỌNG KÍNH MỜI</div>
        <div style={{ marginTop: 30, fontFamily: SCRIPT, fontSize: 74, color: WINE, lineHeight: 1.05 }}>Bảo Ngọc</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 34, color: GOLD, margin: "6px 0" }}>&amp;</div>
        <div style={{ fontFamily: SCRIPT, fontSize: 74, color: WINE, lineHeight: 1.05 }}>Minh Khôi</div>
        <Heart size={28} color={WINE} style={{ display: "block", margin: "22px auto 0" }} />
        <div style={{ marginTop: 18, fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: INK }}>Thứ Bảy · 16.01.2027</div>
        <div style={{ marginTop: 6, fontSize: 18, color: MUT }}>18:00 · Riverside Palace, TP.HCM</div>
        {!compact && (
          <div style={{ marginTop: 34, display: "flex", justifyContent: "center", gap: 12 }}>
            {[["85", "ngày"], ["06", "giờ"], ["42", "phút"], [String(59 - (Math.floor(live) % 60)).padStart(2, "0"), "giây"]].map(([v, l]) => (
              <div key={l} style={{ width: 82, padding: "12px 0", borderRadius: 16, background: "#fff", border: `1px solid ${ROSE}` }}>
                <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 700, color: WINE }}>{v}</div>
                <div style={{ fontSize: 14, color: MUT }}>{l}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ margin: `${compact ? 30 : 38}px auto 0`, width: 330, padding: "18px 0", borderRadius: 40, background: WINE, color: "#fff", fontSize: 22, fontWeight: 700 }}>
          Xác nhận tham dự
        </div>
        {!compact && <div style={{ marginTop: 18, fontSize: 16, color: MUT }}>Kính mời: <b style={{ color: INK }}>Gia đình chú Ba</b></div>}
      </div>
    </div>
  );
}

// ── Màn kế hoạch cưới (minh hoạ theo giao diện thật) ────────────────────────
function PlannerScreen({ t0 = 0, guests = 141 }: { t0?: number; guests?: number }) {
  const { t } = useLocal();
  const rows: [string, string, string, string][] = [
    ["28", "THG 10", "Thử váy lần 2", "Lịch hẹn studio · 09:00"],
    ["01", "THG 11", "Thanh toán đợt 2 cho studio", "Còn 20.230.000đ"],
    ["05", "THG 11", "Chốt thực đơn tiệc cưới", "Việc cần làm · Cô dâu"],
    ["12", "THG 11", "Gửi thiệp mời", "Ưu tiên cao"],
  ];
  const card: CSSProperties = { background: "#fff", border: "1px solid #e7e3de", borderRadius: 18 };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#f3f1ee", fontFamily: SANS, color: "#1a1a1c", padding: "70px 22px 0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "#8b8a90" }}>KẾ HOẠCH CƯỚI</div>
      <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, lineHeight: 1.15, marginTop: 4 }}>Bảo Ngọc &amp; Minh Khôi</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: GREEN }}>Còn 85 ngày</span>
        <span style={{ fontSize: 14, color: "#5c5b60" }}>16/01/2027</span>
      </div>
      <div style={{ ...card, marginTop: 14, display: "flex", gap: 14, padding: "12px 14px 0", fontSize: 14, fontWeight: 600, color: "#5c5b60", whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{ color: GREEN, fontWeight: 800, borderBottom: `3px solid ${GREEN}`, paddingBottom: 10 }}>Tổng quan</span>
        <span>Việc cần làm</span><span>Ngân sách</span><span>Khách mời</span>
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {([
          ["Việc đã xong", "18/31", 58, "Không có việc quá hạn"],
          ["Ngân sách còn lại", "42,6tr", 85, "Còn phải trả 187,7tr"],
          ["Khách sẽ đến", String(guests), -1, `${guests - 15} đã xác nhận`],
          ["Nhà cung cấp", "4/5", -1, "Hạng mục đã chốt"],
        ] as [string, string, number, string][]).map(([l, v, pct, h], i) => {
          const p = prog(t, t0 + 0.2 + i * 0.15, 0.5);
          return (
            <div key={l} style={{ ...card, padding: "12px 14px", opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8b8a90" }}>{l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>{v}</div>
              {pct >= 0 && (
                <div style={{ height: 6, borderRadius: 4, background: "#efece7", marginTop: 6 }}>
                  <div style={{ width: `${pct * p}%`, height: "100%", borderRadius: 4, background: GREEN }} />
                </div>
              )}
              <div style={{ fontSize: 12, color: "#8b8a90", marginTop: 6 }}>{h}</div>
            </div>
          );
        })}
      </div>
      <div style={{ ...card, marginTop: 12, padding: "14px 16px 4px" }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Sắp tới</div>
        {rows.map(([d, m, title, sub], i) => {
          const p = prog(t, t0 + 0.9 + i * 0.25, 0.45);
          return (
            <div key={title} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: i ? "1px solid #efece7" : undefined, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
              <div style={{ width: 50, flex: "none", textAlign: "center", borderRadius: 12, background: "#f7f5f2", padding: "5px 0" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? "#2062c4" : i === 1 ? "#a9740a" : GREEN, lineHeight: 1.1 }}>{d}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#8b8a90" }}>{m}</div>
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: "#8b8a90" }}>{sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Biểu tượng tính năng ────────────────────────────────────────────────────
const ICONS: Record<string, ReactNode> = {
  tasks: <path d="M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10" />,
  money: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /></>,
  guests: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.6.2 4.4 1.8 5 4.8" /></>,
  vendor: <><path d="M4 10l1.5-5h13L20 10" /><path d="M4 10h16v9H4z" /><path d="M10 19v-5h4v5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  camera: <><rect x="3" y="7" width="18" height="12" rx="2.5" /><circle cx="12" cy="13" r="3.5" /><path d="M8.5 7l1.5-2.5h4L15.5 7" /></>,
};

function FeatureIcon({ name, size = 54 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const FEATURES: [string, string, string][] = [
  ["tasks", "Việc cần làm", "Theo mốc trước ngày cưới, ai lo việc gì"],
  ["money", "Ngân sách", "Dự kiến, đã chốt, đã trả, còn nợ"],
  ["guests", "Khách mời & bàn", "Xác nhận dự, xếp bàn, tiền mừng"],
  ["vendor", "Nhà cung cấp", "So báo giá, chốt bên ưng ý"],
  ["clock", "Lịch trình ngày cưới", "Giờ đón dâu, lễ gia tiên, tiệc"],
  ["camera", "Ảnh cần chụp", "Ê-kíp chụp đủ tấm bạn muốn"],
];

// ── Các cảnh ────────────────────────────────────────────────────────────────

function HookScene() {
  const { land } = useLayout();
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 80px" }}>
      <Fade at={0.1}><Kicker>Quà tặng cặp đôi</Kicker></Fade>
      <Fade at={0.35} style={{ marginTop: land ? 26 : 50, fontFamily: SERIF, fontWeight: 700, fontSize: land ? 104 : 118, lineHeight: 1.05, color: WINE, letterSpacing: "-0.02em" }}>
        Chốt lịch cưới {land && <i style={{ fontWeight: 600, color: INK, fontSize: 72 }}>nhận ngay</i>}
      </Fade>
      {!land && (
        <Fade at={0.7} style={{ marginTop: 10, fontFamily: SERIF, fontStyle: "italic", fontSize: 76, color: INK }}>
          nhận ngay
        </Fade>
      )}
      <Pop at={1.15} style={{ marginTop: land ? 0 : 10, fontFamily: SCRIPT, fontSize: land ? 150 : 190, color: WINE, lineHeight: 1.1 }}>
        2 món quà
      </Pop>
      <div style={{ marginTop: land ? 30 : 60, display: "flex", gap: 36 }}>
        {[["Thiệp cưới online", "heart"], ["Kế hoạch cưới", "tasks"]].map(([label, icon], i) => (
          <Pop key={label} at={1.9 + i * 0.25}>
            <div style={{ width: land ? 420 : 380, padding: land ? "26px 0" : "34px 0", borderRadius: 36, background: "#fff", border: `2px solid ${ROSE}`, boxShadow: "0 24px 50px rgba(134,40,40,0.12)" }}>
              <div style={{ width: 96, height: 96, margin: "0 auto", borderRadius: "50%", background: WINE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {icon === "heart" ? <Heart size={50} color="#fff" /> : <FeatureIcon name="tasks" />}
              </div>
              <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 800, fontSize: 36, color: INK }}>{label}</div>
            </div>
          </Pop>
        ))}
      </div>
    </div>
  );
}

/**
 * Một quà: tên quà + điện thoại + ba ý. Dọc: chữ trên, điện thoại giữa, ý dưới.
 * Ngang: chữ và ý cột trái, điện thoại cột phải.
 */
function GiftScene({ no, title, sub, bullets, children }: { no: string; title: string; sub: string; bullets: string[]; children: ReactNode }) {
  const { land } = useLayout();
  const { t } = useLocal();
  const p = prog(t, 0.5, 0.8);
  const head = (
    <>
      <Pop at={0.05} style={{ transformOrigin: land ? "left center" : "center" }}>
        <span style={{ display: "inline-block", padding: "12px 34px", borderRadius: 40, background: WINE, color: "#fff", fontFamily: SANS, fontWeight: 800, fontSize: 32, letterSpacing: "0.08em" }}>{no.toUpperCase()}</span>
      </Pop>
      <Fade at={0.2} style={{ marginTop: 22, fontFamily: SERIF, fontWeight: 700, fontSize: 92, color: WINE, lineHeight: 1.05 }}>{title}</Fade>
      <Fade at={0.4} style={{ marginTop: 14, fontFamily: SANS, fontWeight: 500, fontSize: 32, color: MUT }}>{sub}</Fade>
    </>
  );
  const list = bullets.map((b, i) => <Bullet key={b} at={2.2 + i * 0.6}>{b}</Bullet>);

  if (land) {
    return (
      <>
        <div style={{ position: "absolute", left: 140, top: 230, width: 900 }}>
          {head}
          <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 30 }}>{list}</div>
        </div>
        <div style={{ position: "absolute", left: 1230, top: 70 + (1 - p) * 200, opacity: p }}>
          <Phone w={460}>{children}</Phone>
        </div>
      </>
    );
  }
  return (
    <>
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center", padding: "0 60px" }}>{head}</div>
      <div style={{ position: "absolute", left: (1080 - 470) / 2, top: 450 + (1 - p) * 300, opacity: p }}>
        <Phone w={470}>{children}</Phone>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 1520, display: "flex", flexDirection: "column", gap: 26 }}>{list}</div>
    </>
  );
}

function FeaturesScene() {
  const { land } = useLayout();
  return (
    <>
      <div style={{ position: "absolute", top: land ? 80 : 170, left: 0, right: 0, textAlign: "center" }}>
        <Fade at={0.1}><Kicker>Trong kế hoạch cưới</Kicker></Fade>
        <Fade at={0.3} style={{ marginTop: land ? 18 : 30, fontFamily: SERIF, fontWeight: 700, fontSize: land ? 72 : 84, lineHeight: 1.1, color: WINE }}>
          Mọi thứ cho{land ? " " : <br />}<i style={{ fontWeight: 600 }}>ngày trọng đại</i>
        </Fade>
      </div>
      <div style={{ position: "absolute", top: land ? 310 : 560, left: land ? 110 : 70, right: land ? 110 : 70, display: "grid", gridTemplateColumns: land ? "1fr 1fr 1fr" : "1fr 1fr", gap: land ? 34 : 30 }}>
        {FEATURES.map(([icon, title, sub], i) => (
          <Pop key={title} at={0.9 + i * 0.45}>
            <div style={{ height: land ? 320 : 330, padding: land ? "34px 36px" : "40px 34px", borderRadius: 36, background: "#fff", border: `2px solid ${ROSE}`, boxShadow: "0 20px 44px rgba(134,40,40,0.10)" }}>
              <div style={{ width: 92, height: 92, borderRadius: 26, background: i % 2 ? WINE_D : WINE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FeatureIcon name={icon} />
              </div>
              <div style={{ marginTop: 24, fontFamily: SANS, fontWeight: 800, fontSize: 38, color: INK, lineHeight: 1.15 }}>{title}</div>
              <div style={{ marginTop: 10, fontFamily: SANS, fontWeight: 500, fontSize: 27, color: MUT, lineHeight: 1.35 }}>{sub}</div>
            </div>
          </Pop>
        ))}
      </div>
    </>
  );
}

function SyncScene() {
  const { land } = useLayout();
  const { t } = useLocal();
  // Bong bóng "Gia đình chú Ba · sẽ dự 5 người" bay từ thiệp sang kế hoạch.
  const fly = prog(t, 1.6, 1.2, easeInOut);
  const landed = t > 2.8;
  // Toạ độ hai điện thoại và đường bay của bong bóng theo khổ.
  const ph = land ? { w: 380, y: 150, left: 860, right: 1360 } : { w: 430, y: 560, left: 70, right: 580 };
  const from = land ? [890, 600] : [130, 980];
  const to = land ? [1300, 540] : [560, 900];
  const bx = lerp(from[0], to[0], fly);
  const by = lerp(from[1], to[1], fly) - Math.sin(fly * Math.PI) * (land ? 140 : 180);
  const title = (
    <>
      <Fade at={0.1}><Kicker align={land ? "left" : "center"}>Hai quà, một bộ</Kicker></Fade>
      <Fade at={0.3} style={{ marginTop: 28, fontFamily: SERIF, fontWeight: 700, fontSize: land ? 64 : 76, lineHeight: 1.12, color: WINE }}>
        {/* Khổ ngang cột chữ hẹp: tự ngắt dòng cho khỏi rơi một chữ "nhật" xuống dòng riêng. */}
        {land ? <>Khách xác nhận<br />trên thiệp,</> : "Khách xác nhận trên thiệp,"}<br /><i style={{ fontWeight: 600 }}>danh sách tự cập nhật</i>
      </Fade>
    </>
  );
  const caption = (
    <Fade at={3.2} style={{ fontFamily: SANS, fontSize: 36, fontWeight: 600, color: INK, lineHeight: 1.4 }}>
      Biết ai sẽ đến, đặt đủ số bàn —<br />không phải gọi hỏi từng nhà.
    </Fade>
  );
  return (
    <>
      {land ? (
        <div style={{ position: "absolute", left: 120, top: 280, width: 680 }}>
          {title}
          <div style={{ marginTop: 60 }}>{caption}</div>
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", padding: "0 70px" }}>{title}</div>
          <div style={{ position: "absolute", left: 80, right: 80, top: 1560, textAlign: "center" }}>{caption}</div>
        </>
      )}
      <Fade at={0.5} y={60} style={{ position: "absolute", left: ph.left, top: ph.y }}>
        <Phone w={ph.w}><InviteScreen compact /></Phone>
      </Fade>
      <Fade at={0.7} y={60} style={{ position: "absolute", left: ph.right, top: ph.y }}>
        <Phone w={ph.w}><PlannerScreen t0={-5} guests={landed ? 146 : 141} /></Phone>
      </Fade>
      {t > 1.5 && (
        <div style={{ position: "absolute", left: bx, top: by, transform: `scale(${landed ? 1 : 0.9 + fly * 0.2})`, opacity: landed ? clamp(1 - (t - 3.6) / 0.4, 0, 1) : 1,
          padding: "18px 26px", borderRadius: 24, background: "#fff", border: `3px solid ${GREEN}`, boxShadow: "0 20px 40px rgba(0,0,0,0.18)", fontFamily: SANS, whiteSpace: "nowrap", zIndex: 10 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: INK }}>Gia đình chú Ba</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: GREEN }}>✓ Sẽ dự · 5 người</div>
        </div>
      )}
    </>
  );
}

function CtaScene({ studio, phone }: { studio?: string; phone?: string }) {
  const { land } = useLayout();
  const { t } = useLocal();
  const bg = prog(t, 0, 0.6);
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${WINE} 0%, ${WINE_D} 100%)`, opacity: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 80px" }}>
      <Pop at={0.3}><Heart size={land ? 70 : 90} color={ROSE} /></Pop>
      <Fade at={0.5} style={{ marginTop: land ? 16 : 40, fontFamily: SERIF, fontWeight: 700, fontSize: land ? 96 : 112, lineHeight: 1.05, color: "#fff" }}>
        Chốt lịch cưới
      </Fade>
      <Fade at={0.75} style={{ marginTop: land ? 0 : 6, fontFamily: SCRIPT, fontSize: land ? 120 : 150, color: ROSE, lineHeight: 1.15 }}>
        nhận trọn bộ quà
      </Fade>
      <div style={{ marginTop: land ? 30 : 50, display: "flex", flexDirection: land ? "row" : "column", gap: 22, width: land ? "auto" : 760 }}>
        {["Thiệp cưới online", "Kế hoạch cưới riêng của hai bạn"].map((x, i) => (
          <Pop key={x} at={1.2 + i * 0.25}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, padding: land ? "20px 32px" : "26px 36px", borderRadius: 28, background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.25)", fontFamily: SANS, fontWeight: 700, fontSize: land ? 36 : 40, color: "#fff", whiteSpace: "nowrap" }}>
              <span style={{ width: 52, height: 52, flex: "none", borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              {x}
            </div>
          </Pop>
        ))}
      </div>
      <Fade at={1.9} style={{ marginTop: land ? 26 : 44, fontFamily: SANS, fontWeight: 600, fontSize: land ? 32 : 36, color: ROSE }}>
        Tặng kèm hợp đồng · Hoàn toàn miễn phí
      </Fade>
      {(studio || phone) && (
        <Fade at={2.4} style={{ marginTop: land ? 30 : 70, padding: land ? "20px 44px" : "30px 50px", borderRadius: 30, background: "#fff", minWidth: land ? 0 : 640, display: "flex", flexDirection: land ? "row" : "column", alignItems: "center", gap: land ? 28 : 6 }}>
          {studio && <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: land ? 44 : 52, color: WINE }}>{studio}</div>}
          {phone && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: land ? 40 : 44, color: INK, letterSpacing: "0.04em" }}>{phone}</div>}
        </Fade>
      )}
    </div>
  );
}

function Scenes({ studio, phone }: { studio?: string; phone?: string }) {
  return (
    <>
      <Scene start={SCENES[0].start} end={SCENES[0].end}><HookScene /></Scene>
      <Scene start={SCENES[1].start} end={SCENES[1].end}>
        <GiftScene
          no="Quà 1"
          title="Thiệp cưới online"
          sub="Gửi qua Zalo, Messenger — khách mở là thấy"
          bullets={["Link mời riêng ghi tên từng khách", "Khách bấm xác nhận dự ngay trên thiệp", "Ảnh cưới, bản đồ, nhạc nền, đếm ngược"]}
        >
          <InviteScreen t0={0.5} />
        </GiftScene>
      </Scene>
      <Scene start={SCENES[2].start} end={SCENES[2].end}>
        <GiftScene
          no="Quà 2"
          title="Kế hoạch cưới"
          sub="Trang riêng của hai bạn — lo cưới không sót việc"
          bullets={["Đếm ngược tới ngày cưới", "Việc sắp tới, khoản cần trả, lịch hẹn", "Cô dâu chú rể cùng sửa trên hai điện thoại"]}
        >
          <PlannerScreen t0={0.9} />
        </GiftScene>
      </Scene>
      <Scene start={SCENES[3].start} end={SCENES[3].end}><FeaturesScene /></Scene>
      <Scene start={SCENES[4].start} end={SCENES[4].end}><SyncScene /></Scene>
      <Scene start={SCENES[5].start} end={SCENES[5].end}><CtaScene studio={studio} phone={phone} /></Scene>
    </>
  );
}

// ── Trình phát ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    __giftVideo?: { setTime: (t: number) => void; duration: number };
  }
}

export default function WeddingGiftVideo({
  orientation = "portrait", studio, phone, autoPlay = false, renderMode = false, style,
}: {
  orientation?: GiftVideoOrientation;
  studio?: string;
  phone?: string;
  autoPlay?: boolean;
  renderMode?: boolean;
  style?: CSSProperties;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay && !renderMode);
  const [scale, setScale] = useState(1);
  // Bản xuất MP4 nhận tên / SĐT studio qua ?studio=…&phone=… (xem script xuất).
  const [brand, setBrand] = useState({ studio, phone });
  const { w: W, h: H } = GIFT_VIDEO_SIZE[orientation];
  const layout = useMemo(() => ({ land: orientation === "landscape", W, H }), [orientation, W, H]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.05, el.clientWidth / W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  useEffect(() => {
    if (!renderMode) return;
    const q = new URLSearchParams(window.location.search);
    setBrand({ studio: q.get("studio") || studio, phone: q.get("phone") || phone });
    window.__giftVideo = { setTime, duration: GIFT_VIDEO_DURATION };
    return () => { delete window.__giftVideo; };
  }, [renderMode, studio, phone]);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      setTime((t) => {
        const n = t + dt;
        if (n >= GIFT_VIDEO_DURATION) {
          setPlaying(false);
          return GIFT_VIDEO_DURATION - 0.01;
        }
        return n;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div style={style}>
      <div
        ref={wrapRef}
        onClick={renderMode ? undefined : () => {
          if (!playing && time >= GIFT_VIDEO_DURATION - 0.05) setTime(0);
          setPlaying((p) => !p);
        }}
        style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`, overflow: "hidden", background: CREAM,
          borderRadius: renderMode ? 0 : 16, cursor: renderMode ? "default" : "pointer" }}
        role="img"
        aria-label="Video: chốt lịch cưới nhận thiệp cưới online và kế hoạch cưới"
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <LayoutCtx.Provider value={layout}>
            <Timeline.Provider value={time}>
              <Backdrop />
              <Scenes studio={brand.studio} phone={brand.phone} />
            </Timeline.Provider>
          </LayoutCtx.Provider>
        </div>
        {!renderMode && !playing && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.12)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill={WINE} /></svg>
            </div>
          </div>
        )}
      </div>
      {!renderMode && (
        <div
          style={{ marginTop: 8, height: 6, borderRadius: 3, background: "var(--bd, #e6e8ec)", cursor: "pointer", position: "relative" }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTime(clamp((e.clientX - r.left) / r.width, 0, 1) * GIFT_VIDEO_DURATION);
          }}
          aria-label="Tua video"
        >
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(time / GIFT_VIDEO_DURATION) * 100}%`, borderRadius: 3, background: WINE }} />
        </div>
      )}
    </div>
  );
}
