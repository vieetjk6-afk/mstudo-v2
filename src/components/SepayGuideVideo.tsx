"use client";

/*
 * Video hướng dẫn nối SePay với mstudo: ~1 phút, 7 cảnh, dựng bằng React/CSS
 * như MstudoVideo ở trang chủ (không MP4 → nhẹ, sửa chữ là xong, không phải
 * quay lại). Khung cố định 1280×720, co giãn theo bề ngang khung chứa.
 *
 * Khác video trang chủ: đây là video HỌC, nên có nút dừng, thanh tiến độ và
 * nhảy thẳng tới từng bước. Studio hay xem lại đúng một bước lúc đang làm dở.
 *
 * Màn SePay trong video là MINH HOẠ đơn giản hoá, không chép giao diện thật của
 * SePay (và có ghi rõ trên hình), vì giao diện của họ đổi thì video không sai
 * lệch tới mức làm người xem bối rối.
 *
 * `renderMode`: ẩn nút, đứng yên ở t=0 và mở window.__sepayGuide.setTime(t) để
 * scripts/xuat-video-sepay.mjs chụp từng khung rồi ghép thành MP4.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

// ── Thời gian ───────────────────────────────────────────────────────────────
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 0→1 trong khoảng [a, a+d], có easing. */
const prog = (t: number, a: number, d = 0.5, e = easeOut) => e(clamp((t - a) / d, 0, 1));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

const Timeline = createContext(0);
const Local = createContext({ t: 0, d: 0 });
const useLocal = () => useContext(Local);

function Scene({ start, end, children }: { start: number; end: number; children: ReactNode }) {
  const time = useContext(Timeline);
  if (time < start || time >= end) return null;
  const t = time - start;
  const d = end - start;
  // Mờ vào / mờ ra 0.35s để cảnh không giật.
  const o = clamp(t / 0.35, 0, 1) * clamp((d - t) / 0.35, 0, 1);
  return (
    <Local.Provider value={{ t, d }}>
      <div style={{ position: "absolute", inset: 0, opacity: o }}>{children}</div>
    </Local.Provider>
  );
}

// ── Bảng màu (cùng họ với MstudoVideo) ───────────────────────────────────────
const G = "#1f9d63";
const GS = "rgba(31,157,99,0.12)";
const INK = "#14171c";
const MUT = "#5b616b";
const BD = "#e6e8ec";
const AM = "#c08a1e";
const AMS = "rgba(192,138,30,0.14)";
const SP = "#2563eb"; // màu nhấn cho màn "SePay (minh hoạ)" — trung tính, không phải logo của họ
const SPS = "rgba(37,99,235,0.10)";
const FONT = "'Be Vietnam Pro', 'Manrope', system-ui, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

