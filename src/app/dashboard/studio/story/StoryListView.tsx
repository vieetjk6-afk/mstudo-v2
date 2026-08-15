"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ExternalLink, Pencil, Copy, Check, Users, FileText, Plus, Loader2, QrCode, Printer, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ThiepTabs from "@/components/studio/ThiepTabs";
import { studioUrl } from "@/lib/hosts";
import { escapeHtml } from "@/lib/html-escape";
import type { StoryConfig } from "@/lib/types";

export type StoryRow = {
  id: string; slug: string; edit_token: string; published: boolean;
  config: StoryConfig; contract_id: string | null; wish_count: number;
};

function slugify(s: string): string {
  const base = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return `${base || "love-story"}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function StoryListView({ rows, ownerId, studioHost }: { rows: StoryRow[]; ownerId: string; studioHost: string | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<{ couple: string; url: string; img: string } | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500);
  }
  async function createNew() {
    setCreating(true); setErr(null);
    const editToken = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "");
    const { data, error } = await supabase.from("story_pages").insert({ owner_id: ownerId, slug: slugify("love-story"), edit_token: editToken, config: { wishes_enabled: true } }).select("edit_token").single();
    setCreating(false);
    if (error || !data) { setErr(error?.message || "Không tạo được trang."); return; }
    window.open(studioUrl(studioHost, `/story/sua/${data.edit_token}`), "_blank");
    router.refresh();
  }
  async function openQr(couple: string, url: string) {
    const QRCode = (await import("qrcode")).default;
    const img = await QRCode.toDataURL(url, { margin: 1, width: 640, color: { dark: "#a9527f", light: "#ffffff" } });
    setQr({ couple, url, img });
  }
  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=520,height=680"); if (!w) return;
    // Tên cô dâu/chú rể do KHÁCH tự nhập qua link token — phải thoát HTML, nếu
    // không cửa sổ in (cùng origin với dashboard) sẽ chạy script của khách.
    const couple = escapeHtml(qr.couple);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${couple}</title><style>body{font-family:Georgia,serif;text-align:center;padding:48px 24px;color:#a9527f}h1{font-size:26px;margin:0 0 4px}p{color:#8c847d;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}.u{font-size:12px;word-break:break-all}</style></head><body><h1>${couple}</h1><p>Quét mã để xem Love Story</p><img src="${escapeHtml(qr.img)}"/><p class="u">${escapeHtml(qr.url)}</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div>
      <ThiepTabs />
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Heart style={{ color: "#d0687a" }} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-medium">Trang Love Story</h1>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Trang chia sẻ khoảnh khắc (ảnh/video từ Google Drive của khách) + sổ lời chúc.</p>
        </div>
        <button onClick={createNew} disabled={creating} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tạo Love Story mới
        </button>
      </header>
      {err && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Heart className="mx-auto mb-3" style={{ color: "var(--text3)" }} />
          <p className="text-sm" style={{ color: "var(--text2)" }}>Chưa có trang nào. Bấm <b>“Tạo Love Story mới”</b> để bắt đầu.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const couple = [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & ") || "(chưa đặt tên)";
            const editUrl = studioUrl(studioHost, `/story/sua/${r.edit_token}`);
            const viewUrl = studioUrl(studioHost, `/story/${r.slug}`);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{couple}</p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      <span style={{ color: r.published ? "var(--s-green)" : "var(--text3)" }}>{r.published ? "Đang hiển thị" : "Nháp"}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700"><Users size={13} /> {r.wish_count} lời chúc</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <a href={viewUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><ExternalLink size={13} /> Xem</a>
                  <a href={editUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><Pencil size={13} /> Mở trình sửa</a>
                  <button onClick={() => copy(editUrl, `e-${r.id}`)} className="btn-ghost px-2.5 py-1.5 text-xs">{copied === `e-${r.id}` ? <Check size={13} /> : <Copy size={13} />} Chép link sửa</button>
                  <button onClick={() => openQr(couple, viewUrl)} className="btn-ghost px-2.5 py-1.5 text-xs"><QrCode size={13} /> Mã QR / In</button>
                  {r.contract_id && <Link href={`/dashboard/studio/contracts/${r.contract_id}`} className="btn-ghost px-2.5 py-1.5 text-xs"><FileText size={13} /> Hợp đồng</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setQr(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-subtle bg-surface p-6 text-center text-fg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="font-medium">{qr.couple}</p><button onClick={() => setQr(null)} aria-label="Đóng" className="text-accent-faint hover:text-fg"><X size={18} /></button></div>
            {/* Ảnh QR có nền trắng nướng sẵn — giữ khung trắng để quét được ở chế độ tối. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.img} alt="QR" className="mx-auto my-3 h-56 w-56 rounded bg-white" />
            <p className="mb-4 break-all text-[11px] text-accent-faint">{qr.url}</p>
            <div className="flex justify-center gap-2">
              <a href={qr.img} download={`qr-${qr.couple}.png`} className="btn-ghost px-3 py-2 text-xs">Tải ảnh</a>
              <button onClick={printQr} className="btn-primary px-3 py-2 text-xs"><Printer size={14} /> In mã QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
