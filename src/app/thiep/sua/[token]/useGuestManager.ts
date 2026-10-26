"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseGuestFile } from "@/lib/guest-import";
import { downloadGuestQr, downloadGuestQrZip, qrDataUrl } from "@/lib/guest-qr";
import { matchGuestRsvps, type GuestStatus } from "@/lib/wedding-guests";
import type { WeddingRsvp } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC quản lý khách mời của thiệp — dùng chung cho GuestManager (bản cũ) và
   GuestManagerV2 (giao diện mới):
    - Thêm tên lẻ, dán cả danh sách (mỗi dòng / phẩy một tên), nhập từ file.
    - Link riêng <thiệp>?guest=<tên> + mã QR (dataURL) cho từng khách; tải một QR
      hoặc tất cả (.zip); chép một / tất cả link.
    - Ghép phản hồi theo tên (lib/wedding-guests.ts) → trạng thái từng khách.
   ═══════════════════════════════════════════════════════════════════════════ */

export type GuestFilter = "all" | "yes" | "no" | "pending";

export type GuestManagerProps = {
  baseUrl: string;            // URL công khai tuyệt đối của thiệp (không kèm ?guest)
  accent?: string;
  guests: string[];
  onChange: (g: string[]) => void;
  /** Phản hồi của khách; null = đang khoá bằng mật khẩu → ẩn trạng thái. */
  rsvps: WeddingRsvp[] | null;
  onRefresh: () => Promise<void>;
};

export function useGuestManager({ baseUrl, accent = "#b08968", guests, onChange, rsvps, onRefresh }: GuestManagerProps) {
  const [one, setOne] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const summary = useMemo(() => (rsvps ? matchGuestRsvps(guests, rsvps) : null), [guests, rsvps]);
  const rows: GuestStatus<WeddingRsvp>[] = summary?.guests ?? guests.map((name, index) => ({ name, index, rsvp: null }));
  const shown = rows.filter((g) => filter === "all" || (filter === "pending" ? !g.rsvp : !!g.rsvp && g.rsvp.attending === (filter === "yes")));
  async function refresh() { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }

  const linkFor = useCallback((name: string) => `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}guest=${encodeURIComponent(name)}`, [baseUrl]);

  // Sinh QR (dataURL) cho từng khách khi danh sách / link đổi.
  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const g of guests) {
        try { next[g] = await qrDataUrl(linkFor(g)); } catch { /* bỏ qua tên lỗi */ }
      }
      if (alive) setQrMap(next);
    })();
    return () => { alive = false; };
  }, [guests, linkFor]);

  function addNames(raw: string) {
    const names = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const seen = new Set(guests.map((g) => g.toLowerCase()));
    const merged = [...guests];
    for (const n of names) { if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); merged.push(n.slice(0, 80)); } }
    onChange(merged);
  }
  const addOne = () => { if (one.trim()) { addNames(one); setOne(""); } };
  const addBulk = () => { if (bulk.trim()) { addNames(bulk); setBulk(""); setShowBulk(false); } };
  const remove = (i: number) => onChange(guests.filter((_, k) => k !== i));

  async function importFile(file: File) {
    setImporting(true);
    try {
      const names = await parseGuestFile(file);
      if (names.length) addNames(names.join("\n"));
      else alert("Không đọc được tên nào trong file. Hãy đảm bảo cột đầu (cột A) chứa tên khách.");
    } catch {
      alert("Không đọc được file. Hỗ trợ .xlsx, .csv, .txt (nếu là .xls cũ, hãy lưu lại thành .xlsx).");
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500); } catch { /* */ }
  }
  const copyAll = () => copy(guests.map((g) => `${g}: ${linkFor(g)}`).join("\n"), "__all__");

  async function downloadOne(name: string) {
    const qr = qrMap[name]; if (!qr) return;
    await downloadGuestQr(name, linkFor(name), accent, qr);
  }
  async function downloadAll() {
    if (!guests.length) return;
    setZipping(true);
    try {
      // Chỉ những tên đã có QR (tên tạo QR lỗi thì bỏ qua, như trước).
      await downloadGuestQrZip(guests.filter((g) => qrMap[g]).map((g) => ({ name: g, link: linkFor(g), qr: qrMap[g] })), accent);
    } finally { setZipping(false); }
  }

  return {
    one, setOne, bulk, setBulk, showBulk, setShowBulk, qrMap, copied, zipping, importing, fileRef, filter, setFilter,
    refreshing, summary, rows, shown, refresh, linkFor, addNames, addOne, addBulk, remove, importFile, copy, copyAll,
    downloadOne, downloadAll,
  };
}
