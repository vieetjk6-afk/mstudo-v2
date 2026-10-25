"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SITE_BLOCK_LABEL,
  type Site,
  type SiteBlock,
  type SiteBlockType,
  type SiteTheme,
} from "@/lib/types";
import { SITE_TEMPLATES, SECTION_PRESETS, personalizeBlocks, EMPTY_INTAKE } from "@/lib/site-templates";
import { useTheme } from "@/lib/theme";
import { compressImage, checkImageFile } from "@/lib/image";
import { uploadImage, dataUrlToBlob } from "@/lib/upload-client";
import { useSitePublishing } from "../useSiteSettings";
import {
  DEFAULTS, uid, isLightHex, contrastInk,
  type AlbumLite, type Device, type PriceItem, type PriceListOption, type SiteViewStats,
} from "./builder-parts";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC của trình tạo website kéo-thả — trạng thái khối/theme, hoàn tác, kéo
   thả, lưu Supabase, phím tắt. Bản cũ (CanvasBuilder) và bản giao diện mới
   (CanvasBuilderV2) dùng chung hook này, nên mọi thao tác lưu y hệt nhau; hai
   bản chỉ khác ở khung công cụ bao quanh canvas.
   Tên miền phụ / xuất bản nằm ở ../useSiteSettings (màn tổng quan Website ở
   giao diện mới cũng dùng).
   ═══════════════════════════════════════════════════════════════════════════ */

export type CanvasBuilderProps = {
  site: Site;
  initialBlocks: SiteBlock[];
  albums: AlbumLite[];
  pricelist?: PriceItem[];
  priceLists?: PriceListOption[];
  priceLabels?: Record<string, string>;
  siteViews?: SiteViewStats;
  canPublish: boolean;
  canCustomDomain?: boolean;
  mainHost: string;
};

export type LeftTab = "page" | "blocks" | "presets" | "templates";