// ── Khối dựng chung ─────────────────────────────────────────────────────────
function Bg({ from, to }: { from: string; to: string }) {
  return <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${from}, ${to})` }} />;
}

function Browser({ url, x = 110, y = 56, w = 1060, h = 500, children, tint = G }: {
  url: string; x?: number; y?: number; w?: number; h?: number; children: ReactNode; tint?: string;
}) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "#fff", borderRadius: 16,
      overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,0.35)", border: `1px solid ${BD}` }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 7, padding: "0 16px", borderBottom: `1px solid ${BD}` }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#e7706b" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: BD }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: BD }} />
        <span style={{ marginLeft: 12, fontSize: 13, color: MUT, fontFamily: MONO }}>{url}</span>
        <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: tint }} />
      </div>
      <div style={{ position: "relative", height: h - 44, background: "#fbfcfd", fontFamily: FONT, color: INK }}>{children}</div>
    </div>
  );
}

/** Nhãn bước ở góc dưới: số bước + việc cần làm. */
function Caption({ no, title, sub }: { no: string; title: string; sub: string }) {
  const { t } = useLocal();
  const p = prog(t, 0.15, 0.5);
  return (
    <div style={{ position: "absolute", left: 48, bottom: 30, opacity: p, transform: `translateY(${(1 - p) * 14}px)`,
      display: "flex", alignItems: "center", gap: 16, background: "rgba(10,16,24,0.78)", padding: "12px 22px 12px 12px",
      borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", maxWidth: 1060 }}>
      <div style={{ width: 50, height: 50, flex: "none", borderRadius: 14, background: G, color: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 800, fontSize: 21 }}>{no}</div>
      <div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: "#fff", letterSpacing: "-0.02em" }}>{title}</div>
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function Illustration() {
  return (
    <div style={{ position: "absolute", right: 14, top: 12, fontFamily: FONT, fontSize: 12, color: MUT,
      background: "rgba(255,255,255,0.9)", border: `1px solid ${BD}`, borderRadius: 8, padding: "3px 9px" }}>
      Minh hoạ · giao diện SePay thật có thể khác đôi chút
    </div>
  );
}

/** Con trỏ chuột đi qua các điểm [thời điểm, x, y]; `clicks` là thời điểm bấm. */
function Cursor({ path, clicks = [] }: { path: [number, number, number][]; clicks?: number[] }) {
  const { t } = useLocal();
  let x = path[0][1];
  let y = path[0][2];
  for (let i = 0; i < path.length - 1; i++) {
    const [t0, x0, y0] = path[i];
    const [t1, x1, y1] = path[i + 1];
    if (t >= t0 && t <= t1) {
      const p = easeInOut(clamp((t - t0) / Math.max(0.01, t1 - t0), 0, 1));
      x = lerp(x0, x1, p);
      y = lerp(y0, y1, p);
      break;
    }
    if (t > t1) { x = x1; y = y1; }
  }
  const click = clicks.find((c) => t >= c && t < c + 0.5);
  const cp = click != null ? (t - click) / 0.5 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
      {click != null && (
        <span style={{ position: "absolute", left: -18, top: -18, width: 36, height: 36, borderRadius: "50%",
          border: `3px solid ${G}`, opacity: 1 - cp, transform: `scale(${0.4 + cp * 1.1})` }} />
      )}
      <svg width="26" height="30" viewBox="0 0 26 30" style={{ transform: `scale(${click != null && cp < 0.3 ? 0.88 : 1})`, filter: "drop-shadow(0 3px 5px rgba(0,0,0,.35))" }}>
        <path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12.2 17 L20 17 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Chữ hiện dần như đang gõ / dán. */
function typed(text: string, t: number, start: number, cps = 18) {
  if (t < start) return "";
  return text.slice(0, Math.floor((t - start) * cps));
}

function Field({ label, value, x, y, w = 420, focus = false, mono = false, tint = G }: {
  label: string; value: string; x: number; y: number; w?: number; focus?: boolean; mono?: boolean; tint?: string;
}) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: MUT, marginBottom: 6 }}>{label}</div>
      <div style={{ height: 42, borderRadius: 10, border: `1.5px solid ${focus ? tint : BD}`, background: "#fff",
        boxShadow: focus ? `0 0 0 4px ${tint === G ? GS : SPS}` : "none", display: "flex", alignItems: "center",
        padding: "0 12px", fontSize: mono ? 13 : 15, fontFamily: mono ? MONO : FONT, color: INK, overflow: "hidden", whiteSpace: "nowrap" }}>
        {value}
        {focus && <span style={{ width: 2, height: 20, background: tint, marginLeft: 1 }} />}
      </div>
    </div>
  );
}

function Btn({ x, y, children, pressed = false, tint = G, w }: { x: number; y: number; children: ReactNode; pressed?: boolean; tint?: string; w?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: 42, padding: "0 18px", borderRadius: 10,
      background: tint, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      fontWeight: 700, fontSize: 15, transform: `scale(${pressed ? 0.95 : 1})`, boxShadow: `0 8px 20px ${tint}55` }}>
      {children}
    </div>
  );
}

function Toast({ show, children }: { show: number; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", right: 24, top: 18, opacity: show, transform: `translateY(${(1 - show) * -12}px)`,
      background: INK, color: "#fff", borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 600, zIndex: 40 }}>
      {children}
    </div>
  );
}

const KEY = "msk7Q2vX9pL4tR8wZ3nC6hF1dS5yK0bM";
const URL_TXT = "https://app.mstudo.com/api/bank/sepay";

// ── CẢNH 0 · Mở đầu ─────────────────────────────────────────────────────────
function SceneIntro() {
  const { t } = useLocal();
  const nodes = [
    { icon: "📱", title: "Khách quét QR", sub: "nội dung có mã đợt MS…" },
    { icon: "🏦", title: "Tiền vào tài khoản", sub: "SePay thấy ngay" },
    { icon: "✅", title: "mstudo tự ghi thu", sub: "báo bạn + nhắn Zalo khách" },
  ];
  return (
    <>
      <Bg from="#0b1f17" to="#12342a" />
      <div style={{ position: "absolute", top: 110, width: "100%", textAlign: "center", fontFamily: FONT, color: "#fff" }}>
        <div style={{ opacity: prog(t, 0.2), transform: `translateY(${(1 - prog(t, 0.2)) * 16}px)`, fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Tiền về là tự ghi thu
        </div>
        <div style={{ opacity: prog(t, 0.7), fontSize: 22, marginTop: 12, color: "rgba(255,255,255,0.72)" }}>
          Nối SePay với mstudo trong 5 phút · không phải dò sao kê nữa
        </div>
      </div>
      {nodes.map((n, i) => {
        const p = prog(t, 1.4 + i * 0.9, 0.5);
        return (
          <div key={i} style={{ position: "absolute", left: 150 + i * 350, top: 330, width: 280, opacity: p,
            transform: `translateY(${(1 - p) * 20}px)`, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 20, padding: "26px 20px", textAlign: "center", fontFamily: FONT, color: "#fff" }}>
            <div style={{ fontSize: 46 }}>{n.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>{n.title}</div>
            <div style={{ fontSize: 15, marginTop: 4, color: "rgba(255,255,255,0.7)" }}>{n.sub}</div>
          </div>
        );
      })}
      {[0, 1].map((i) => {
        const p = prog(t, 1.9 + i * 0.9, 0.5);
        return (
          <div key={i} style={{ position: "absolute", left: 440 + i * 350, top: 405, width: 50 * p, height: 4, borderRadius: 2, background: G }} />
        );
      })}
    </>
  );
}

// ── CẢNH 1 · Bật trong mstudo ───────────────────────────────────────────────
function SceneMstudo() {
  const { t } = useLocal();
  const on = t >= 2.4;
  const copied1 = prog(t, 4.6, 0.3) * (1 - prog(t, 5.8, 0.3));
  const copied2 = prog(t, 6.3, 0.3) * (1 - prog(t, 7.6, 0.3));
  return (
    <>
      <Bg from="#eef3f0" to="#dfe9e4" />
      <Browser url="app.mstudo.com/dashboard/studio/pricing">
        <Toast show={Math.max(copied1, copied2)}>{copied1 > copied2 ? "Đã chép URL webhook" : "Đã chép API Key"}</Toast>
        <div style={{ position: "absolute", left: 40, top: 24, fontSize: 14, color: MUT }}>Bảng giá › Tự xác nhận chuyển khoản</div>
        <div style={{ position: "absolute", left: 40, top: 58, right: 40, height: 360, background: "#fff", border: `1px solid ${BD}`, borderRadius: 16, padding: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 800 }}>
            <span style={{ color: G }}>⚡</span> Tự xác nhận chuyển khoản
            {on && <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: G, background: GS, borderRadius: 20, padding: "5px 12px" }}>● Đang bật</span>}
          </div>
          <div style={{ fontSize: 14, color: MUT, marginTop: 8, maxWidth: 760 }}>
            Nối tài khoản ngân hàng qua SePay (có gói miễn phí). Khách quét QR của đợt nào, tiền về là app tự ghi thu đúng đợt đó.
          </div>
          {!on ? (
            <Btn x={26} y={120} pressed={t > 2.1 && t < 2.4}>⚡ Bật tự xác nhận</Btn>
          ) : (
            <div style={{ opacity: prog(t, 2.5, 0.4) }}>
              <Field label="URL webhook (dán vào SePay)" value={URL_TXT} x={26} y={120} w={440} mono focus={t > 4.3 && t < 5.8} />
              <div style={{ position: "absolute", left: 476, top: 144, width: 42, height: 42, borderRadius: 10, border: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⧉</div>
              <Field label="API Key (kiểu chứng thực: API Key)" value={"•".repeat(26)} x={540} y={120} w={330} mono focus={t > 6 && t < 7.6} />
              <div style={{ position: "absolute", left: 880, top: 144, width: 42, height: 42, borderRadius: 10, border: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⧉</div>
              <div style={{ position: "absolute", left: 26, top: 220, fontSize: 14, color: MUT }}>
                ▸ Cách cài trên SePay (5 phút) &nbsp;·&nbsp; Giao dịch gần đây: chưa có
              </div>
            </div>
          )}
        </div>
      </Browser>
      <Cursor
        path={[[0, 900, 560], [1.8, 262, 300], [3.6, 262, 300], [4.4, 648, 324], [5.9, 648, 324], [6.2, 1052, 324], [8, 1052, 324]]}
        clicks={[2.1, 4.5, 6.2]}
      />
      <Caption no="1" title="Trong mstudo: Bảng giá → Bật tự xác nhận" sub="Chép URL webhook và API Key, lát nữa dán vào SePay" />
    </>
  );
}

// ── CẢNH 2 · Đăng ký SePay ──────────────────────────────────────────────────
function SceneSignup() {
  const { t } = useLocal();
  const plan = t >= 4.2;
  return (
    <>
      <Bg from="#eef2fb" to="#dfe6f6" />
      <Browser url="my.sepay.vn/register" tint={SP}>
        <Illustration />
        {!plan ? (
          <>
            <div style={{ position: "absolute", left: 330, top: 40, fontSize: 26, fontWeight: 800 }}>Đăng ký tài khoản SePay</div>
            <Field tint={SP} label="Họ và tên" value={typed("Nguyễn Minh Anh", t, 0.5)} x={330} y={100} focus={t < 1.6} />
            <Field tint={SP} label="Số điện thoại" value={typed("0901 234 567", t, 1.6)} x={330} y={176} focus={t >= 1.6 && t < 2.5} />
            <Field tint={SP} label="Email" value={typed("studio.minhanh@gmail.com", t, 2.5, 26)} x={330} y={252} focus={t >= 2.5 && t < 3.6} />
            <Btn tint={SP} x={330} y={336} w={420} pressed={t > 3.8 && t < 4.1}>Đăng ký</Btn>
          </>
        ) : (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center", fontSize: 26, fontWeight: 800 }}>Chọn gói dịch vụ</div>
            {[
              { name: "Free", price: "0đ", note: "đủ cho studio nhỏ" },
              { name: "Gói trả phí", price: "…", note: "khi nhiều giao dịch" },
            ].map((p, i) => {
              const hi = i === 0 && t > 5.6;
              return (
                <div key={i} style={{ position: "absolute", left: 250 + i * 300, top: 110, width: 260, height: 250, borderRadius: 18,
                  border: `2px solid ${hi ? SP : BD}`, background: hi ? SPS : "#fff", padding: 24, textAlign: "center",
                  opacity: prog(t, 4.3 + i * 0.25) }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{p.name}</div>
                  <div style={{ fontSize: 40, fontWeight: 800, marginTop: 18, color: i === 0 ? SP : MUT }}>{p.price}</div>
                  <div style={{ fontSize: 14, color: MUT, marginTop: 10 }}>{p.note}</div>
                  {hi && <div style={{ marginTop: 22, fontWeight: 800, color: SP }}>✓ Đã chọn</div>}
                </div>
              );
            })}
          </>
        )}
      </Browser>
      <Cursor path={[[0, 600, 620], [3.4, 650, 457], [4.4, 650, 457], [5.3, 470, 330], [8, 470, 330]]} clicks={[3.85, 5.4]} />
      <Caption no="2" title="Đăng ký SePay, chọn gói Free" sub="my.sepay.vn · tài khoản riêng của studio bạn" />
    </>
  );
}

// ── CẢNH 3 · Liên kết ngân hàng ─────────────────────────────────────────────
const BANKS = ["Vietcombank", "MB Bank", "Techcombank", "ACB", "BIDV", "VPBank", "TPBank", "VietinBank"];
function SceneBank() {
  const { t } = useLocal();
  const picked = t >= 1.9;
  const done = t >= 5.4;
  return (
    <>
      <Bg from="#eef2fb" to="#dfe6f6" />
      <Browser url="my.sepay.vn/bankaccount" tint={SP}>
        <Illustration />
        <div style={{ position: "absolute", left: 40, top: 30, fontSize: 24, fontWeight: 800 }}>Thêm tài khoản ngân hàng</div>
        {!picked ? (
          BANKS.map((b, i) => (
            <div key={b} style={{ position: "absolute", left: 40 + (i % 4) * 245, top: 90 + Math.floor(i / 4) * 100, width: 225, height: 80,
              borderRadius: 14, border: `1.5px solid ${i === 1 && t > 1.4 ? SP : BD}`, background: i === 1 && t > 1.4 ? SPS : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, opacity: prog(t, 0.1 + i * 0.07) }}>
              {b}
            </div>
          ))
        ) : (
          <>
            <div style={{ position: "absolute", left: 40, top: 80, fontSize: 16, fontWeight: 700, color: SP }}>MB Bank</div>
            <Field tint={SP} label="Số tài khoản (đúng tài khoản trên QR của studio)" value={typed("0123 456 789", t, 2.3, 10)} x={40} y={112} w={460} focus={t < 3.8} />
            <Field tint={SP} label="Tên chủ tài khoản" value={typed("NGUYEN MINH ANH", t, 3.8, 14)} x={40} y={190} w={460} focus={t >= 3.8 && t < 5} />
            {!done ? (
              <Btn tint={SP} x={40} y={276} w={460} pressed={t > 5.05 && t < 5.35}>Liên kết</Btn>
            ) : (
              <div style={{ position: "absolute", left: 40, top: 276, width: 460, height: 48, borderRadius: 12, background: GS, color: G,
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, opacity: prog(t, 5.4) }}>
                ✓ Đã liên kết MB Bank · 0123 456 789
              </div>
            )}
          </>
        )}
      </Browser>
      <Cursor path={[[0, 800, 600], [1.3, 507, 232], [2, 507, 232], [2.4, 420, 360], [4.6, 420, 360], [5, 380, 399], [8, 380, 399]]} clicks={[1.6, 5.1]} />
      <Caption no="3" title="Liên kết tài khoản ngân hàng nhận tiền" sub="Làm theo hướng dẫn xác thực của SePay cho ngân hàng bạn chọn" />
    </>
  );
}

// ── CẢNH 4 · Tạo webhook ────────────────────────────────────────────────────
function SceneWebhook() {
  const { t } = useLocal();
  const form = t >= 1.8;
  const saved = t >= 9.6;
  const Opt = ({ x, y, label, on }: { x: number; y: number; label: string; on: boolean }) => (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: on ? 700 : 500 }}>
      <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? SP : "#b8bec8"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: SP }} />}
      </span>
      {label}
    </div>
  );
  return (
    <>
      <Bg from="#eef2fb" to="#dfe6f6" />
      <Browser url="my.sepay.vn/webhooks" tint={SP}>
        <Illustration />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 210, background: "#f3f5f9", borderRight: `1px solid ${BD}`, padding: "24px 14px", fontSize: 14 }}>
          {["Tổng quan", "Giao dịch", "Tài khoản ngân hàng", "Tích hợp WebHooks", "Cài đặt"].map((m, i) => (
            <div key={m} style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 4, fontWeight: i === 3 ? 800 : 500,
              background: i === 3 && t > 0.8 ? SPS : "transparent", color: i === 3 && t > 0.8 ? SP : INK }}>{m}</div>
          ))}
        </div>
        {!form ? (
          <>
            <div style={{ position: "absolute", left: 240, top: 30, fontSize: 24, fontWeight: 800 }}>Tích hợp WebHooks</div>
            <Btn tint={SP} x={240} y={80} pressed={t > 1.45 && t < 1.75}>+ Thêm webhooks</Btn>
          </>
        ) : (
          <div style={{ opacity: prog(t, 1.85, 0.35) }}>
            <div style={{ position: "absolute", left: 240, top: 18, fontSize: 22, fontWeight: 800 }}>Thêm webhooks</div>
            <div style={{ position: "absolute", left: 240, top: 62, fontSize: 13, fontWeight: 600, color: MUT }}>Sự kiện</div>
            <Opt x={240} y={86} label="Có tiền vào" on={t > 2.6} />
            <Opt x={390} y={86} label="Có tiền ra" on={false} />
            <Opt x={530} y={86} label="Cả hai" on={false} />
            <Field tint={SP} label="Gọi đến URL" value={t > 4 ? URL_TXT : ""} x={240} y={124} w={560} mono focus={t > 3.4 && t < 5.2} />
            <div style={{ position: "absolute", left: 240, top: 206, fontSize: 13, fontWeight: 600, color: MUT }}>Kiểu chứng thực</div>
            <Opt x={240} y={230} label="Không cần" on={t <= 5.8} />
            <Opt x={380} y={230} label="OAuth 2.0" on={false} />
            <Opt x={520} y={230} label="API Key" on={t > 5.8} />
            {t > 5.9 && <Field tint={SP} label="API Key" value={t > 7.5 ? KEY : ""} x={240} y={268} w={560} mono focus={t > 6.9 && t < 9} />}
            {!saved ? (
              t > 5.9 && <Btn tint={SP} x={240} y={352} w={160} pressed={t > 9.25 && t < 9.55}>Thêm</Btn>
            ) : (
              <div style={{ position: "absolute", left: 240, top: 352, height: 42, padding: "0 18px", borderRadius: 10, background: GS, color: G,
                display: "flex", alignItems: "center", fontWeight: 800, opacity: prog(t, 9.6) }}>✓ Đã thêm webhook</div>
            )}
          </div>
        )}
      </Browser>
      <Cursor
        path={[[0, 700, 600], [0.6, 215, 282], [1.1, 215, 282], [1.4, 430, 203], [2.2, 430, 203], [2.5, 360, 198], [3.2, 360, 198],
          [3.6, 600, 272], [5.4, 600, 272], [5.7, 640, 342], [6.6, 640, 342], [7, 600, 414], [9, 600, 414], [9.3, 430, 475], [12, 430, 475]]}
        clicks={[0.8, 1.55, 2.6, 3.9, 5.8, 7.3, 9.35]}
      />
      <Caption no="4" title="Tích hợp WebHooks → Thêm webhooks" sub="Sự kiện: Có tiền vào · dán URL · kiểu chứng thực API Key · dán API Key · Thêm" />
    </>
  );
}

// ── CẢNH 5 · Chuyển thử ─────────────────────────────────────────────────────
function SceneTest() {
  const { t } = useLocal();
  const arrived = t >= 3.2;
  return (
    <>
      <Bg from="#eef3f0" to="#dfe9e4" />
      {/* Điện thoại: chuyển thử 10.000đ */}
      <div style={{ position: "absolute", left: 110, top: 60, width: 300, height: 500, borderRadius: 40, background: INK, padding: 12, boxShadow: "0 30px 70px rgba(0,0,0,.3)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 30, background: "#fff", fontFamily: FONT, padding: 22, position: "relative" }}>
          <div style={{ fontSize: 15, color: MUT }}>App ngân hàng bất kỳ</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>Chuyển tiền</div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 20 }}>Tới</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>MB · 0123 456 789</div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 16 }}>Số tiền</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: G }}>10.000đ</div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 16 }}>Nội dung</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>chuyen thu</div>
          <div style={{ position: "absolute", left: 22, right: 22, bottom: 26, height: 50, borderRadius: 14, background: arrived ? GS : G,
            color: arrived ? G : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800,
            transform: `scale(${t > 1.6 && t < 1.9 ? 0.95 : 1})` }}>{arrived ? "✓ Thành công" : "Chuyển"}</div>
        </div>
      </div>
      {/* Mũi tên */}
      <div style={{ position: "absolute", left: 440, top: 340, width: 150 * prog(t, 2, 1.1), height: 5, borderRadius: 3, background: G }} />
      <Browser url="app.mstudo.com/dashboard/studio/pricing" x={620} y={120} w={560} h={420}>
        <div style={{ position: "absolute", left: 24, top: 20, fontSize: 18, fontWeight: 800 }}>Giao dịch gần đây</div>
        {arrived ? (
          <div style={{ position: "absolute", left: 24, right: 24, top: 64, borderRadius: 14, border: `1px solid ${BD}`, background: "#fff", padding: 16,
            opacity: prog(t, 3.2, 0.4), transform: `translateY(${(1 - prog(t, 3.2, 0.4)) * -10}px)` }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>+10.000đ</div>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: AM, background: AMS, borderRadius: 20, padding: "5px 11px" }}>Chưa rõ của ai</span>
            </div>
            <div style={{ fontSize: 13, color: MUT, marginTop: 4 }}>chuyen thu · MB Bank</div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <div style={{ flex: 1, height: 36, borderRadius: 9, border: `1px solid ${BD}`, fontSize: 13, color: MUT, display: "flex", alignItems: "center", padding: "0 10px" }}>Chọn đợt thanh toán để gán…</div>
              <div style={{ height: 36, padding: "0 14px", borderRadius: 9, border: `1px solid ${t > 5.4 ? G : BD}`, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center" }}>Bỏ qua</div>
            </div>
          </div>
        ) : (
          <div style={{ position: "absolute", left: 24, top: 64, fontSize: 14, color: MUT }}>Chưa có giao dịch nào.</div>
        )}
        {t > 4.2 && (
          <div style={{ position: "absolute", left: 24, right: 24, bottom: 22, borderRadius: 12, background: GS, color: G, padding: "12px 14px", fontSize: 14, fontWeight: 700, opacity: prog(t, 4.2) }}>
            Đã nối xong! Tiền không có mã thì nằm đây để bạn gán tay hoặc bỏ qua.
          </div>
        )}
      </Browser>
      <Cursor path={[[0, 330, 640], [1.4, 260, 497], [2.2, 260, 497], [4.8, 1100, 338], [7, 1100, 338]]} clicks={[1.7, 5.5]} />
      <Caption no="5" title="Chuyển thử 10.000đ để kiểm tra" sub="Vài giây sau giao dịch hiện trong mstudo là đã nối xong. Bấm Bỏ qua." />
    </>
  );
}

// ── CẢNH 6 · Kết quả hằng ngày ──────────────────────────────────────────────
function SceneResult() {
  const { t } = useLocal();
  const paid = t >= 2.6;
  return (
    <>
      <Bg from="#0b1f17" to="#12342a" />
      <div style={{ position: "absolute", left: 90, top: 70, width: 300, height: 560, borderRadius: 40, background: "#000", padding: 12, boxShadow: "0 30px 70px rgba(0,0,0,.4)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 30, background: "#fff", fontFamily: FONT, padding: 22, position: "relative" }}>
          <div style={{ fontSize: 15, color: MUT }}>Khách quét QR của đợt cọc</div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 22 }}>Số tiền</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: G }}>5.000.000đ</div>
          <div style={{ fontSize: 13, color: MUT, marginTop: 16 }}>Nội dung (tự điền từ QR)</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, background: GS, borderRadius: 8, padding: "8px 10px", marginTop: 4 }}>
            <span style={{ color: G }}>MSAB23CD45</span> HD-2026-014 Dat coc
          </div>
          <div style={{ fontSize: 12, color: MUT, marginTop: 8 }}>Khách không cần gõ gì, mã đợt có sẵn trong QR.</div>
          <div style={{ position: "absolute", left: 22, right: 22, bottom: 26, height: 50, borderRadius: 14, background: paid ? GS : G,
            color: paid ? G : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{paid ? "✓ Thành công" : "Chuyển"}</div>
        </div>
      </div>
      {/* Thông báo đến studio */}
      <div style={{ position: "absolute", left: 460, top: 90, width: 700, opacity: prog(t, 2.9), transform: `translateX(${(1 - prog(t, 2.9)) * 30}px)`,
        background: "#fff", borderRadius: 18, padding: "18px 22px", fontFamily: FONT, boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 13, color: MUT }}>🔔 mstudo · vừa xong</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>Đã nhận chuyển khoản</div>
        <div style={{ fontSize: 15, color: INK, marginTop: 4 }}>Chị Lan · Đặt cọc · 5.000.000đ (tự xác nhận)</div>
      </div>
      {/* Đợt thanh toán đổi trạng thái */}
      <div style={{ position: "absolute", left: 460, top: 250, width: 700, opacity: prog(t, 3.8), background: "#fff", borderRadius: 18, padding: "18px 22px", fontFamily: FONT, boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
        <div style={{ fontSize: 13, color: MUT }}>Hợp đồng HD-2026-014 · Thanh toán</div>
        {[
          { l: "Đặt cọc", a: "5.000.000đ", done: t > 4.5 },
          { l: "Thanh toán sau buổi chụp", a: "10.000.000đ", done: false },
        ].map((r) => (
          <div key={r.l} style={{ display: "flex", alignItems: "center", marginTop: 12, fontSize: 16 }}>
            <span style={{ fontWeight: 700 }}>{r.l}</span>
            <span style={{ marginLeft: 14, color: MUT }}>{r.a}</span>
            <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, borderRadius: 20, padding: "5px 12px",
              color: r.done ? G : AM, background: r.done ? GS : AMS }}>{r.done ? "✓ Đã thu" : "Chờ thu"}</span>
          </div>
        ))}
      </div>
      {/* Zalo tới khách */}
      <div style={{ position: "absolute", left: 460, top: 430, width: 520, opacity: prog(t, 5.3), background: "#e8f1ff", borderRadius: "18px 18px 18px 4px", padding: "14px 18px", fontFamily: FONT, color: INK }}>
        <div style={{ fontSize: 12, color: SP, fontWeight: 700 }}>Zalo · gửi khách</div>
        <div style={{ fontSize: 15, marginTop: 4 }}>Chào chị Lan, studio đã nhận cọc 5.000.000đ. Hẹn gặp chị ở buổi chụp ạ!</div>
      </div>
      <div style={{ position: "absolute", left: 460, bottom: 44, opacity: prog(t, 6.6), fontFamily: FONT, color: "#fff", fontSize: 26, fontWeight: 800 }}>
        Xong. Từ giờ bạn chỉ cần chụp ảnh. ✨
      </div>
    </>
  );
}

// ── Dựng khung ──────────────────────────────────────────────────────────────
export const SEPAY_GUIDE_STEPS = [
  { start: 0, end: 6, label: "Giới thiệu" },
  { start: 6, end: 14.5, label: "1 · Bật trong mstudo" },
  { start: 14.5, end: 22, label: "2 · Đăng ký SePay" },
  { start: 22, end: 29.5, label: "3 · Liên kết ngân hàng" },
  { start: 29.5, end: 41.5, label: "4 · Tạo webhook" },
  { start: 41.5, end: 49, label: "5 · Chuyển thử" },
  { start: 49, end: 57.5, label: "Kết quả" },
] as const;
export const SEPAY_GUIDE_DURATION = 57.5;

function Scenes() {
  const S = SEPAY_GUIDE_STEPS;
  const parts = [SceneIntro, SceneMstudo, SceneSignup, SceneBank, SceneWebhook, SceneTest, SceneResult];
  return (
    <>
      {parts.map((P, i) => (
        <Scene key={i} start={S[i].start} end={S[i].end}><P /></Scene>
      ))}
    </>
  );
}

declare global {
  interface Window {
    __sepayGuide?: { setTime: (t: number) => void; duration: number };
  }
}

export default function SepayGuideVideo({ renderMode = false, autoPlay = false, style }: { renderMode?: boolean; autoPlay?: boolean; style?: CSSProperties }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(autoPlay && !renderMode);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.05, el.clientWidth / 1280));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!renderMode) return;
    window.__sepayGuide = { setTime, duration: SEPAY_GUIDE_DURATION };
    return () => { delete window.__sepayGuide; };
  }, [renderMode]);

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
        if (n >= SEPAY_GUIDE_DURATION) {
          setPlaying(false);
          return SEPAY_GUIDE_DURATION - 0.01;
        }
        return n;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const ctxTime = useMemo(() => time, [time]);
  const current = SEPAY_GUIDE_STEPS.findIndex((s) => time >= s.start && time < s.end);

  return (
    <div style={style}>
      <div
        ref={wrapRef}
        onClick={renderMode ? undefined : () => {
          if (!playing && time >= SEPAY_GUIDE_DURATION - 0.05) setTime(0);
          setPlaying((p) => !p);
        }}
        style={{ position: "relative", width: "100%", aspectRatio: "1280 / 720", overflow: "hidden", background: "#0b1f17",
          borderRadius: renderMode ? 0 : 12, cursor: renderMode ? "default" : "pointer" }}
        role="img"
        aria-label="Video hướng dẫn nối SePay với mstudo để tự xác nhận chuyển khoản"
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <Timeline.Provider value={ctxTime}>
            <Scenes />
          </Timeline.Provider>
        </div>
        {!renderMode && !playing && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill={G} /></svg>
            </div>
          </div>
        )}
      </div>
      {!renderMode && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{ height: 6, borderRadius: 3, background: "var(--bd, #e6e8ec)", cursor: "pointer", position: "relative" }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setTime(clamp((e.clientX - r.left) / r.width, 0, 1) * SEPAY_GUIDE_DURATION);
            }}
            aria-label="Tua video"
          >
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(time / SEPAY_GUIDE_DURATION) * 100}%`, borderRadius: 3, background: G }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {SEPAY_GUIDE_STEPS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => { setTime(s.start + 0.01); setPlaying(true); }}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ border: `1px solid ${i === current ? G : "var(--bd, #e6e8ec)"}`, color: i === current ? G : "var(--tx2, #5b616b)", background: i === current ? GS : "transparent" }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
