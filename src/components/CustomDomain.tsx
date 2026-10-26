"use client";

import { Fragment } from "react";
import { Globe, Check, Loader2, Trash2, RefreshCw, Copy } from "lucide-react";
import { apexOf } from "@/lib/domain-dns";
import { useUiV2 } from "@/components/v2/UiV2Context";
import CustomDomainV2 from "./CustomDomainV2";
import { hostLabelHint, useCustomDomain } from "./useCustomDomain";

/** Studio custom-domain manager (site builder → site settings). */
export default function CustomDomain(props: { initialDomain: string | null; initialVerified: boolean }) {
  return useUiV2() ? <CustomDomainV2 {...props} /> : <CustomDomainV1 {...props} />;
}

function CustomDomainV1({ initialDomain, initialVerified }: { initialDomain: string | null; initialVerified: boolean }) {
  const {
    domain, setDomain, saved, verified, rows, busy, msg, configured,
    guideOpen, setGuideOpen, copied, copy, set, verify, remove,
  } = useCustomDomain(initialDomain, initialVerified);

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

          {!verified && rows.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, background: "var(--surface2)", borderRadius: 10, padding: 10 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Thêm bản ghi DNS tại nơi bạn mua tên miền:</p>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "4px 8px", alignItems: "center" }}>
                <span style={{ color: "var(--text3)", fontSize: 11 }}>Loại</span>
                <span style={{ color: "var(--text3)", fontSize: 11 }}>Tên / Host</span>
                <span style={{ color: "var(--text3)", fontSize: 11 }}>Giá trị</span>
                {rows.map((r, i) => (
                  <Fragment key={i}>
                    <b>{r.type}</b>
                    <code>{r.name}</code>
                    <button onClick={() => copy(r.value)} title="Chép giá trị"
                      style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--text2)", textAlign: "left" }}>
                      <code style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.value}</code>
                      {copied === r.value ? <Check size={12} style={{ flexShrink: 0, color: "var(--success)" }} /> : <Copy size={12} style={{ flexShrink: 0 }} />}
                    </button>
                  </Fragment>
                ))}
              </div>
              {configured === false && (
                <p style={{ marginTop: 6, color: "var(--text3)" }}>Sau khi trỏ DNS, cần thêm tên miền vào project trên Vercel (nếu máy chủ chưa nối Vercel API).</p>
              )}
            </div>
          )}

          {!verified && (
          <details open={guideOpen} onToggle={(e) => setGuideOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: 10, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--text2)" }}>Hướng dẫn trỏ DNS từng bước</summary>
            <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text2)", lineHeight: 1.55, display: "grid", gap: 6 }}>
              <li>
                Đăng nhập trang quản lý tên miền nơi bạn mua <b>{apexOf(saved)}</b> (Mắt Bão, PA Vietnam, Nhân Hòa, Tenten, iNET, GoDaddy, Namecheap, Cloudflare…) → mở mục <b>Quản lý DNS</b> / <b>DNS Records</b>.
              </li>
              <li>
                <b>Xoá</b> bản ghi A / CNAME / AAAA cũ có cùng <b>Tên/Host</b> với bảng trên (thường là bản ghi trỏ về trang mặc định của nhà cung cấp) — trùng tên là DNS không chạy.
              </li>
              <li>
                <b>Thêm</b> từng bản ghi trong bảng trên: chọn đúng <b>Loại</b>, ô <b>Tên/Host</b> nhập như bảng (<code>@</code> = tên miền gốc; nơi nào không nhận <code>@</code> thì để trống), dán <b>Giá trị</b> (bấm vào giá trị để chép). TTL để mặc định.
              </li>
              <li>
                Dùng <b>Cloudflare</b>: bấm đám mây cam thành <b>xám (DNS only)</b>, không thì không xác minh được.
              </li>
              <li>
                Chờ 5–30 phút (có khi tới vài giờ) rồi bấm <b>Kiểm tra</b>. Khi báo “Đã xác minh”, trang chạy trên tên miền của bạn, HTTPS (ổ khoá) được cấp tự động và mọi link gửi khách chuyển sang tên miền này.
              </li>
            </ol>
            <p style={{ marginTop: 8, color: "var(--text3)" }}>
              Chỉ đúng tên miền đã nhập ({saved}) được kết nối. Muốn khách vào bằng {hostLabelHint(saved)} thì gỡ rồi nhập lại tên miền đó.
            </p>
          </details>
          )}
        </>
      )}

      {msg && <p style={{ marginTop: 8, fontSize: 12, color: "var(--text2)" }}>{msg}</p>}
    </div>
  );
}
