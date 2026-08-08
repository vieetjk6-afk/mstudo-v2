"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Smartphone, Monitor, Link as LinkIcon, Copy, Check,
  QrCode, Download, Printer, ExternalLink, Lock, RotateCw, Eye, PenLine,
} from "lucide-react";
import { Panel, Pill } from "@/components/studio/ui";

/**
 * Xem như khách trên điện thoại (tính năng mới số 8): khung 376px có thanh
 * trạng thái và thanh địa chỉ, để studio thấy đúng thứ khách thấy — 9/10 khách
 * mở hợp đồng bằng điện thoại, mà studio thì luôn dựng trên màn hình rộng.
 */
const PHONE_W = 376;

export default function SharePreview({
  contractId, code, title, clientName, clientPhone, signedAt, viewedAt, shareUrl, previewPath,
}: {
  contractId: string;
  code: string | null;
  title: string;
  clientName: string | null;
  clientPhone: string | null;
  signedAt: string | null;
  viewedAt: string | null;
  /** Link BRANDED gửi khách (có thể nằm trên tên miền riêng của studio). */
  shareUrl: string;
  /**
   * Cùng trang đó nhưng theo đường dẫn CÙNG GỐC với bảng điều khiển.
   *
   * App đặt `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`, nên studio
   * nào có tên miền riêng mà nhúng thẳng `shareUrl` thì trình duyệt chặn và
   * khung xem trước trắng trơn — đúng những studio hay dùng màn này nhất.
   * `/c/<token>` chạy trên cả hai host và ra cùng một nội dung, nên khung dùng
   * đường dẫn cùng gốc, còn link hiện / chép / QR vẫn là bản branded.
   */
  previewPath: string;
}) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  // Đổi để ép iframe tải lại sau khi studio sửa hợp đồng ở tab khác.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const img = await QRCode.toDataURL(shareUrl, { margin: 1, width: 640 });
      if (alive) setQr(img);
    })();
    return () => { alive = false; };
  }, [shareUrl]);

  function copy() {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px 24px;color:#1a1a1c}
      h1{font-size:22px;margin:0 0 4px}p{color:#6b6a70;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}
      .u{font-size:12px;color:#8b8a90;word-break:break-all}</style></head>
      <body><h1>${title}</h1><p>Quét mã để mở hợp đồng</p>
      <img src="${qr}" alt="QR"/><p class="u">${shareUrl}</p>
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="page-in flex flex-col gap-3.5">
      {/* ── Hàng công cụ: quay lại · thiết bị · link ────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/studio/contracts/${contractId}`}
          aria-label="Về chi tiết hợp đồng"
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
          style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
        >
          <ArrowLeft size={19} />
        </Link>

        <div className="flex flex-none gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          {([["phone", "Điện thoại", Smartphone], ["desktop", "Máy tính", Monitor]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setDevice(k)}
              className="flex flex-none items-center gap-1.5 rounded-[8px] px-[14px] py-[6.5px] text-[12.5px] font-semibold"
              style={device === k ? { background: "var(--sf)", color: "var(--tx)", boxShadow: "0 1px 2px rgba(20,15,25,.08)" } : { color: "var(--tx2)" }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex min-w-0 flex-none items-center gap-2.5 rounded-[10px] py-1.5 pl-3.5 pr-2" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
          <LinkIcon size={17} className="flex-none" style={{ color: "var(--tx3)" }} />
          <span className="min-w-0 truncate font-mono text-[12.5px] font-semibold">{shareUrl}</span>
          <button
            onClick={copy}
            className="flex flex-none items-center gap-1 whitespace-nowrap rounded-[8px] px-[11px] py-1.5 text-[11.5px] font-bold"
            style={{ background: "var(--acS)", color: "var(--ac)" }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Đã chép" : "Sao chép"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Khung xem trước ─────────────────────────────────────────── */}
        <div
          className="flex flex-col items-center gap-3.5 rounded-[16px] p-[22px]"
          style={{ background: "repeating-linear-gradient(135deg, var(--bg2) 0 14px, var(--bg) 14px 28px)" }}
        >
          <div className="flex w-full flex-wrap items-center gap-2.5">
            <p className="min-w-0 flex-1 text-[11.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {device === "phone"
                ? "Khung 376px — gần đúng iPhone. Hầu hết khách mở hợp đồng bằng điện thoại."
                : "Khung rộng — kiểm lại bố cục khi khách mở trên máy tính."}
            </p>
            <button
              onClick={() => setNonce((n) => n + 1)}
              className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-semibold"
              style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
            >
              <RotateCw size={13} /> Tải lại
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-semibold"
              style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
            >
              <ExternalLink size={13} /> Mở tab mới
            </a>
          </div>

          <div
            className="w-full overflow-hidden rounded-[16px]"
            style={{ maxWidth: device === "phone" ? PHONE_W : 900, background: "var(--sf)", boxShadow: "0 12px 40px rgba(20,15,25,.12)" }}
          >
            {device === "phone" && (
              <>
                {/* Thanh trạng thái + thanh địa chỉ — để nhìn ra ngay phần nội
                    dung nào bị thanh trình duyệt che mất trên máy khách. */}
                <div className="flex items-center justify-between px-5 pb-1.5 pt-2.5 text-[11.5px] font-bold" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                  <span className="tnum">9:41</span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-[9px] w-[3px] rounded-sm" style={{ background: "var(--tx2)" }} />
                    <span className="inline-block h-[11px] w-[3px] rounded-sm" style={{ background: "var(--tx2)" }} />
                    <span className="inline-block h-[13px] w-[3px] rounded-sm" style={{ background: "var(--tx2)" }} />
                    <span className="ml-1 inline-block h-[10px] w-[18px] rounded-[3px]" style={{ border: "1.5px solid var(--tx2)" }} />
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3.5 pb-2 pt-1.5" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                  <Lock size={13} className="flex-none" style={{ color: "var(--gn)" }} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]" style={{ color: "var(--tx3)" }}>{shareUrl}</span>
                </div>
              </>
            )}

            <iframe
              key={`${device}-${nonce}`}
              src={previewPath}
              title="Xem trước trang hợp đồng của khách"
              className="block w-full border-0"
              style={{ height: device === "phone" ? 720 : 820, background: "#fff" }}
            />
          </div>
        </div>

        {/* ── Cột phải: trạng thái khách + mã QR ───────────────────────── */}
        <div className="flex flex-col gap-3.5">
          <Panel className="px-[18px] py-4">
            <p className="text-[13.5px] font-bold">{title}</p>
            <p className="tnum mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
              {code || "chưa có mã"}{clientName ? ` · ${clientName}` : ""}
            </p>

            <div className="mt-3.5 flex flex-col gap-2.5 pt-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
              <div className="flex items-center gap-2.5">
                <Eye size={17} className="flex-none" style={{ color: "var(--tx3)" }} />
                <span className="flex-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>Khách đã mở</span>
                <Pill tone={viewedAt ? "blue" : "gray"}>
                  {viewedAt ? new Date(viewedAt).toLocaleDateString("vi-VN") : "Chưa mở"}
                </Pill>
              </div>
              <div className="flex items-center gap-2.5">
                <PenLine size={17} className="flex-none" style={{ color: "var(--tx3)" }} />
                <span className="flex-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>Khách đã ký</span>
                <Pill tone={signedAt ? "green" : "amber"}>
                  {signedAt ? new Date(signedAt).toLocaleDateString("vi-VN") : "Chưa ký"}
                </Pill>
              </div>
            </div>

            <p className="mt-3.5 rounded-[10px] px-3.5 py-3 text-[11.5px] leading-[1.55]" style={{ background: "var(--sf2)", color: "var(--tx2)", textWrap: "pretty" }}>
              Khách mở link cần nhập <b>số điện thoại</b> ({clientPhone || "chưa có trong hợp đồng"}) để xem — đừng gửi kèm mật khẩu nào khác.
            </p>
          </Panel>

          <Panel className="px-[18px] py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex-none rounded-[10px] p-[9px]" style={{ background: "var(--acS)", color: "var(--ac)", lineHeight: 0 }}>
                <QrCode size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold">Mã QR</p>
                <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>Khách quét là mở hợp đồng</p>
              </div>
              <button
                onClick={() => setShowQr((v) => !v)}
                className="flex-none rounded-[9px] px-3 py-[7px] text-[12px] font-semibold"
                style={{ border: "1px solid var(--bd)" }}
              >
                {showQr ? "Ẩn" : "Hiện"}
              </button>
            </div>

            {showQr && (
              qr ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Mã QR hợp đồng" className="mx-auto mt-3.5 h-48 w-48 rounded-[10px]" />
                  <div className="mt-3 flex gap-2">
                    <a
                      href={qr}
                      download={`qr-${code || "hop-dong"}.png`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12px] font-semibold"
                      style={{ border: "1px solid var(--bd)" }}
                    >
                      <Download size={14} /> Tải ảnh
                    </a>
                    <button
                      onClick={printQr}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12px] font-semibold"
                      style={{ background: "var(--ac)", color: "#fff" }}
                    >
                      <Printer size={14} /> In
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3.5 text-center text-[12px]" style={{ color: "var(--tx3)" }}>Đang tạo mã…</p>
              )
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
