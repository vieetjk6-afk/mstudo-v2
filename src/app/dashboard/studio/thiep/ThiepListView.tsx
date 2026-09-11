"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ExternalLink, Pencil, Copy, Check, Download, FileSpreadsheet, Users, FileText, Plus, Loader2, QrCode, Printer, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ThiepTabs from "@/components/studio/ThiepTabs";
import { thiepUrl } from "@/lib/hosts";
import { getTemplateMeta } from "../../../thiep/[slug]/templates";
import { escapeHtml } from "@/lib/html-escape";
import type { WeddingConfig, WeddingRsvp } from "@/lib/types";
import {
  exportRsvps,
  rsvpCsvRows,
  downloadCsv,
  stamp,
  type ExportStudio,
  type RsvpExportRow,
} from "@/lib/studio-export";

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

export default function ThiepListView({ rows, ownerId, studio }: { rows: InvitationRow[]; ownerId: string; studio: ExportStudio }) {
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
    // Tên cô dâu/chú rể do KHÁCH tự nhập qua link token — phải thoát HTML, nếu
    // không cửa sổ in (cùng origin với dashboard) sẽ chạy script của khách.
    const couple = escapeHtml(qr.couple);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${couple}</title>
      <style>body{font-family:Georgia,serif;text-align:center;padding:48px 24px;color:#1a1205}
      h1{font-size:26px;margin:0 0 4px}p{color:#6b5a3a;margin:2px 0}img{width:340px;height:340px;margin:22px auto;display:block}
      .u{font-size:12px;color:#8a7a5a;word-break:break-all}</style></head>
      <body><h1>${couple}</h1><p>Quét mã để mở thiệp cưới</p>
      <img src="${escapeHtml(qr.img)}" alt="QR"/><p class="u">${escapeHtml(qr.url)}</p>
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

  /**
   * Danh sách khách mời (RSVP) của một thiệp. `kind` chọn định dạng: Excel có
   * tiêu đề, cột rộng và dòng tổng (bao nhiêu người nhận lời, tổng bao nhiêu
   * suất) — thứ mà nhà hàng hỏi khi chốt bàn; CSV giữ cho công cụ khác.
   */
  async function exportGuests(row: InvitationRow, kind: "xlsx" | "csv") {
    setExporting(row.id);
    try {
      const { data } = await supabase
        .from("wedding_rsvps")
        .select("guest_name, side, attending, num_guests, wish, created_at")
        .eq("invitation_id", row.id)
        .order("created_at", { ascending: false });
      const rsvps = (data ?? []) as Pick<WeddingRsvp, "guest_name" | "side" | "attending" | "num_guests" | "wish" | "created_at">[];
      const list: RsvpExportRow[] = rsvps.map((r) => ({
        name: r.guest_name,
        side: SIDE_LABEL[r.side] ?? r.side,
        attending: !!r.attending,
        guests: r.num_guests || 1,
        wish: r.wish ?? "",
        at: fmtDateTime(r.created_at),
      }));
      const couple = [row.config.groom_name, row.config.bride_name].filter(Boolean).join(" & ") || row.slug;
      const title = `DANH SÁCH KHÁCH MỜI — ${couple.toUpperCase()}`;
      const meta = [`Thiệp: ${couple}`, `Ngày xuất: ${stamp()}`];
      const file = `khach-moi-${[row.config.groom_name, row.config.bride_name].filter(Boolean).join("-") || row.slug}`;
      if (kind === "xlsx") await exportRsvps(studio, list, title, meta, file);
      else downloadCsv(rsvpCsvRows(studio, list, title, meta), file);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <ThiepTabs />
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Heart style={{ color: "#d96e8f" }} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-medium">Thiệp cưới online</h1>
          <p className="text-sm" style={{ color: "var(--text2)" }}>Quản lý thiệp cưới tặng khách & danh sách khách mời (RSVP).</p>
        </div>
        <button onClick={createNew} disabled={creating} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tạo thiệp cưới mới
        </button>
      </header>

      {err && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Heart className="mx-auto mb-3" style={{ color: "var(--text3)" }} />
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            Chưa có thiệp cưới nào. Bấm <b>“Tạo thiệp cưới mới”</b> ở trên, hoặc mở một hợp đồng rồi bấm “🎁 Tạo thiệp cưới tặng khách”.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const couple = [r.config.groom_name, r.config.bride_name].filter(Boolean).join(" & ") || "(chưa đặt tên)";
            const editUrl = thiepUrl(`/sua/${r.edit_token}`);
            const viewUrl = thiepUrl(`/${r.slug}`);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{couple}</p>
                    <p className="text-xs" style={{ color: "var(--text3)" }}>
                      Mẫu: {getTemplateMeta(r.template).label} ·{" "}
                      <span style={{ color: r.published ? "var(--s-green)" : "var(--text3)" }}>{r.published ? "Đang hiển thị" : "Nháp"}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">
                    <Users size={13} /> {r.rsvp_count} RSVP
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <a href={viewUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><ExternalLink size={13} /> Xem</a>
                  <a href={editUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs"><Pencil size={13} /> Mở trình sửa</a>
                  <button onClick={() => copy(editUrl, `edit-${r.id}`)} className="btn-ghost px-2.5 py-1.5 text-xs">
                    {copied === `edit-${r.id}` ? <Check size={13} /> : <Copy size={13} />} Chép link sửa
                  </button>
                  <button onClick={() => openQr(couple, viewUrl)} className="btn-ghost px-2.5 py-1.5 text-xs">
                    <QrCode size={13} /> Mã QR / In
                  </button>
                  <button onClick={() => exportGuests(r, "xlsx")} disabled={exporting === r.id} className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50">
                    <FileSpreadsheet size={13} /> {exporting === r.id ? "Đang xuất…" : "Xuất DS khách (Excel)"}
                  </button>
                  <button onClick={() => exportGuests(r, "csv")} disabled={exporting === r.id} className="btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-50" title="Bản CSV cho công cụ khác">
                    <Download size={13} /> CSV
                  </button>
                  {r.contract_id && (
                    <Link href={`/dashboard/studio/contracts/${r.contract_id}`} className="btn-ghost px-2.5 py-1.5 text-xs"><FileText size={13} /> Hợp đồng</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setQr(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-subtle bg-surface p-6 text-center text-fg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{qr.couple}</p>
              <button onClick={() => setQr(null)} aria-label="Đóng" className="text-accent-faint hover:text-fg"><X size={18} /></button>
            </div>
            {/* Ảnh QR có nền trắng nướng sẵn — giữ khung trắng để quét được ở chế độ tối. */}
            <img src={qr.img} alt="QR" className="mx-auto my-3 h-56 w-56 rounded bg-white" />
            <p className="mb-4 break-all text-[11px] text-accent-faint">{qr.url}</p>
            <div className="flex justify-center gap-2">
              <a href={qr.img} download={`qr-${qr.couple}.png`} className="btn-ghost px-3 py-2 text-xs"><Download size={14} /> Tải ảnh</a>
              <button onClick={printQr} className="btn-primary px-3 py-2 text-xs"><Printer size={14} /> In mã QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
