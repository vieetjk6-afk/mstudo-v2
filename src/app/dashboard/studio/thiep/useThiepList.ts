"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/date";
import { createClient } from "@/lib/supabase/client";
import { thiepUrl } from "@/lib/hosts";
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

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Thiệp cưới (bản cũ ThiepListView và bản mới
   ThiepListV2): tạo thiệp, chép link sửa, mã QR + in, xuất danh sách khách
   mời (RSVP). Hai bản chỉ khác nhau ở cách vẽ — mọi truy vấn nằm ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

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

/** Prop của màn Thiệp cưới — page.tsx dựng, bản cũ và bản mới nhận y hệt. */
export type ThiepListProps = { rows: InvitationRow[]; ownerId: string; studio: ExportStudio };

export type ThiepQr = { couple: string; url: string; img: string };

function slugify(s: string): string {
  const base = s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "le-cuoi"}-${Math.random().toString(36).slice(2, 7)}`;
}

const SIDE_LABEL: Record<string, string> = { groom: "Chú rể", bride: "Cô dâu", both: "Chung" };

/** Tên cặp đôi hiển thị trên thẻ ("Chú rể & Cô dâu"), rỗng khi chưa đặt tên. */
export function coupleName(c: WeddingConfig): string {
  return [c.groom_name, c.bride_name].filter(Boolean).join(" & ");
}

export function useThiepList({ ownerId, studio }: Pick<ThiepListProps, "ownerId" | "studio">) {
  const supabase = createClient();
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qr, setQr] = useState<ThiepQr | null>(null);

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

  return { copied, exporting, creating, err, qr, setQr, openQr, printQr, createNew, copy, exportGuests };
}
