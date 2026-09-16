"use client";

import { useState } from "react";
import { Globe, Check, Loader2, Trash2, RefreshCw } from "lucide-react";

type DnsRow = { type: string; name: string; value: string };

/** Studio custom-domain manager (site builder → site settings). */
export default function CustomDomain({ initialDomain, initialVerified }: { initialDomain: string | null; initialVerified: boolean }) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [saved, setSaved] = useState(initialDomain ?? "");
  const [verified, setVerified] = useState(initialVerified);
  const [dns, setDns] = useState<DnsRow[]>([]);
  const [busy, setBusy] = useState<null | "set" | "verify" | "remove">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  async function call(action: string, extra?: Record<string, unknown>) {
    setBusy(action as typeof busy);
    setMsg(null);
    const res = await fetch("/api/site/domain", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg(d.hint || (d.error === "domain_taken" ? "Tên miền đã được dùng bởi tài khoản khác." : d.error === "bad_domain" ? "Tên miền không hợp lệ." : "Có lỗi, thử lại."));
      return null;
    }
    if (d.dns) setDns(d.dns);
    if (typeof d.configured === "boolean") setConfigured(d.configured);
    return d;
  }

  async function set() {
    const d = await call("set", { domain });
    if (!d) return;
    setSaved(d.custom_domain);
    setVerified(!!d.verified);
    // d.hint: lý do cụ thể khi Vercel từ chối (vd domain đang ở project khác) —
    // nói thẳng thay vì bảo studio đi trỏ DNS trong khi DNS không phải vấn đề.
    setMsg(d.verified ? "Đã kết nối tên miền!" : (d.hint as string) || "Đã lưu. Trỏ DNS theo hướng dẫn rồi bấm “Kiểm tra”.");
  }
  async function verify() {
    const d = await call("verify");
    if (!d) return;
    setVerified(!!d.verified);
    setMsg(d.verified ? "Tên miền đã xác minh — trang chạy trên domain của bạn." : "Chưa xác minh. Kiểm tra lại bản ghi DNS (có thể mất tới vài giờ).");
  }
  async function remove() {
    if (!confirm("Gỡ tên miền riêng khỏi trang?")) return;
    const d = await call("remove");
    if (!d) return;
    setSaved(""); setDomain(""); setVerified(false); setDns([]);
    setMsg("Đã gỡ tên miền.");
  }

  const inp = "input";
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        <Globe size={14} /> Tên miền riêng
        {saved && (verified
          ? <span style={{ fontSize: 11, color: "var(--success)" }}>· Đã xác minh</span>
          : <span style={{ fontSize: 11, color: "var(--gold)" }}>· Chờ DNS</span>)}
      </label>
      <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>
        Dùng tên miền mua riêng (vd studio.com). Mọi hoạt động gửi khách sẽ chạy trên domain này.
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <input className={inp} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="studio.com" spellCheck={false} style={{ flex: 1 }} />
        <button onClick={set} disabled={busy !== null || !domain.trim() || domain.trim() === saved} className="btn-primary" style={{ padding: "0 12px" }}>
          {busy === "set" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Lưu
        </button>
      </div>

      {saved && (
        <>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <button onClick={verify} disabled={busy !== null} className="btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}>
              {busy === "verify" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Kiểm tra
            </button>
            <button onClick={remove} disabled={busy !== null} className="btn-ghost" style={{ fontSize: 12, padding: "6px 10px", color: "var(--danger)" }}>
              <Trash2 size={13} /> Gỡ
            </button>
          </div>

          {!verified && dns.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, background: "var(--surface2)", borderRadius: 10, padding: 10 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Trỏ DNS tại nhà cung cấp tên miền:</p>
              {dns.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", borderTop: i ? "1px solid var(--border)" : undefined }}>
                  <span style={{ color: "var(--text3)" }}>{r.type}</span>
                  <span>{r.name}</span>
                  <code style={{ color: "var(--text2)" }}>{r.value}</code>
                </div>
              ))}
              {configured === false && (
                <p style={{ marginTop: 6, color: "var(--text3)" }}>Sau khi trỏ DNS, cần thêm tên miền vào project trên Vercel (nếu máy chủ chưa nối Vercel API).</p>
              )}
            </div>
          )}
        </>
      )}

      {msg && <p style={{ marginTop: 8, fontSize: 12, color: "var(--text2)" }}>{msg}</p>}
    </div>
  );
}
