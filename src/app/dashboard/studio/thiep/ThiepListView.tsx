"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ExternalLink, Pencil, Copy, Check, Download, Users, FileText, Plus, Loader2, QrCode, Printer, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { thiepUrl } from "@/lib/hosts";
import { Panel, Pill, EmptyState, DigitalTabs } from "@/components/studio/ui";
import type { WeddingConfig, WeddingRsvp } from "@/lib/types";

function slugify(s: string): string {
  const base = s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "le-cuoi"}-${Math.random().toString(36).slice(2, 7)}`;
}

export type InvitationRow = {
  id: string;
  slug: string;
  edit_token: string;
  template: string;
  published: boolean;
  config: WeddingConfig;
  contract_id: string | null;
  created_at: string;
  rsvp_count: number;
};

const SIDE_LABEL: Record<string, string> = { groom: "Chú rể", bride: "Cô dâu", both: "Chung" };

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ThiepListView({ rows, ownerId }: { rows: InvitationRow[]; ownerId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<{ couple: string; url: string; img: string } | null>(null);

  async function openQr(couple: string, url: string) {
    const QRCode = (await import("qrcode")).default;
    const img = await QRCode.toDataURL(url, { margin: 1, width: 640, color: { dark: "#1a1205", light: "#ffffff" } });
    setQr({ couple, url, img });
  }
  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${qr.couple}</title>
      <style>body{font-family:Georgia,serif;text-align:center;padding:48px 24px;color:#1a1205}
      h1{font-size:26px;margin:0 0 4px}p{color:#6b5a3a;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}
      .u{font-size:12px;color:#8a7a5a;word-break:break-all}</style></head>
      <body><h1>${qr.couple}</h1><p>Quét mã để mở thiệp cưới</p>
      <img src="${qr.img}" alt="QR"/><p class="u">${qr.url}</p>
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  }

  async function createNew() {
    setCreating(true);
    setErr(null);
    const editToken = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, "");
    const { data, error } = await supabase
      .from("wedding_invitations")
      .insert({
        owner_id: ownerId,
        slug: slugify("le-cuoi"),
        edit_token: editToken,
        config: { rsvp_enabled: true },
      })
      .select("edit_token")
      .single();
    setCreating(false);
    if (error || !data) { setErr(error?.message || "Không tạo được thiệp."); return; }
    window.open(thiepUrl(`/sua/${data.edit_token}`), "_blank");
    router.refresh();
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function exportCsv(row: InvitationRow) {
    setExporting(row.id);
    const { data } = await supabase
      .from("wedding_rsvps")
      .select("guest_name, side, attending, num_guests, wish, created_at")
      .eq("invitation_id", row.id)
      .order("created_at", { ascending: false });
    setExporting(null);
    const rsvps = (data ?? []) as Pick<WeddingRsvp, "guest_name" | "side" | "attending" | "num_guests" | "wish" | "created_at">[];

    const header = ["Tên khách", "Bên", "Tham dự", "Số người", "Lời chúc", "Thời gian"];
    const lines = rsvps.map((r) => [
      r.guest_name,
      SIDE_LABEL[r.side] ?? r.side,
      r.attending ? "Có" : "Không",
      r.num_guests,
      r.wish ?? "",
      new Date(r.created_at).toLocaleString("vi-VN"),
    ].map(csvCell).join(","));
    // UTF-8 BOM so Excel reads Vietnamese correctly.
    const csv = "﻿" + [header.join(","), ...lines].join("\n");
    const couple = [row.config.groom_name, row.config.bride_name].filter(Boolean).join("-") || row.slug;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `khach-moi-${couple}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="page-in">
      {/* Hàng tab + nút tạo mới — dáng "Thiệp · Story · Slide" của bản thiết kế. */}
      <DigitalTabs active="thiep">
        <button
          onClick={createNew}
          disabled={creating}
          className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={17} />} Tạo thiệp mới
        </button>
      </DigitalTabs>

      {err && (
        <p className="mb-3 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>
      )}

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Heart}
            title="Chưa có thiệp cưới nào"
            hint="Bấm “Tạo thiệp mới” ở trên, hoặc mở một hợp đồng rồi bấm “Tạo thiệp cưới tặng khách”."
          />
        </Panel>
      ) : (
        /* Thẻ 3 cột: ảnh xem trước trên, tên + trạng thái, meta dưới đường kẻ. */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {rows.map((r) => {
            const couple = [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & ") || "(chưa đặt tên)";
            const editUrl = thiepUrl(`/sua/${r.edit_token}`);
            const viewUrl = thiepUrl(`/${r.slug}`);
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold">{couple}</p>
                      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>Mẫu {r.template}</p>
                    </div>
                    <Pill tone={r.published ? "green" : "gray"}>{r.published ? "Đang hiển thị" : "Nháp"}</Pill>
                  </div>

                  <p className="mt-[11px] flex items-center gap-1.5 pt-2.5 text-[12px]" style={{ borderTop: "1px solid var(--bd2)", color: "var(--tx2)" }}>
                    <Users size={14} style={{ color: "var(--tx3)" }} /> {r.rsvp_count} khách đã trả lời
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <MiniBtn href={viewUrl} icon={ExternalLink}>Xem</MiniBtn>
                    <MiniBtn href={editUrl} icon={Pencil}>Sửa</MiniBtn>
                    <MiniBtn onClick={() => copy(editUrl, `edit-${r.id}`)} icon={copied === `edit-${r.id}` ? Check : Copy}>
                      {copied === `edit-${r.id}` ? "Đã chép" : "Link sửa"}
                    </MiniBtn>
                    <MiniBtn onClick={() => openQr(couple, viewUrl)} icon={QrCode}>QR</MiniBtn>
                    <MiniBtn onClick={() => exportCsv(r)} disabled={exporting === r.id} icon={Download}>
                      {exporting === r.id ? "Đang xuất…" : "CSV khách"}
                    </MiniBtn>
                    {r.contract_id && (
                      <MiniBtn href={`/dashboard/studio/contracts/${r.contract_id}`} sameTab icon={FileText}>Hợp đồng</MiniBtn>
                    )}
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

/** Nút phụ nhỏ trên thẻ: viền mảnh, bo 8px, không bao giờ xuống dòng. */
function MiniBtn({
  href, sameTab, onClick, disabled, icon: Icon, children,
}: {
  href?: string; sameTab?: boolean; onClick?: () => void; disabled?: boolean;
  icon: React.ElementType; children: React.ReactNode;
}) {
  const cls = "flex flex-none items-center gap-1 whitespace-nowrap rounded-[8px] px-2.5 py-[6px] text-[11.5px] font-semibold disabled:opacity-50";
  const style = { border: "1px solid var(--bd)", color: "var(--tx2)" };
  if (href) {
    return (
      <a href={href} className={cls} style={style} {...(sameTab ? {} : { target: "_blank", rel: "noreferrer" })}>
        <Icon size={13} /> {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls} style={style}>
      <Icon size={13} /> {children}
    </button>
  );
}
