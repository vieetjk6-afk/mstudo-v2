"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Copy, Check, Download, QrCode, Loader2, ListPlus, Upload, RefreshCw } from "lucide-react";
import { parseGuestFile } from "@/lib/guest-import";
import { matchGuestRsvps, type GuestStatus } from "@/lib/wedding-guests";
import type { WeddingRsvp } from "@/lib/types";

type Filter = "all" | "yes" | "no" | "pending";

/**
 * Quản lý KHÁCH MỜI cho thiệp cưới:
 *  - Nhập tên từng khách, hoặc dán cả danh sách (mỗi dòng / phẩy một tên).
 *  - Mỗi khách có LINK riêng: <thiệp>?guest=<tên> → mở thiệp hiện đúng tên khách.
 *  - Mỗi khách có mã QR (kèm tên in dưới) để gửi/ in — quét ra thiệp cá nhân hóa.
 *  - Tải một QR, hoặc tải TẤT CẢ dưới dạng .zip.
 *  - Trạng thái XÁC NHẬN THAM DỰ của từng khách (ghép phản hồi theo tên — xem
 *    lib/wedding-guests.ts). Chỉ cặp đôi xem ở đây; studio không nhận thông báo.
 */
export default function GuestManager({
  baseUrl, accent = "#b08968", guests, onChange, rsvps, onRefresh,
}: {
  baseUrl: string;            // URL công khai tuyệt đối của thiệp (không kèm ?guest)
  accent?: string;
  guests: string[];
  onChange: (g: string[]) => void;
  /** Phản hồi của khách; null = đang khoá bằng mật khẩu → ẩn trạng thái. */
  rsvps: WeddingRsvp[] | null;
  onRefresh: () => Promise<void>;
}) {
  const [one, setOne] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
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
      const QRCode = (await import("qrcode")).default;
      const next: Record<string, string> = {};
      for (const g of guests) {
        try { next[g] = await QRCode.toDataURL(linkFor(g), { margin: 1, width: 512, color: { dark: "#1a1205", light: "#ffffff" } }); } catch { /* bỏ qua tên lỗi */ }
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

  // Ghép QR + tên khách thành 1 ảnh PNG (để "QR hiện tên khách mời").
  const composeCard = useCallback((name: string, qr: string): Promise<Blob> => new Promise((resolve) => {
    const W = 640, H = 760, pad = 64;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, pad, pad, W - 2 * pad, W - 2 * pad);
      ctx.fillStyle = accent; ctx.textAlign = "center";
      ctx.font = "500 24px 'Cormorant Garamond', Georgia, serif";
      ctx.fillText("TRÂN TRỌNG KÍNH MỜI", W / 2, W - pad + 66);
      ctx.fillStyle = "#1a1205";
      // Tên khách kiểu viết tay (dùng font script hệ thống — canvas không dùng được biến CSS).
      ctx.font = "italic 46px 'Segoe Script', 'Brush Script MT', 'Comic Sans MS', cursive";
      ctx.fillText(name.length > 24 ? name.slice(0, 23) + "…" : name, W / 2, W - pad + 122);
      cv.toBlob((b) => resolve(b!), "image/png");
    };
    img.src = qr;
  }), [accent]);

  const safe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "khach";

  async function downloadOne(name: string) {
    const qr = qrMap[name]; if (!qr) return;
    const blob = await composeCard(name, qr);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `qr-${safe(name)}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function downloadAll() {
    if (!guests.length) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const used: Record<string, number> = {};
      for (const g of guests) {
        const qr = qrMap[g]; if (!qr) continue;
        const blob = await composeCard(g, qr);
        let base = safe(g); if (used[base] != null) { used[base]++; base = `${base}-${used[base]}`; } else used[base] = 0;
        zip.file(`${base}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a"); a.href = url; a.download = "qr-khach-moi.zip"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } finally { setZipping(false); }
  }

  const btn = "inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-medium hover:bg-stone-100";

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">Nhập tên khách để tạo <b>link riêng</b> + <b>mã QR</b> cho từng người. Khi khách mở link/quét QR, thiệp sẽ hiện đúng tên họ.</p>

      {/* Nhập tên lẻ */}
      <div className="flex gap-2">
        <input value={one} onChange={(e) => setOne(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }}
          placeholder="Tên khách mời (vd: Anh Nam & chị Lan)" className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        <button onClick={addOne} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white"><Plus size={15} /> Thêm</button>
      </div>

      {/* Nhập theo danh sách */}
      {showBulk ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} placeholder={"Dán danh sách, mỗi dòng một tên:\nAnh Nam & chị Lan\nGia đình cô Ba\nBạn Minh"} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400" />
          <div className="mt-2 flex gap-2">
            <button onClick={addBulk} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white"><ListPlus size={15} /> Thêm tất cả</button>
            <button onClick={() => setShowBulk(false)} className={btn}>Đóng</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowBulk(true)} className={btn}><ListPlus size={14} /> Nhập theo danh sách</button>
          <button onClick={() => fileRef.current?.click()} disabled={importing} className={btn}>{importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Nhập từ file (Excel/CSV)</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.txt,text/csv,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); }} />
        </div>
      )}

      {/* Thanh công cụ + danh sách khách */}
      {guests.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
            <span className="text-sm font-medium">{guests.length} khách mời</span>
            <span className="flex-1" />
            <button onClick={copyAll} className={btn}>{copied === "__all__" ? <Check size={14} /> : <Copy size={14} />} Sao chép tất cả link</button>
            <button onClick={downloadAll} disabled={zipping} className={btn}>{zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Tải tất cả QR (.zip)</button>
          </div>

          {summary && (
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                ["all", `Tất cả (${guests.length})`],
                ["yes", `Sẽ tham dự (${summary.attending})`],
                ["no", `Không dự (${summary.declined})`],
                ["pending", `Chưa phản hồi (${summary.pending})`],
              ] as [Filter, string][]).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setFilter(k)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${filter === k ? "border-rose-500 bg-rose-50 text-rose-700" : "border-stone-300 text-stone-600 hover:bg-stone-100"}`}>
                  {label}
                </button>
              ))}
              <span className="text-xs text-stone-500">· {summary.people} người sẽ đến</span>
              <span className="flex-1" />
              <button type="button" onClick={refresh} disabled={refreshing} className={btn} title="Tải phản hồi mới nhất">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Làm mới
              </button>
            </div>
          )}

          {/* grid-cols-1 (= minmax(0,1fr)): không có thì dòng link dài nới cột ra quá màn điện thoại. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shown.map(({ name: g, index: i, rsvp: r }) => (
              <div key={`${g}-${i}`} className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-2.5">
                {qrMap[g] ? (
                  <img src={qrMap[g]} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-stone-100"><QrCode size={20} className="text-stone-300" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{g}</p>
                  {summary && <RsvpBadge rsvp={r} />}
                  {r?.wish && <p className="truncate text-[11px] italic text-stone-500" title={r.wish}>“{r.wish}”</p>}
                  <p className="truncate text-[11px] text-stone-400">{linkFor(g)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button onClick={() => copy(linkFor(g), g)} className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">{copied === g ? <Check size={12} /> : <Copy size={12} />} Chép link</button>
                    <button onClick={() => downloadOne(g)} className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600"><Download size={12} /> Tải QR</button>
                    <a href={linkFor(g)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600"><QrCode size={12} /> Mở thử</a>
                  </div>
                </div>
                <button onClick={() => remove(i)} className="shrink-0 rounded p-1 text-stone-400 hover:text-red-600" title="Xoá"><Trash2 size={15} /></button>
              </div>
            ))}
            {shown.length === 0 && <p className="text-sm text-stone-400">Không có khách nào ở mục này.</p>}
          </div>
        </>
      )}

      {/* Mở link chung (không có ?guest) hoặc tự sửa tên → không khớp ai trong danh sách. */}
      {summary && summary.others.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-medium">Phản hồi từ khách ngoài danh sách ({summary.others.length})</p>
            <span className="flex-1" />
            {guests.length === 0 && (
              <button type="button" onClick={refresh} disabled={refreshing} className={btn}>
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Làm mới
              </button>
            )}
          </div>
          <div className="max-h-60 space-y-1.5 overflow-auto">
            {summary.others.map((r) => (
              <div key={`${r.id}`} className="rounded-md bg-white px-2.5 py-1.5">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="text-sm font-medium">{r.guest_name}</span>
                  <RsvpBadge rsvp={r} />
                </div>
                {r.wish && <p className="truncate text-[11px] italic text-stone-500" title={r.wish}>“{r.wish}”</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RsvpBadge({ rsvp }: { rsvp: WeddingRsvp | null }) {
  if (!rsvp) return <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Chưa phản hồi</span>;
  return rsvp.attending
    ? <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">✓ Tham dự · {rsvp.num_guests} người</span>
    : <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">✗ Không dự</span>;
}
