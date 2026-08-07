"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ExternalLink, Pencil, Copy, Check, Users, FileText, Plus, Loader2, QrCode, Printer, Download, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { studioUrl } from "@/lib/hosts";
import { Panel, Pill, EmptyState, DigitalTabs } from "@/components/studio/ui";
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
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${qr.couple}</title><style>body{font-family:Georgia,serif;text-align:center;padding:48px 24px;color:#a9527f}h1{font-size:26px;margin:0 0 4px}p{color:#8c847d;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}.u{font-size:12px;word-break:break-all}</style></head><body><h1>${qr.couple}</h1><p>Quét mã để xem Love Story</p><img src="${qr.img}"/><p class="u">${qr.url}</p><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="page-in">
      <DigitalTabs active="story">
        <button
          onClick={createNew}
          disabled={creating}
          className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={17} />} Tạo Love Story
        </button>
      </DigitalTabs>

      {err && (
        <p className="mb-3 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>
      )}

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Heart}
            title="Chưa có trang Love Story nào"
            hint="Bấm “Tạo Love Story” — trang chia sẻ khoảnh khắc từ Drive của khách kèm sổ lời chúc."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {rows.map((r) => {
            const couple = [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & ") || "(chưa đặt tên)";
            const editUrl = studioUrl(studioHost, `/story/sua/${r.edit_token}`);
            const viewUrl = studioUrl(studioHost, `/story/${r.slug}`);
            const cover = (r.config as { cover_url?: string | null }).cover_url;
            return (
              <Panel key={r.id} className="overflow-hidden">
                <div className="flex h-[132px] items-center justify-center" style={{ background: "var(--sf2)" }}>
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" className="h-full w-full object-cover" />
                    : <Heart size={28} style={{ color: "var(--tx3)" }} />}
                </div>

                <div className="px-[15px] py-3.5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate text-[14px] font-bold">{couple}</p>
                    <Pill tone={r.published ? "green" : "gray"}>{r.published ? "Đang hiển thị" : "Nháp"}</Pill>
                  </div>

                  <p className="mt-[11px] flex items-center gap-1.5 pt-2.5 text-[12px]" style={{ borderTop: "1px solid var(--bd2)", color: "var(--tx2)" }}>
                    <Users size={14} style={{ color: "var(--tx3)" }} /> {r.wish_count} lời chúc
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <MiniBtn href={viewUrl} icon={ExternalLink}>Xem</MiniBtn>
                    <MiniBtn href={editUrl} icon={Pencil}>Sửa</MiniBtn>
                    <MiniBtn onClick={() => copy(editUrl, `e-${r.id}`)} icon={copied === `e-${r.id}` ? Check : Copy}>
                      {copied === `e-${r.id}` ? "Đã chép" : "Link sửa"}
                    </MiniBtn>
                    <MiniBtn onClick={() => openQr(couple, viewUrl)} icon={QrCode}>QR</MiniBtn>
                    {r.contract_id && <MiniBtn href={`/dashboard/studio/contracts/${r.contract_id}`} sameTab icon={FileText}>Hợp đồng</MiniBtn>}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(20,15,25,.5)" }} onClick={() => setQr(null)}>
          <div
            className="w-full max-w-xs rounded-[14px] p-5 text-center"
            style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "var(--sh-modal)", animation: "vkPop .2s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold">{qr.couple}</p>
              <button onClick={() => setQr(null)} aria-label="Đóng" style={{ color: "var(--tx3)" }}><X size={18} /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.img} alt="QR" className="mx-auto my-3.5 h-56 w-56 rounded-[10px]" />
            <p className="mb-3.5 break-all text-[11px]" style={{ color: "var(--tx3)" }}>{qr.url}</p>
            <div className="flex justify-center gap-2">
              <a
                href={qr.img}
                download={`qr-${qr.couple}.png`}
                className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-semibold"
                style={{ border: "1px solid var(--bd)" }}
              >
                <Download size={14} /> Tải ảnh
              </a>
              <button
                onClick={printQr}
                className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12px] font-semibold"
                style={{ background: "var(--ac)", color: "#fff" }}
              >
                <Printer size={14} /> In mã QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nút phụ nhỏ trên thẻ — cùng dáng với màn Thiệp cưới. */
function MiniBtn({
  href, sameTab, onClick, icon: Icon, children,
}: {
  href?: string; sameTab?: boolean; onClick?: () => void;
  icon: React.ElementType; children: React.ReactNode;
}) {
  const cls = "flex flex-none items-center gap-1 whitespace-nowrap rounded-[8px] px-2.5 py-[6px] text-[11.5px] font-semibold";
  const style = { border: "1px solid var(--bd)", color: "var(--tx2)" };
  if (href) {
    return (
      <a href={href} className={cls} style={style} {...(sameTab ? {} : { target: "_blank", rel: "noreferrer" })}>
        <Icon size={13} /> {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls} style={style}>
      <Icon size={13} /> {children}
    </button>
  );
}
