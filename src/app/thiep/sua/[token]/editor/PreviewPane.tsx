"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Monitor, RotateCw, Smartphone } from "lucide-react";
import type { WeddingConfig, WeddingInvitation } from "@/lib/types";
import WeddingRenderer, { type Wish } from "../../../[slug]/WeddingRenderer";

// ────────────────────────────────────────────────────────────────────────────
// KHUNG XEM TRƯỚC TRỰC TIẾP
// Thiệp được render vào một <iframe> cùng nguồn: bên trong iframe, 100vh đúng
// bằng chiều cao điện thoại, nút nhạc position:fixed nằm đúng chỗ, và CSS của
// thiệp không lẫn với CSS của trình chỉnh sửa. Nội dung là CHÍNH các component
// thiệp thật (qua createPortal) nên những gì thấy ở đây là thứ khách sẽ thấy.
// ────────────────────────────────────────────────────────────────────────────

const DEVICES = {
  phone: { w: 390, h: 844, label: "Điện thoại" },
  wide: { w: 1180, h: 800, label: "Máy tính" },
} as const;

type Device = keyof typeof DEVICES;

/** Iframe cùng nguồn + portal: sao chép stylesheet của trang cha vào trong. */
function Frame({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  const sync = useCallback((doc: Document) => {
    // Biến phông (next/font) nằm ở class của <html> → copy sang để thiệp trong
    // iframe dùng đúng bộ chữ, không rơi về phông hệ thống.
    doc.documentElement.className = document.documentElement.className;
    doc.documentElement.setAttribute("data-theme", "light");
    doc.documentElement.lang = "vi";

    const head = doc.head;
    // Gắn <base> để đường dẫn tương đối (file phông /_next/static/…) giải đúng.
    if (!head.querySelector("base")) {
      const base = doc.createElement("base");
      base.href = window.location.origin + "/";
      head.appendChild(base);
    }
    const want = Array.from(document.querySelectorAll<HTMLElement>('head style, head link[rel="stylesheet"]'));
    const have = new Set(Array.from(head.querySelectorAll<HTMLElement>("style, link")).map((n) => n.getAttribute("data-wed-src") ?? ""));
    want.forEach((node, i) => {
      const key = node.tagName === "LINK" ? (node as HTMLLinkElement).href : `style-${i}-${node.textContent?.length ?? 0}`;
      if (have.has(key)) return;
      const copy = node.cloneNode(true) as HTMLElement;
      copy.setAttribute("data-wed-src", key);
      head.appendChild(copy);
    });
    doc.body.style.margin = "0";
  }, []);

  // Iframe about:blank cùng nguồn: tài liệu bên trong có NGAY sau khi gắn vào
  // DOM. KHÔNG dùng onLoad của React — sự kiện load của iframe rỗng thường bắn
  // xong trước lúc React kịp gắn listener, khung xem trước sẽ trắng mãi.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let stopped = false;

    const attach = () => {
      if (stopped) return;
      const doc = el.contentDocument;
      if (!doc?.body) { raf = requestAnimationFrame(attach); return; }
      sync(doc);
      setBody(doc.body);
    };
    attach();
    el.addEventListener("load", attach);
    return () => { stopped = true; cancelAnimationFrame(raf); el.removeEventListener("load", attach); };
  }, [sync]);

  // Ở chế độ dev, Next chèn thêm <style> khi sửa file → đồng bộ lại để khung
  // xem trước không bị mất style giữa chừng.
  useEffect(() => {
    if (!body) return;
    const doc = body.ownerDocument;
    const obs = new MutationObserver(() => sync(doc));
    obs.observe(document.head, { childList: true });
    return () => obs.disconnect();
  }, [body, sync]);

  return (
    <>
      <iframe
        ref={ref}
        title="Xem trước thiệp cưới"
        style={{ width, height, border: 0, display: "block", background: "#fff" }}
      />
      {body && createPortal(children, body)}
    </>
  );
}

export default function PreviewPane({
  inv, wishes, guest, storyUrl, publicUrl,
}: {
  inv: WeddingInvitation;
  wishes: Wish[];
  guest: string;
  storyUrl?: string;
  publicUrl: string;
}) {
  const [device, setDevice] = useState<Device>("phone");
  const [nonce, setNonce] = useState(0);
  const [scale, setScale] = useState(1);
  const hostRef = useRef<HTMLDivElement>(null);
  const { w, h } = DEVICES[device];

  // Thu nhỏ vừa đúng chiều ngang cột xem trước (không bao giờ phóng to quá 1:1).
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => setScale(Math.min(1, (host.clientWidth - 8) / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [w]);

  const cfg = inv.config as WeddingConfig;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2">
        <div className="flex items-center gap-1 rounded-full bg-stone-100 p-0.5">
          {(Object.keys(DEVICES) as Device[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDevice(k)}
              title={DEVICES[k].label}
              aria-pressed={device === k}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${device === k ? "bg-white font-medium text-stone-800 shadow-sm" : "text-stone-500"}`}
            >
              {k === "phone" ? <Smartphone size={13} /> : <Monitor size={13} />} {DEVICES[k].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 hidden text-[11px] text-stone-400 sm:inline">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setNonce((n) => n + 1)} title="Xem lại từ đầu" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100">
            <RotateCw size={14} />
          </button>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" title="Mở thiệp thật ở tab mới" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div ref={hostRef} className="flex-1 overflow-auto bg-stone-100 p-2">
        <div style={{ width: w * scale, height: h * scale, margin: "0 auto" }}>
          <div
            style={{
              width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left",
              borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px -12px rgba(30,25,20,.35)",
            }}
          >
            {/* nonce: đổi khi bấm "Xem lại từ đầu" → dựng lại iframe để hiệu ứng chạy lại. */}
            <Frame key={`${device}-${nonce}`} width={w} height={h}>
              <WeddingRenderer
                key={`${inv.template}-${nonce}`}
                inv={inv}
                wishes={cfg.guestbook_enabled === false ? [] : wishes}
                guest={guest}
                storyUrl={storyUrl}
                preview
              />
            </Frame>
          </div>
        </div>
      </div>
    </div>
  );
}
