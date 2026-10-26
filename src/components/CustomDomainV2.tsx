"use client";

import { useId } from "react";
import { Check, ChevronRight, Copy, Globe, Info, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Badge, btn, inputCls } from "@/components/v2/kit";
import { apexOf } from "@/lib/domain-dns";
import { hostLabelHint, useCustomDomain } from "./useCustomDomain";

/* ═══════════════════════════════════════════════════════════════════════════
   TÊN MIỀN RIÊNG — giao diện mới. Cùng logic với CustomDomain (./useCustomDomain).
   Nằm trong khối "Địa chỉ trang" của Website & chatbox và ngăn Cài đặt trang
   của trình dựng, nên tự kẻ một vạch ngăn phía trên thay vì dựng thẻ riêng.
     • Tiêu đề + nhãn trạng thái (đã xác minh / chờ trỏ DNS).
     • Ô tên miền + nút Lưu; Kiểm tra / Gỡ hiện khi đã lưu.
     • Bản ghi DNS thành từng dòng, bấm vào giá trị là chép; hướng dẫn từng
       bước thu gọn được.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CustomDomainV2({ initialDomain, initialVerified }: { initialDomain: string | null; initialVerified: boolean }) {
  const d = useCustomDomain(initialDomain, initialVerified);
  const id = useId();
  const muted = { color: "var(--tx3)" } as const;

  return (
    <div className="mt-4 flex flex-col gap-3 pt-4" style={{ borderTop: "1px solid var(--bd2)" }}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="v2-label flex items-center gap-1.5">
            <Globe size={15} style={{ color: "var(--tx2)" }} /> Tên miền riêng
          </label>
          {d.saved ? (
            d.verified ? (
              <Badge tone="green" dot>Đã xác minh</Badge>
            ) : (
              <Badge tone="amber" dot>Chờ trỏ DNS</Badge>
            )
          ) : null}
        </div>
        <p className="text-[12.5px]" style={muted}>
          Dùng tên miền mua riêng (vd studio.com). Mọi hoạt động gửi khách sẽ chạy trên domain này.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          id={id}
          className={`${inputCls} min-w-0 flex-1`}
          value={d.domain}
          onChange={(e) => d.setDomain(e.target.value)}
          placeholder="studio.com"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={d.set}
          disabled={d.busy !== null || !d.domain.trim() || d.domain.trim() === d.saved}
          className={btn("secondary")}
        >
          {d.busy === "set" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Lưu
        </button>
      </div>

      {d.saved && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={d.verify} disabled={d.busy !== null} className={btn("secondary", "sm")}>
              {d.busy === "verify" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Kiểm tra
            </button>
            <button type="button" onClick={d.remove} disabled={d.busy !== null} className={btn("danger", "sm")}>
              <Trash2 size={14} /> Gỡ tên miền
            </button>
          </div>

          {!d.verified && d.rows.length > 0 && (
            <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
              <p className="px-3.5 py-2.5 text-[13px] font-semibold" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                Thêm bản ghi DNS tại nơi bạn mua tên miền
              </p>
              {d.rows.map((r, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5"
                  style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}
                >
                  <span className="w-[58px] flex-none">
                    <Badge tone="blue">{r.type}</Badge>
                  </span>
                  <span className="min-w-[72px] flex-none">
                    <span className="block text-[11px]" style={muted}>Tên / Host</span>
                    <code className="text-[13px] font-semibold">{r.name}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => d.copy(r.value)}
                    title="Chép giá trị"
                    className="flex min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left"
                    style={{ background: "var(--sf2)", color: "var(--tx2)" }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px]" style={muted}>Giá trị · bấm để chép</span>
                      <code className="block truncate text-[12.5px]" style={{ color: "var(--tx)" }}>{r.value}</code>
                    </span>
                    {d.copied === r.value ? (
                      <Check size={15} className="flex-none" style={{ color: "var(--gn)" }} />
                    ) : (
                      <Copy size={15} className="flex-none" />
                    )}
                  </button>
                </div>
              ))}
              {d.configured === false && (
                <p className="px-3.5 py-2.5 text-[12.5px]" style={{ ...muted, borderTop: "1px solid var(--bd2)" }}>
                  Sau khi trỏ DNS, cần thêm tên miền vào project trên Vercel (nếu máy chủ chưa nối Vercel API).
                </p>
              )}
            </div>
          )}

          {!d.verified && (
            <details
              open={d.guideOpen}
              onToggle={(e) => d.setGuideOpen((e.target as HTMLDetailsElement).open)}
              className="group rounded-[12px] px-3.5 py-2.5"
              style={{ background: "var(--sf2)" }}
            >
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                <ChevronRight size={15} className="flex-none transition-transform group-open:rotate-90" style={{ color: "var(--tx3)" }} />
                Hướng dẫn trỏ DNS từng bước
              </summary>
              <ol className="mt-2.5 grid list-decimal gap-1.5 pl-5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                <li>
                  Đăng nhập trang quản lý tên miền nơi bạn mua <b>{apexOf(d.saved)}</b> (Mắt Bão, PA Vietnam, Nhân Hòa, Tenten, iNET, GoDaddy, Namecheap, Cloudflare…) → mở mục <b>Quản lý DNS</b> / <b>DNS Records</b>.
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
              <p className="mt-2 text-[12.5px]" style={muted}>
                Chỉ đúng tên miền đã nhập ({d.saved}) được kết nối. Muốn khách vào bằng {hostLabelHint(d.saved)} thì gỡ rồi nhập lại tên miền đó.
              </p>
            </details>
          )}
        </>
      )}

      {d.msg && (
        <p className="flex items-start gap-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
          <Info size={15} className="mt-px flex-none" style={muted} /> {d.msg}
        </p>
      )}
    </div>
  );
}