export function useCanvasBuilder({ site, initialBlocks, canPublish, mainHost }: CanvasBuilderProps) {
  const supabase = createClient();
  const { theme: uiTheme } = useTheme(); // studio light/dark, to sync the builder chrome

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [blocks, setBlocks] = useState<SiteBlock[]>(initialBlocks);
  const [theme, setTheme] = useState<SiteTheme>(site.theme || {});
  const [selId, setSelId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("page");
  const [device, setDevice] = useState<Device>("desktop");
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // drag state
  const [dragType, setDragType] = useState<SiteBlockType | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // undo / redo (snapshots of {blocks, theme})
  const undoStack = useRef<{ blocks: SiteBlock[]; theme: SiteTheme }[]>([]);
  const redoStack = useRef<{ blocks: SiteBlock[]; theme: SiteTheme }[]>([]);
  const [, force] = useState(0);

  function flash(m: string, ms = 2200) {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  // Tên miền phụ + xuất bản — logic chung với màn tổng quan Website.
  const pub = useSitePublishing({ site, supabase, mainHost, canPublish, flash });
  const liveUrl = pub.savedSub && mainHost ? `https://${pub.savedSub}.${mainHost}` : "";

  const snapshot = useCallback(() => {
    undoStack.current.push({ blocks: blocks.map((b) => ({ ...b, config: { ...b.config } })), theme: { ...theme } });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    force((n) => n + 1);
  }, [blocks, theme]);

  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ blocks, theme });
    setBlocks(prev.blocks);
    setTheme(prev.theme);
    persistAll(prev.blocks, prev.theme);
    force((n) => n + 1);
  }
  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ blocks, theme });
    setBlocks(next.blocks);
    setTheme(next.theme);
    persistAll(next.blocks, next.theme);
    force((n) => n + 1);
  }

  // ── Persistence ───────────────────────────────────────────────────────
  const persistTheme = useCallback(async (th: SiteTheme) => {
    await supabase.from("sites").update({ theme: th, updated_at: new Date().toISOString() }).eq("id", site.id);
  }, [site.id, supabase]);

  const persistBlock = useCallback(async (b: SiteBlock) => {
    await supabase.from("site_blocks").update({ config: b.config, visible: b.visible }).eq("id", b.id);
  }, [supabase]);

  // Lưu lại toàn bộ thứ tự/khối — dùng khi kéo thả, thêm/xoá, áp mẫu, hoàn tác.
  // GHI TRƯỚC (upsert) rồi mới xoá phần dư: nếu request thứ hai lỗi (mạng rớt)
  // thì chỉ còn sót vài khối cũ — sửa được. Cách trước đây là xoá HẾT rồi chèn
  // lại, nên hỏng giữa hai bước là mất sạch trang.
  const persistAll = useCallback(async (bl: SiteBlock[], th: SiteTheme) => {
    await persistTheme(th);
    const rows = bl.map((b, i) => ({
      id: b.id, site_id: site.id, type: b.type, position: i, visible: b.visible, config: b.config,
    }));
    if (rows.length) {
      const { error } = await supabase.from("site_blocks").upsert(rows, { onConflict: "id" });
      if (error) { flash(`Chưa lưu được: ${error.message}`); return; }
    }
    // Xoá những khối không còn trong danh sách (đã bị xoá / thay bằng mẫu khác).
    let del = supabase.from("site_blocks").delete().eq("site_id", site.id);
    if (rows.length) del = del.not("id", "in", `(${rows.map((r) => r.id).join(",")})`);
    const { error } = await del;
    if (error) flash(`Chưa dọn được khối cũ: ${error.message}`);
  }, [persistTheme, site.id, supabase]);

  // ── Block mutations ───────────────────────────────────────────────────
  const newBlock = (type: SiteBlockType): SiteBlock => ({
    id: uid(),
    site_id: site.id,
    type,
    position: 0,
    visible: true,
    config: { ...(DEFAULTS[type] || {}) },
    created_at: new Date().toISOString(),
  });

  function insertBlock(type: SiteBlockType, index: number) {
    snapshot();
    const b = newBlock(type);
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, b);
    setBlocks(next);
    setSelId(b.id);
    persistAll(next, theme);
    flash(`Đã thêm khối ${SITE_BLOCK_LABEL[type]}`);
  }

  function moveDir(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    snapshot();
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
    persistAll(next, theme);
  }

  function reorderTo(targetIndex: number) {
    if (dragId == null) return;
    const from = blocks.findIndex((b) => b.id === dragId);
    if (from < 0) return;
    snapshot();
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    const to = from < targetIndex ? targetIndex - 1 : targetIndex;
    next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
    setBlocks(next);
    persistAll(next, theme);
  }

  // Cụm khối: chèn thêm vài khối đã soạn nội dung vào cuối trang (không đổi theme).
  function insertPreset(key: string) {
    const preset = SECTION_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    snapshot();
    const rows: SiteBlock[] = preset.blocks.map((b, i) => ({
      id: uid(), site_id: site.id, type: b.type, position: blocks.length + i,
      visible: true, config: { ...b.config }, created_at: new Date().toISOString(),
    }));
    const next = [...blocks, ...rows];
    setBlocks(next);
    setSelId(rows[0]?.id ?? null);
    persistAll(next, theme);
    flash(`Đã thêm cụm “${preset.name}” (${rows.length} khối)`);
  }

  function dupBlock(id: string) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    snapshot();
    const copy: SiteBlock = { ...blocks[i], id: uid(), config: { ...blocks[i].config } };
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    setBlocks(next);
    setSelId(copy.id);
    persistAll(next, theme);
    flash("Đã nhân bản khối");
  }

  // Tạm ẩn khối: vẫn giữ nội dung nhưng không hiện trên trang đã xuất bản
  // (loadSiteBundle chỉ lấy khối visible=true).
  function toggleVisible(id: string) {
    snapshot();
    const next = blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b));
    setBlocks(next);
    const b = next.find((x) => x.id === id);
    if (b) persistBlock(b);
    flash(b?.visible ? "Đã hiện khối trên trang" : "Đã ẩn khối khỏi trang");
  }

  function delBlock(id: string) {
    snapshot();
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    if (selId === id) setSelId(null);
    persistAll(next, theme);
    flash("Đã xoá khối");
  }

  // Update a config key on a block (live), persist on commit=true.
  function setConfig(id: string, key: string, value: unknown, commit = false) {
    setBlocks((p) => {
      const next = p.map((b) => (b.id === id ? { ...b, config: { ...b.config, [key]: value } } : b));
      if (commit) {
        const b = next.find((x) => x.id === id);
        if (b) persistBlock(b);
      }
      return next;
    });
  }

  function patchTheme(patch: Partial<SiteTheme>) {
    snapshot();
    setTheme((t) => {
      const next = { ...t, ...patch };
      persistTheme(next);
      return next;
    });
  }

  // Nền sáng/tối: đổi luôn cặp màu nền + chữ cho khớp.
  function setBgMode(m: "light" | "dark") {
    patchTheme({ mode: m, bg: m === "light" ? "#FBFAF8" : "#15110D", text: m === "light" ? "#1A1815" : "#F2EADD" });
  }

  // Nút liên hệ nổi: bật/tắt từng nút (bấm một nút là bật lại cả cụm), hoặc tắt hẳn.
  const fabOn = (k: "booking" | "zalo" | "messenger" | "phone") => {
    const f = theme.fab || {};
    return !f.off && f[k] !== false;
  };
  function toggleFab(k: "booking" | "zalo" | "messenger" | "phone") {
    const f = theme.fab || {};
    patchTheme({ fab: { ...f, off: false, [k]: !fabOn(k) } });
  }
  function toggleFabOff() {
    patchTheme({ fab: { ...(theme.fab || {}), off: !(theme.fab?.off) } });
  }

  // Logo studio: nén PNG ≤400px rồi tải lên; tải hỏng thì nhúng data URL.
  async function uploadLogo(file: File) {
    const check = checkImageFile(file);
    if (!check.ok) { flash(check.error); return; }
    const dataUrl = await compressImage(file, { maxDim: 400, quality: 0.9, mime: "image/png" });
    let url = dataUrl;
    try { url = await uploadImage(await dataUrlToBlob(dataUrl), { filename: "logo.png", original: true }); } catch { /* fallback: nhúng data URL */ }
    patchTheme({ logo: url });
  }

  async function applyTemplate(key: string) {
    const tpl = SITE_TEMPLATES.find((t) => t.key === key);
    if (!tpl) return;
    if (blocks.length && !confirm("Áp dụng mẫu sẽ thay toàn bộ khối hiện tại. Tiếp tục?")) return;
    snapshot();
    const built = personalizeBlocks(tpl.blocks, EMPTY_INTAKE);
    const rows: SiteBlock[] = built.map((b, i) => ({
      id: uid(), site_id: site.id, type: b.type, position: i, visible: true,
      config: b.config, created_at: new Date().toISOString(),
    }));
    setTheme(tpl.theme);
    setBlocks(rows);
    setSelId(null);
    await persistAll(rows, tpl.theme);
    flash(`Đã áp dụng mẫu ${tpl.name}`);
    setLeftTab("blocks");
  }

  // Keyboard: undo/redo, delete selected, escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
      else if (e.key === "Escape") setSelId(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && selId && !editing) { e.preventDefault(); delBlock(selId); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // undo/redo/delBlock cố ý KHÔNG nằm trong deps: bộ nghe phím tắt phải gắn
    // đúng một lần, mà ba hàm đó chỉ gọi setState — thứ ổn định qua mọi lần
    // render. Cho chúng vào deps thì mỗi lần gõ một ký tự lại tháo và gắn lại
    // bộ nghe toàn cục.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, blocks, theme]);

  const selected = blocks.find((b) => b.id === selId) || null;
  const dragging = dragType !== null || dragId !== null;
  // Xem trước = đúng trang thật → bỏ các khối đang ẩn. Khi soạn thì vẫn hiện
  // (mờ đi) để studio bật lại được.
  const canvasBlocks = preview ? blocks.filter((b) => b.visible !== false) : blocks;
  const accent = theme.accent || "#1A1815";
  const canvasMax: number | string = device === "mobile" ? 402 : (theme.contentWidth === "full" ? "100%" : 1080);

  // Canvas theme variables (mirror SiteRenderer).
  const dark = (theme.mode ?? (isLightHex(theme.bg) ? "light" : "dark")) === "dark";
  const canvasVars = {
    "--s-bg": theme.bg || "#FBFAF8",
    "--s-text": theme.text || "#1A1815",
    "--s-accent": accent,
    "--s-accentInk": contrastInk(accent),
    "--s-border": dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    "--s-card": dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)",
    "--s-radius": theme.radius === "sharp" ? "0px" : "14px",
  } as React.CSSProperties;
  const fontHead = theme.font === "sans" ? "var(--font-hanken), system-ui, sans-serif" : "var(--font-cormorant), Georgia, serif";

  return {
    supabase, uiTheme, mounted,
    blocks, theme, selId, setSelId, leftTab, setLeftTab, device, setDevice, preview, setPreview, toast, flash,
    dragType, setDragType, dragId, setDragId, dropIndex, setDropIndex,
    undoStack, redoStack, undo, redo, snapshot,
    ...pub, liveUrl,
    insertBlock, moveDir, reorderTo, insertPreset, dupBlock, toggleVisible, delBlock, setConfig, patchTheme, applyTemplate,
    setBgMode, fabOn, toggleFab, toggleFabOff, uploadLogo,
    selected, dragging, canvasBlocks, accent, canvasMax, dark, canvasVars, fontHead,
  };
}
