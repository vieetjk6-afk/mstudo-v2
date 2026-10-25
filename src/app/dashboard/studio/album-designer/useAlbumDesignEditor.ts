"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPdf, cmToPt, type PdfPageSpec } from "@/lib/album-pdf";
import { fetchPublicDriveBytes } from "@/lib/google-picker";
import {
  DECOS, ROLE_SIZE, SEED_PLAN, bumpUid, buildSpread, cellFilter, cellPath, clamp, layoutVariants, nextUid, sig,
  type ADSize, type ADTpl, type Cell, type Lib, type Orient, type Rect, type SavedDesign, type Spread,
} from "./designer-core";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của trình dàn trang album (bản cũ AlbumEditor và bản
   mới AlbumEditorV2): trang/ô, kéo-thả, hoàn tác, thư viện ảnh Drive, bố cục
   gợi ý + của tôi + yêu thích, AI rải ảnh, Auto Design, lưu/tự lưu, kiểm DPI,
   xuất JPG/PNG/PDF in. Hai bản chỉ khác cách vẽ — mọi thao tác nằm ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AlbumEditorProps = { size: ADSize; tpl: ADTpl; onBack: () => void; initial?: SavedDesign | null };

export function useAlbumDesignEditor({ size, tpl, initial }: Pick<AlbumEditorProps, "size" | "tpl" | "initial">) {
  const aspect = (2 * size.w) / size.h; // spread = two pages wide
  const [spreads, setSpreads] = useState<Spread[]>(() =>
    initial?.spreads?.length ? initial.spreads : SEED_PLAN.map((l, i) => buildSpread(l, i + 1)),
  );
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [pickCount, setPickCount] = useState(3);
  const [laySrc, setLaySrc] = useState<"all" | "mine" | "fav">("all");
  const [laySearch, setLaySearch] = useState("");
  const [favs, setFavs] = useState<Rect[][]>([]);
  const [mine, setMine] = useState<{ name: string; rects: Rect[] }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [lib, setLib] = useState<Lib[]>([]);
  const [folder, setFolder] = useState(initial?.folder ?? "");
  const [loadingLib, setLoadingLib] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fmt, setFmt] = useState<"jpg" | "png" | "pdf">("pdf");
  const [bleedMm, setBleedMm] = useState(3); // bleed mặc định 3mm (chuẩn nhà in)
  const [showExport, setShowExport] = useState(false);
  const [exportSel, setExportSel] = useState<Set<number>>(new Set());
  const [showAuto, setShowAuto] = useState(false);
  const [autoSpreads, setAutoSpreads] = useState(6);
  const [autoMin, setAutoMin] = useState(1);
  const [autoMax, setAutoMax] = useState(6);
  const [autoPlan, setAutoPlan] = useState<{ count: number; rects: Rect[] }[]>([]);
  const [canvasW, setCanvasW] = useState(700);
  // Đại tu giao diện: nhiều spread, dải bố cục ngang, dải trang, lưu server.
  const [multi, setMulti] = useState(false);              // xem nhiều spread liên tục
  const [railOpen, setRailOpen] = useState(true);          // mở dải bố cục ngang
  const [showLib, setShowLib] = useState(true);            // ngăn thư viện ảnh
  const [designId, setDesignId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "Album chưa đặt tên");
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const dragPage = useRef<number | null>(null); // kéo-thả sắp xếp trang
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dims = useRef<Record<string, { w: number; h: number; approx?: boolean }>>({});
  const hist = useRef<string[]>([]);
  const fut = useRef<string[]>([]);
  const [, force] = useState(0);

  // Khi mở album đã lưu, đẩy bộ đếm UID vượt mọi uid sẵn có để tránh trùng.
  useEffect(() => {
    const maxUid = Math.max(0, ...spreads.flatMap((s) => s.cells.map((c) => c.uid)));
    bumpUid(maxUid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spread = spreads[cur];
  const selCell = spread?.cells.find((c) => c.uid === sel) || null;

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const snapshot = useCallback(() => { hist.current.push(JSON.stringify(spreads)); if (hist.current.length > 40) hist.current.shift(); fut.current = []; dirty.current = true; force((n) => n + 1); }, [spreads]);
  const undo = () => { const s = hist.current.pop(); if (!s) return; fut.current.push(JSON.stringify(spreads)); setSpreads(JSON.parse(s)); force((n) => n + 1); };
  const redo = () => { const s = fut.current.pop(); if (!s) return; hist.current.push(JSON.stringify(spreads)); setSpreads(JSON.parse(s)); force((n) => n + 1); };

  const patchCell = (uid: number, p: Partial<Cell>) => setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: s.cells.map((c) => c.uid === uid ? { ...c, ...p } : c) }));

  /* ── Thư viện bố cục: Yêu thích + Của tôi (lưu trong trình duyệt) ────────── */
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem("ad_favs") || "[]"));
      setMine(JSON.parse(localStorage.getItem("ad_mine") || "[]"));
    } catch { /* localStorage trống/hỏng — bỏ qua */ }
  }, []);
  const favSet = useMemo(() => new Set(favs.map(sig)), [favs]);
  const toggleFav = (rects: Rect[]) => {
    const k = sig(rects);
    const next = favSet.has(k) ? favs.filter((f) => sig(f) !== k) : [rects, ...favs];
    setFavs(next); try { localStorage.setItem("ad_favs", JSON.stringify(next)); } catch {}
  };
  const saveMine = () => {
    const rects = spread.cells.filter((c) => c.type === "photo").map((c) => [c.x, c.y, c.w, c.h] as Rect);
    if (!rects.length) { showToast("Trang này chưa có ô ảnh để lưu."); return; }
    const next = [{ name: `Của tôi ${mine.length + 1}`, rects }, ...mine];
    setMine(next); try { localStorage.setItem("ad_mine", JSON.stringify(next)); } catch {}
    showToast("Đã lưu bố cục vào 'Của tôi'.");
  };
  // Measure canvas width.
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el); setCanvasW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Real pixel dimensions come from Drive metadata (accurate for the print DPI
  // check). Fall back to loading the thumbnail only for orientation if missing.
  useEffect(() => {
    lib.forEach((p) => {
      if (dims.current[p.id]) return;
      if (p.w && p.h) { dims.current[p.id] = { w: p.w, h: p.h }; return; }
      const img = new Image();
      img.onload = () => { dims.current[p.id] = { w: img.naturalWidth, h: img.naturalHeight, approx: true }; };
      img.src = p.thumb;
    });
  }, [lib]);

  const orient = (id: string): Orient => {
    const d = dims.current[id]; if (!d) return "s";
    const r = d.w / d.h; return r > 1.15 ? "l" : r < 0.87 ? "p" : "s";
  };

  async function loadLibrary() {
    if (!folder.trim()) return;
    setLoadingLib(true);
    try {
      const res = await fetch(`/api/album-designer/photos?folder=${encodeURIComponent(folder.trim())}`);
      const d = await res.json();
      setLib(d.photos || []);
      if (d.error === "no_api_key") showToast("Máy chủ chưa cấu hình GOOGLE_API_KEY để đọc Drive.");
      else if (!d.photos?.length) showToast("Không đọc được ảnh — kiểm tra link folder đã chia sẻ công khai chưa.");
    } finally { setLoadingLib(false); }
  }

  // Base spread geometry.
  const baseH = 500, baseW = 500 * aspect;
  const scale = Math.min(1, (canvasW - 40) / baseW) * zoom;
  const spreadPxW = baseW * scale, spreadPxH = baseH * scale;

  /* ── Drag / resize ──────────────────────────────────────────────────── */
  const drag = useRef<{ uid: number; mode: string; sx: number; sy: number; c0: Cell; moved: boolean } | null>(null);
  const onCellDown = (e: React.PointerEvent, c: Cell, mode: string) => {
    e.stopPropagation();
    setSel(c.uid);
    if (c.locked) return; // layer bị khóa: chỉ chọn, không kéo/resize
    drag.current = { uid: c.uid, mode, sx: e.clientX, sy: e.clientY, c0: { ...c }, moved: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dxp = ((e.clientX - d.sx) / spreadPxW) * 100;
    const dyp = ((e.clientY - d.sy) / spreadPxH) * 100;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 2) { d.moved = true; snapshot(); }
    if (!d.moved) return;
    const c = d.c0;
    let { x, y, w, h } = c;
    if (d.mode === "move") { x = clamp(c.x + dxp, 0, 100 - c.w); y = clamp(c.y + dyp, 0, 100 - c.h); }
    else {
      if (d.mode.includes("e")) w = clamp(c.w + dxp, 6, 100 - c.x);
      if (d.mode.includes("s")) h = clamp(c.h + dyp, 6, 100 - c.y);
      if (d.mode.includes("w")) { const nx = clamp(c.x + dxp, 0, c.x + c.w - 6); w = c.w + (c.x - nx); x = nx; }
      if (d.mode.includes("n")) { const ny = clamp(c.y + dyp, 0, c.y + c.h - 6); h = c.h + (c.y - ny); y = ny; }
    }
    patchCell(d.uid, { x, y, w, h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadPxW, spreadPxH, snapshot, cur]);
  const onUp = useCallback(() => { drag.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); }, [onMove]);

  /* ── Fill photo ─────────────────────────────────────────────────────── */
  const fillCell = (uid: number, p: Lib) => { snapshot(); patchCell(uid, { photo: p.thumb, full: p.full, scale: 1, posX: 50, posY: 50 }); };
  const onThumbClick = (p: Lib) => {
    const target = selCell?.type === "photo" ? selCell.uid : spread?.cells.find((c) => c.type === "photo" && !c.photo)?.uid;
    if (target) fillCell(target, p);
  };
  const usedIds = useMemo(() => new Set(spreads.flatMap((s) => s.cells.map((c) => c.photo).filter(Boolean))), [spreads]);

  /* ── Layout / cells ops ─────────────────────────────────────────────── */
  // Rebuild the current spread's photo cells from arbitrary rects (auto layout),
  // keeping already-placed photos and any text cells.
  function applyRects(rects: Rect[]) {
    snapshot();
    const placed = spread.cells.filter((c) => c.type === "photo" && c.photo);
    const texts = spread.cells.filter((c) => c.type === "text");
    let pi = 0;
    const photoCells: Cell[] = rects.map(([x, y, w, h]) => {
      const base: Cell = { uid: nextUid(), type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false };
      const s = placed[pi++];
      return s ? { ...base, photo: s.photo, full: s.full, scale: s.scale, posX: s.posX, posY: s.posY, filter: s.filter } : base;
    });
    setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, layout: `auto:${rects.length}`, cells: [...photoCells, ...texts] }));
    setSel(null);
  }
  const curPhotoSig = sig(spread?.cells.filter((c) => c.type === "photo").map((c) => [c.x, c.y, c.w, c.h] as Rect) ?? []);
  const variants = useMemo(() => layoutVariants(pickCount, aspect), [pickCount, aspect]);
  // Picking a count shows suggestions and applies the first as a preview.
  const chooseCount = (n: number) => { const nn = clamp(Math.round(n), 1, 12); setPickCount(nn); applyRects(layoutVariants(nn, aspect)[0]); };
  // Browsing to another spread syncs the count picker to that page.
  useEffect(() => { setPickCount(spreads[cur]?.cells.filter((c) => c.type === "photo").length || 1); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const addText = () => { snapshot(); const c = buildSpread("full", spread.id).cells[0]; setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: [...s.cells, { ...c, uid: nextUid(), type: "text", x: 20, y: 40, w: 60, h: 12, text: "Dòng chữ mới", role: "body", align: "center" }] })); };
  const addDeco = (d: typeof DECOS[number]) => { snapshot(); setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: [...s.cells, { uid: nextUid(), type: "text", x: 30, y: 45, w: 40, h: 12, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: d.text, role: "deco", align: "center", size: d.size, color: null, overlay: false, upper: false }] })); };
  const delCell = (uid: number) => { snapshot(); setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: s.cells.filter((c) => c.uid !== uid) })); setSel(null); };
  const clearPhoto = (uid: number) => { snapshot(); patchCell(uid, { photo: null, full: null }); };
  const shuffle = () => {
    snapshot();
    const photos = spread.cells.filter((c) => c.type === "photo" && c.photo).map((c) => ({ photo: c.photo, full: c.full }));
    for (let i = photos.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [photos[i], photos[j]] = [photos[j], photos[i]]; }
    let pi = 0;
    setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: s.cells.map((c) => c.type === "photo" && c.photo && photos[pi] ? { ...c, ...photos[pi++] } : c) }));
  };
  const delSpread = () => { if (spreads.length <= 1) return; snapshot(); setSpreads((sp) => sp.filter((_, i) => i !== cur)); setCur((c) => Math.max(0, c - 1)); setSel(null); };
  const addSpread = () => { snapshot(); setSpreads((sp) => [...sp, buildSpread("duo", (sp.at(-1)?.id ?? 0) + 1)]); setCur(spreads.length); };
  const dupSpread = () => { snapshot(); const clone: Spread = { ...spread, id: (spreads.at(-1)?.id ?? 0) + 1, cells: spread.cells.map((c) => ({ ...c, uid: nextUid() })) }; setSpreads((sp) => { const n = sp.slice(); n.splice(cur + 1, 0, clone); return n; }); setCur(cur + 1); setSel(null); };
  const moveSpread = (dir: -1 | 1) => { const j = cur + dir; if (j < 0 || j >= spreads.length) return; snapshot(); setSpreads((sp) => { const n = sp.slice(); [n[cur], n[j]] = [n[j], n[cur]]; return n; }); setCur(j); };
  // Drag a photo from the library onto a cell (fill / replace).
  const dragLib = useRef<Lib | null>(null);

  /* ── AI auto-fill ───────────────────────────────────────────────────── */
  // Fill every empty photo cell in `base`, matching cell↔photo orientation and
  // preferring least-used photos. Pure — returns new spreads.
  function fillEmpty(base: Spread[]): Spread[] {
    const use: Record<string, number> = {};
    base.forEach((s) => s.cells.forEach((c) => { const id = c.photo?.match(/id=([^&]+)/)?.[1]; if (id) use[id] = (use[id] || 0) + 1; }));
    return base.map((s) => ({
      ...s,
      cells: s.cells.map((c) => {
        if (c.type !== "photo" || c.photo) return c;
        const cellOrient: Orient = (c.w / c.h) * aspect > 1.15 ? "l" : (c.w / c.h) * aspect < 0.87 ? "p" : "s";
        const cand = [...lib].sort((a, b) => {
          const ma = orient(a.id) === cellOrient ? 0 : 1, mb = orient(b.id) === cellOrient ? 0 : 1;
          if (ma !== mb) return ma - mb;
          return (use[a.id] || 0) - (use[b.id] || 0);
        })[0];
        if (!cand) return c;
        use[cand.id] = (use[cand.id] || 0) + 1;
        return { ...c, photo: cand.thumb, full: cand.full, scale: 1, posX: 50, posY: 50 };
      }),
    }));
  }
  function autoFill() {
    if (!lib.length) { showToast("Hãy nạp thư viện ảnh trước."); return; }
    snapshot();
    const before = spreads.flatMap((s) => s.cells).filter((c) => c.photo).length;
    const next = fillEmpty(spreads);
    setSpreads(next);
    showToast(`AI đã rải ${Math.max(0, next.flatMap((s) => s.cells).filter((c) => c.photo).length - before)} ảnh — khớp hướng ảnh`);
  }
  // SmartAlbum-style "tự thiết kế cả album": tạo đủ số trang cho toàn bộ ảnh rồi
  // rải tự động — một chạm ra album hoàn chỉnh.
  /* ── Auto Design có XEM TRƯỚC phương án ─────────────────────────────────── */
  const blankPhotoCell = useCallback(([x, y, w, h]: Rect): Cell => ({ uid: nextUid(), type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false }), []);
  // Dựng phương án: chia ảnh vào N spread, mỗi spread 1 bố cục theo số ảnh.
  const buildAutoPlan = useCallback((spreadsN: number, minC: number, maxC: number): { count: number; rects: Rect[] }[] => {
    const total = Math.max(lib.length, spreadsN); // đảm bảo đủ ảnh danh nghĩa
    const plan: { count: number; rects: Rect[] }[] = [];
    let remaining = total;
    for (let i = 0; i < spreadsN; i++) {
      const left = spreadsN - i;
      let c = Math.round(remaining / left);
      c = Math.max(minC, Math.min(maxC, c));
      c = Math.min(c, Math.max(minC, remaining - (left - 1) * minC)); // chừa min cho các trang sau
      c = Math.max(1, Math.min(9, c));
      remaining -= c;
      const vs = layoutVariants(c, aspect);
      const rects = vs.length ? vs[(i * 3 + c) % vs.length] : [[2, 2, 96, 96] as Rect];
      plan.push({ count: c, rects });
    }
    return plan;
  }, [lib.length, aspect]);
  const openAuto = () => {
    if (!lib.length) { showToast("Hãy nạp thư viện ảnh trước."); return; }
    setAutoPlan(buildAutoPlan(autoSpreads, autoMin, autoMax));
    setShowAuto(true);
  };
  const regenAuto = () => setAutoPlan(buildAutoPlan(autoSpreads, autoMin, autoMax));
  function applyAutoPlan() {
    snapshot();
    const built: Spread[] = autoPlan.map((p, i) => ({ id: i + 1, layout: `auto:${p.count}`, cells: p.rects.map(blankPhotoCell) }));
    setSpreads(fillEmpty(built));
    setCur(0); setSel(null); setShowAuto(false);
    showToast(`Đã tạo ${built.length} spread theo phương án.`);
  }
  // "Dàn lại": đổi bố cục MỌI trang sang một biến thể khác (giữ nguyên ảnh & chữ)
  // — một chạm làm mới cách dàn cả cuốn album.
  function reflowAll() {
    snapshot();
    setSpreads((sp) => sp.map((s, idx) => {
      const photos = s.cells.filter((c) => c.type === "photo" && c.photo);
      const texts = s.cells.filter((c) => c.type === "text");
      const n = Math.max(1, s.cells.filter((c) => c.type === "photo").length);
      const vs = layoutVariants(n, aspect);
      if (!vs.length) return s;
      const pick = vs[(idx + 1) % vs.length]; // lệch theo trang để đa dạng
      let pi = 0;
      const photoCells: Cell[] = pick.map(([x, y, w, h]) => {
        const base: Cell = { uid: nextUid(), type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false };
        const p = photos[pi++];
        return p ? { ...base, photo: p.photo, full: p.full, scale: p.scale, posX: p.posX, posY: p.posY, filter: p.filter } : base;
      });
      return { ...s, layout: `auto:${pick.length}`, cells: [...photoCells, ...texts] };
    }));
    setSel(null);
    showToast("Đã dàn lại bố cục toàn album.");
  }

  /* ── Khóa layer ─────────────────────────────────────────────────────── */
  const toggleLock = (uid: number) => patchCell(uid, { locked: !spread.cells.find((c) => c.uid === uid)?.locked });
  const setSpreadBg = (bg?: string) => { snapshot(); setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, bg })); };

  /* ── Sắp xếp lại trang bằng kéo-thả (dải trang dưới cùng) ───────────── */
  function reorderSpread(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= spreads.length || to >= spreads.length) return;
    snapshot();
    setSpreads((sp) => { const n = sp.slice(); const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
    setCur(to); setSel(null);
  }

  /* ── Lưu / tự lưu lên server ────────────────────────────────────────── */
  const save = useCallback(async (silent = false): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/album-designer/designs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: designId, name, size, tpl, spreads, folder }),
      });
      const d = await res.json();
      if (!res.ok) { if (!silent) showToast(d.error === "too_large" ? "Album quá lớn để lưu." : "Lưu thất bại."); return; }
      if (d.id && !designId) setDesignId(d.id);
      dirty.current = false;
      if (!silent) showToast("Đã lưu album.");
    } catch { if (!silent) showToast("Lỗi mạng khi lưu."); }
    finally { setSaving(false); }
  }, [saving, designId, name, size, tpl, spreads, folder]);

  // Tự lưu mỗi 20s nếu có thay đổi VÀ album đã từng được lưu (có id) —
  // tránh tạo bản nháp rác khi người dùng chỉ xem thử.
  useEffect(() => {
    const t = setInterval(() => { if (dirty.current && designId) save(true); }, 20_000);
    return () => clearInterval(t);
  }, [designId, save]);

  /* ── DPI ────────────────────────────────────────────────────────────── */
  function cellDpi(c: Cell): number | null {
    if (!c.photo) return null;
    // dims keyed by drive id; the thumb URL carries an id= param.
    const id = c.photo.match(/id=([^&]+)/)?.[1] || "";
    const dd = dims.current[id]; if (!dd || dd.approx) return null; // need true pixel size
    const cellWcm = (c.w / 100) * (2 * size.w), cellHcm = (c.h / 100) * size.h;
    const cellCm = Math.min(cellWcm, cellHcm);
    return Math.round((Math.min(dd.w, dd.h) / c.scale) / (cellCm / 2.54));
  }

  /* ── Export (JPG/PNG từng trang · PDF chuẩn in cả cuốn) ─────────────────
   * `bleedMm` > 0: mở rộng canvas ra mỗi phía; ô ảnh CHẠM mép trim được kéo
   * giãn vào vùng bleed để sau khi nhà in xén không lộ viền trắng. */
  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  // Ảnh gốc để xuất file in: thử tải THẲNG từ Drive API trong trình duyệt trước
  // (có CORS, 0 byte qua Vercel — ảnh gốc mỗi tấm cỡ chục MB). Không được (khoá
  // chưa bật Drive API, file không công khai, HEIC…) mới về proxy raw=1: ảnh gốc
  // phải về cùng miền để canvas xuất được file in.
  async function loadOriginal(full: string): Promise<HTMLImageElement> {
    const id = full.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
    const blob = id ? await fetchPublicDriveBytes(id) : null;
    if (blob) {
      const url = URL.createObjectURL(blob);
      try { return await loadImg(url); } catch { /* về proxy */ } finally { URL.revokeObjectURL(url); }
    }
    return loadImg(full + (full.includes("?") ? "&" : "?") + "raw=1");
  }
  async function renderSpreadCanvas(s: Spread, bleed_mm: number): Promise<HTMLCanvasElement> {
    const DPI = 300;
    const trimW = Math.round((2 * size.w) * DPI / 2.54), trimH = Math.round(size.h * DPI / 2.54);
    const bl = Math.round((bleed_mm / 10) * DPI / 2.54);
    const W = trimW + 2 * bl, H = trimH + 2 * bl;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!; ctx.fillStyle = s.bg || tpl.page; ctx.fillRect(0, 0, W, H);
    const kpx = trimH / baseH; // px thiết kế → px export (bo góc/viền/blur)
    for (const c of s.cells) {
      let cx = bl + (c.x / 100) * trimW, cy = bl + (c.y / 100) * trimH;
      let cw = (c.w / 100) * trimW, ch = (c.h / 100) * trimH;
      if (bl > 0 && c.type === "photo") {
        // Kéo ô sát mép trim ra tận mép giấy (bleed) để tránh viền trắng khi xén.
        if (c.x <= 0.5) { cx -= bl; cw += bl; }
        if (c.y <= 0.5) { cy -= bl; ch += bl; }
        if (c.x + c.w >= 99.5) cw += bl;
        if (c.y + c.h >= 99.5) ch += bl;
      }
      if (c.type === "photo" && c.full) {
        try {
          const im = await loadOriginal(c.full);
          ctx.save(); cellPath(ctx, c, cx, cy, cw, ch, kpx); ctx.clip(); ctx.filter = cellFilter(c, kpx);
          const s0 = Math.max(cw / im.width, ch / im.height) * c.scale, dw = im.width * s0, dh = im.height * s0;
          const dx = cx + (cw - dw) * (c.posX / 100), dy = cy + (ch - dh) * (c.posY / 100);
          ctx.drawImage(im, dx, dy, dw, dh);
          ctx.filter = "none";
          if (c.tint && c.tintA) { ctx.globalAlpha = c.tintA / 100; ctx.fillStyle = c.tint; ctx.fillRect(cx, cy, cw, ch); ctx.globalAlpha = 1; }
          ctx.restore();
          if (c.borderW) { ctx.save(); cellPath(ctx, c, cx, cy, cw, ch, kpx); ctx.lineWidth = c.borderW * kpx; ctx.strokeStyle = c.borderColor || "#ffffff"; ctx.stroke(); ctx.restore(); }
        } catch { /* skip broken image */ }
      } else if (c.type === "text" && c.text) {
        ctx.save(); ctx.fillStyle = c.color || (c.overlay ? "#fff" : tpl.ink);
        const fs = (c.size || ROLE_SIZE[c.role]) * (trimH / baseH);
        ctx.font = `${fs}px ${c.role === "body" ? "Manrope, sans-serif" : "'Cormorant Garamond', serif"}`;
        ctx.textAlign = c.align; ctx.textBaseline = "middle";
        const tx = c.align === "center" ? cx + cw / 2 : c.align === "right" ? cx + cw : cx;
        (c.upper ? c.text.toUpperCase() : c.text).split("\n").forEach((line, li) => ctx.fillText(line, tx, cy + ch / 2 + li * fs * 1.2));
        ctx.restore();
      }
    }
    return cv;
  }
  const canvasToBytes = (cv: HTMLCanvasElement, q = 0.95): Promise<Uint8Array> =>
    new Promise((res) => cv.toBlob(async (b) => res(new Uint8Array(await b!.arrayBuffer())), "image/jpeg", q));

  async function exportImages(indices: number[]) {
    for (const i of indices) {
      const cv = await renderSpreadCanvas(spreads[i], 0); // ảnh: không bleed
      const mime = fmt === "png" ? "image/png" : "image/jpeg";
      const ext = fmt === "png" ? "png" : "jpg";
      const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), mime, fmt === "png" ? undefined : 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `album-${size.name}-trang-${i + 1}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      await new Promise((r) => setTimeout(r, 450));
    }
  }
  async function exportPdf(indices: number[]) {
    const trimWpt = cmToPt(2 * size.w), trimHpt = cmToPt(size.h), blPt = cmToPt(bleedMm / 10);
    const pages: PdfPageSpec[] = [];
    for (const i of indices) {
      const cv = await renderSpreadCanvas(spreads[i], bleedMm);
      pages.push({
        jpeg: await canvasToBytes(cv), widthPx: cv.width, heightPx: cv.height,
        boxWpt: trimWpt + 2 * blPt, boxHpt: trimHpt + 2 * blPt, trimMarginPt: blPt,
      });
    }
    const blob = buildPdf(pages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `album-${size.name}-${pages.length}trang.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }
  async function exportPages(indices: number[]) {
    const list = indices.filter((i) => i >= 0 && i < spreads.length).sort((a, b) => a - b);
    if (!list.length) { showToast("Chưa chọn trang nào để xuất."); return; }
    setShowExport(false);
    setExporting(true);
    try {
      if (fmt === "pdf") { await exportPdf(list); showToast(`Đã xuất PDF ${list.length} trang · 300 DPI · bleed ${bleedMm}mm + dấu cắt.`); }
      else { await exportImages(list); showToast(`Đã xuất ${list.length} trang (${fmt.toUpperCase()} · 300 DPI · ảnh gốc).`); }
    }
    catch { showToast("Xuất file gặp lỗi — thử lại hoặc giảm số trang."); }
    finally { setExporting(false); }
  }


  /* ── Dẫn xuất cho phần vẽ ───────────────────────────────────────────── */
  const scenesUsed = usedIds.size;
  // Bố cục hiển thị trên dải ngang theo nguồn đang chọn.
  const railLayouts: Rect[][] =
    laySrc === "mine" ? mine.filter((m) => !laySearch || m.name.toLowerCase().includes(laySearch.toLowerCase())).map((m) => m.rects)
    : laySrc === "fav" ? favs
    : variants;
  const nbW = spreadPxW * 0.52, nbH = spreadPxH * 0.52; // spread hàng xóm (chế độ Nhiều Spread)

  return {
    aspect, spreads, cur, setCur, sel, setSel, spread, selCell, pickCount, laySrc, setLaySrc, laySearch, setLaySearch,
    favSet, toggleFav, saveMine, zoom, setZoom, lib, folder, setFolder, loadingLib, loadLibrary, toast, exporting,
    fmt, setFmt, bleedMm, setBleedMm, showExport, setShowExport, exportSel, setExportSel, showAuto, setShowAuto,
    autoSpreads, setAutoSpreads, autoMin, setAutoMin, autoMax, setAutoMax, autoPlan, multi, setMulti, railOpen,
    setRailOpen, showLib, setShowLib, name, setName, saving, dirty, dragPage, stageRef, hist, fut, undo, redo,
    patchCell, scale, spreadPxW, spreadPxH, onCellDown, fillCell, onThumbClick, usedIds, applyRects, curPhotoSig,
    chooseCount, addText, addDeco, delCell, clearPhoto, shuffle, delSpread, addSpread, dupSpread, moveSpread, dragLib,
    autoFill, openAuto, regenAuto, applyAutoPlan, reflowAll, toggleLock, setSpreadBg, reorderSpread, save, cellDpi,
    exportPages, scenesUsed, railLayouts, nbW, nbH, designId,
  };
}

export type AlbumDesignEditor = ReturnType<typeof useAlbumDesignEditor>;
