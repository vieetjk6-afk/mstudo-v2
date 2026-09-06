"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Slide cưới — trình tạo video slideshow ảnh cưới (canvas 1920×1080): slide tựa
 * đề → ảnh với hiệu ứng chuyển cảnh + Ken Burns → slide chữ/câu chuyện → kết.
 * Port trực tiếp từ thiết kế "Video slide ảnh cưới" của studio (đang Sắp ra mắt;
 * sẽ chỉnh sau). Xuất video bằng MediaRecorder (webm/mp4 tuỳ trình duyệt).
 */

type Photo = { id: string; name: string; url: string };
type Slide = { type: string; photos: Photo[]; trans: string; text?: string; side?: number; t0?: number; dur?: number };
// Ghi nhớ chỉnh sửa RIÊNG của một slide (theo vị trí) để khôi phục sau khi dựng
// lại — mỗi slide độc lập, đổi thiết lập chung không xoá sạch chỉnh tay của bạn.
type SlideOverride = { type: string; trans: string; side?: number; photoIds: string[] };
type Theme = { name: string; bg: string; ink: string; sub: string; accent: string; title: string; body: string; radius: number; dark: boolean; letterbox: boolean; titleItalic: boolean; c1: string; c2: string; trans: string[]; rhythm: number[]; tr: number; kb: number; pace: number; bag: string[]; bagText: string[] };

const THEMES: Record<string, Theme> = {
  luxe: { name: "Tối giản sang trọng", bg: "#f7f4ef", ink: "#2b2723", sub: "#8a8378", accent: "#a98b5d", title: "Cormorant Garamond", body: "Be Vietnam Pro", radius: 6, dark: false, letterbox: false, titleItalic: false, c1: "#f7f4ef", c2: "#a98b5d", trans: ["fade", "zoomsoft", "wipe", "slideleft", "circle", "blur"], rhythm: [1, 2, 1, 3, 2, 1, 4, 3], tr: 0.95, kb: 0.05, pace: 1.12, bag: ["FULL", "FRAME", "POLAROID", "DUO", "FRAME", "FULL", "TRIPLE", "BANDS", "FULL", "QUADL"], bagText: ["FULL", "SPLIT", "FRAME", "FULL", "SPLIT", "DUO", "BANDS", "FULL", "TRIPLE", "SPLIT"] },
  romantic: { name: "Lãng mạn ấm áp", bg: "#f6ece7", ink: "#5a4038", sub: "#9c8078", accent: "#c98a7d", title: "Playfair Display", body: "Be Vietnam Pro", radius: 16, dark: false, letterbox: false, titleItalic: true, c1: "#f6ece7", c2: "#c98a7d", trans: ["fade", "slideup", "zoomsoft", "circle", "slideleft", "blur"], rhythm: [2, 1, 4, 2, 3, 1, 2, 5], tr: 0.8, kb: 0.07, pace: 1.0, bag: ["FULL", "DUO", "POLAROID", "QUAD", "DUOV", "FULL", "TRIPLE_R", "DUO", "QUINT", "FULL"], bagText: ["FULL", "SPLIT", "DUO", "FULL", "SPLIT", "QUAD", "DUOV", "SPLIT", "FULL", "TRIPLE"] },
  cinematic: { name: "Điện ảnh hiện đại", bg: "#131317", ink: "#f4f1ec", sub: "#b7b2a9", accent: "#c9a24a", title: "Playfair Display", body: "Manrope", radius: 0, dark: true, letterbox: true, titleItalic: false, c1: "#131317", c2: "#c9a24a", trans: ["push", "fade", "blur", "pushup", "wipe", "slideleft"], rhythm: [1, 3, 1, 1, 2, 1, 3], tr: 0.55, kb: 0.09, pace: 0.9, bag: ["FULL", "FULL", "TRIPLE_R", "FULL", "DUO", "FULL", "BANDS", "TRIPLE"], bagText: ["FULL", "SPLIT", "FULL", "FULL", "TRIPLE", "SPLIT", "FULL", "DUO", "FULL", "SPLIT"] },
  bright: { name: "Trong trẻo tươi sáng", bg: "#ffffff", ink: "#2a2f36", sub: "#8a9099", accent: "#5b9aa8", title: "Cormorant Garamond", body: "Be Vietnam Pro", radius: 20, dark: false, letterbox: false, titleItalic: false, c1: "#eef4f5", c2: "#5b9aa8", trans: ["slide", "block", "wipe", "circle", "zoomsoft", "pushleft"], rhythm: [2, 4, 1, 3, 2, 6, 1, 5], tr: 0.62, kb: 0.05, pace: 0.98, bag: ["DUO", "QUAD", "FULL", "TRIPLE", "DUOV", "HEX", "FULL", "QUADL"], bagText: ["DUO", "SPLIT", "QUAD", "FULL", "SPLIT", "TRIPLE_R", "DUOV", "SPLIT", "QUAD", "FULL"] },
};

type EngineState = {
  tab: string; photos: Photo[]; groom: string; bride: string; date: string; eyebrow: string;
  story: string; music: string; audioName: string; theme: string; perPhoto: number; diverse: boolean; showText: boolean; portrait: boolean;
  playing: boolean; total: number; slideCount: number; exporting: boolean; exportPct: number; exportError: string;
};

class SlideEngine {
  state: EngineState = { tab: "photos", photos: [], groom: "", bride: "", date: "", eyebrow: "", story: "", music: "none", audioName: "", theme: "luxe", perPhoto: 3.4, diverse: true, showText: true, portrait: false, playing: false, total: 0, slideCount: 0, exporting: false, exportPct: 0, exportError: "" };
  onChange: () => void = () => {};
  imgs = new Map<string, HTMLImageElement>();
  planL: Slide[] = []; // kế hoạch cảnh khổ ngang 16:9
  planP: Slide[] = []; // kế hoạch cảnh khổ dọc 9:16 — dựng & chỉnh riêng, không ảnh hưởng khổ ngang
  get plan(): Slide[] { return this.H > this.W ? this.planP : this.planL; }
  // Chỉnh sửa từng slide (theo vị trí) — lưu riêng cho khổ ngang & khổ dọc.
  ovL = new Map<number, SlideOverride>();
  ovP = new Map<number, SlideOverride>();
  get ov(): Map<number, SlideOverride> { return this.H > this.W ? this.ovP : this.ovL; }
  quotes: string[] = [];
  seed = 1;
  time = 0;
  total = 0;
  W = 1920; H = 1080; // kích thước canvas hiện tại (đổi tạm khi xuất video dọc 9:16)
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  scrubber: HTMLInputElement | null = null;
  timeLabel: HTMLElement | null = null;
  _pid = 0; _raf: number | null = null; _expRaf: number | null = null; _last: number | null = null;
  _cellIdx = 0; _cellN = 0; _cellMode = 0; // ô ảnh trong cảnh hiện tại + kiểu vào cảnh (xen kẽ theo cảnh)
  _drag: string | null = null; _cancelExport = false;
  actx: AudioContext | null = null; master: GainNode | null = null; recDest: MediaStreamAudioDestinationNode | null = null;
  audioEl: HTMLAudioElement | null = null; mediaSrc: MediaElementAudioSourceNode | null = null;
  _proc: ReturnType<typeof setInterval> | null = null; _procNodes: OscillatorNode[] = [];

  setState(patch: Partial<EngineState> | ((s: EngineState) => Partial<EngineState> | null), cb?: () => void) {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    if (p) this.state = { ...this.state, ...p };
    this.onChange();
    if (cb) cb();
  }
  getTheme() { return THEMES[this.state.theme] || THEMES.luxe; }
  fmt(t: number) { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + String(s).padStart(2, "0"); }
  smooth(p: number, a: number, b: number) { let t = (p - a) / (b - a); t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  easeIO(t: number) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  coupleName() { const g = (this.state.groom || "").trim(), b = (this.state.bride || "").trim(); if (!g && !b) return "Chú Rể & Cô Dâu"; return (g || "Chú Rể") + " & " + (b || "Cô Dâu"); }
  quotesNow() { return (this.state.story || "").split(/\n{2,}/).map((x) => x.replace(/\n/g, " ").trim()).filter(Boolean); }

  go(id: string) { this.setState({ tab: id }); }
  setField<K extends keyof EngineState>(k: K, v: EngineState[K]) { this.setState({ [k]: v } as Partial<EngineState>, () => this.rebuild()); }

  addFiles(list: FileList | File[] | null) {
    const files = [...(list || [])].filter((f) => f.type && f.type.indexOf("image/") === 0);
    if (!files.length) return;
    const added = files.map((f) => {
      const id = "p" + (this._pid = this._pid + 1);
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => this.rebuild();
      img.src = url;
      this.imgs.set(id, img);
      return { id, name: f.name, url };
    });
    this.setState((s) => ({ photos: [...s.photos, ...added] }), () => this.rebuild());
  }
  removePhoto(id: string) {
    const p = this.state.photos.find((x) => x.id === id);
    if (p) { try { URL.revokeObjectURL(p.url); } catch { /* */ } }
    this.imgs.delete(id);
    this.setState((s) => ({ photos: s.photos.filter((x) => x.id !== id) }), () => this.rebuild());
  }
  reorderPhotos(fromId: string | null, toId: string) {
    if (!fromId || fromId === toId) return;
    this.setState((s) => {
      const arr = s.photos.slice();
      const fi = arr.findIndex((x) => x.id === fromId), ti = arr.findIndex((x) => x.id === toId);
      if (fi < 0 || ti < 0) return null;
      const [it] = arr.splice(fi, 1); arr.splice(ti, 0, it);
      return { photos: arr };
    }, () => this.rebuild());
  }
  selectTheme(id: string) { this.setState({ theme: id }, () => this.rebuild()); }
  selectMusic(id: string) { this.setState({ music: id }, () => { if (this.state.playing) { this.pauseMusic(); this.playMusic(this.time); } }); }
  setAudioFile(file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (this.audioEl) { try { this.audioEl.pause(); } catch { /* */ } }
    this.audioEl = new Audio(url); this.audioEl.loop = true; this.mediaSrc = null;
    this.setState({ music: "upload", audioName: file.name }, () => { if (this.state.playing) { this.pauseMusic(); this.playMusic(this.time); } });
  }

  slideDur(t: string) {
    const b = this.state.perPhoto;
    const m: Record<string, number> = { TITLE: 3.8, OUTRO: 4.2, QUOTE: 3.8, FULL: b, FULLB: b, PANO: b + 0.2, FRAME: b + 0.3, POLAROID: b + 0.2, SPLIT: b + 1.1, DUO: b + 0.7, DUOV: b + 0.7, TRIPLE: b + 1.2, TRIPLE_R: b + 1.2, BANDS: b + 1.0, TRIO: b + 1.0, QUAD: b + 1.6, QUADL: b + 1.6, QUINT: b + 1.8, HEX: b + 2.0 };
    return (m[t] || b) * (this.getTheme().pace || 1);
  }
  // Chọn bố cục hợp với HƯỚNG ảnh của nhóm + khổ video: ảnh ngang → ô ngang,
  // ảnh dọc → ô dọc; ảnh trùng hướng khổ video thì cho full màn hình.
  layoutFor(grp: Photo[], portrait: boolean, rnd: () => number): string {
    const pick = (a: string[]) => a[Math.floor(rnd() * a.length)];
    const k = grp.length;
    const o = this.grpOrient(grp);
    if (k >= 6) return "HEX";
    if (k === 5) return "QUINT";
    if (k === 4) return o === "L" && !portrait ? pick(["QUAD", "QUADL"]) : "QUAD";
    if (k === 3) {
      if (portrait) return o === "L" ? "BANDS" : pick(["TRIPLE", "TRIPLE_R"]);
      return o === "P" ? "TRIO" : pick(["TRIPLE", "TRIPLE_R"]);
    }
    if (k === 2) return portrait && o !== "P" ? pick(["DUOV", "DUO"]) : "DUO";
    if (portrait) {
      // Ảnh dọc trùng khổ dọc → full; ảnh ngang → khung ô ngang trên nền phẳng.
      if (o === "L") return pick(["FRAME", "FRAME", "PANO"]);
      return pick(["FULL", "FULL", "FULLB", "FRAME", "POLAROID"]);
    }
    // Ảnh ngang trùng khổ ngang → full; ảnh dọc → khung ô dọc trên nền phẳng.
    if (o === "P") return pick(["FRAME", "FRAME", "PANO"]);
    return pick(["FULL", "FULL", "FULLB", "FRAME", "POLAROID"]);
  }
  buildPlan(portrait: boolean): Slide[] {
    const P = this.state.photos, Q = this.quotes;
    if (!P.length) return [];
    const showText = this.state.showText && Q.length > 0;
    let s = (this.seed || 1) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const th = this.getTheme();
    const trans = this.state.diverse ? (th.trans || ["fade", "slide", "push"]) : ["fade"];
    // Hiệu ứng XEN KẼ: xoay vòng danh sách hiệu ứng — không lặp lại liên tiếp.
    let ti = Math.floor(rnd() * trans.length);
    const nextTrans = () => trans[ti++ % trans.length];
    // Nhịp số ảnh mỗi cảnh theo phong cách: xen kẽ cảnh 1 ảnh ↔ cảnh ghép nhiều ảnh.
    const rhythm = th.rhythm || [1, 2, 3, 1, 2, 4];
    const slides: Slide[] = [{ type: "TITLE", photos: [P[0]], trans: "fade" }];
    // Bắt đầu montage từ ảnh THỨ HAI: ảnh đầu đã dùng làm bìa (TITLE) nên không
    // lặp lại ở cảnh nội dung đầu tiên. Chỉ 1 ảnh thì vẫn dùng lại cho montage.
    let i = P.length > 1 ? 1 : 0, ri = 0, cnt = 0, qi = 0, side = 0, useSplit = true;
    while (i < P.length) {
      const rem = P.length - i;
      // Ưu tiên gom ảnh CÙNG HƯỚNG liên tiếp (ảnh vuông đi được với cả hai); nếu
      // hướng xen kẽ vẫn ghép nhóm — ô lệch hướng sẽ tự "vừa khung" trên nền mờ.
      let o = this.orientOf(P[i]); let run = 1;
      while (i + run < P.length && run < 6) {
        const oo = this.orientOf(P[i + run]);
        if (oo === o || oo === "S") run++;
        else if (o === "S") { o = oo; run++; }
        else break;
      }
      const kWant = Math.max(1, rhythm[ri % rhythm.length] || 1); ri++;
      const k = Math.min(rem, run >= kWant ? kWant : run >= 2 ? run : kWant);
      const grp = P.slice(i, i + k); i += k;
      slides.push({ type: this.layoutFor(grp, portrait, rnd), photos: grp, trans: nextTrans() });
      cnt++;
      // Xen slide chữ sau mỗi ~3 cảnh ảnh: luân phiên SPLIT (chữ + ảnh) và QUOTE.
      if (showText && cnt % 3 === 0 && qi < Q.length) {
        if (useSplit && i < P.length) { slides.push({ type: "SPLIT", photos: [P[i]], trans: nextTrans(), text: Q[qi++], side }); i++; side = side ? 0 : 1; }
        else slides.push({ type: "QUOTE", photos: [], text: Q[qi++], trans: nextTrans() });
        useSplit = !useSplit;
      }
    }
    slides.push({ type: "OUTRO", photos: [], trans: "fade" });
    return slides;
  }
  retime(plan: Slide[]) { let t = 0; plan.forEach((sl) => { sl.t0 = t; sl.dur = this.slideDur(sl.type); t += sl.dur; }); }
  syncTotal() { const pl = this.plan, last = pl[pl.length - 1]; this.total = pl.length ? (last.t0 || 0) + (last.dur || 0) : 0; }
  // Đồng bộ tổng thời lượng + thanh tua + state theo kế hoạch của khổ đang xem.
  syncDuration() {
    this.syncTotal();
    const total = this.total;
    if (this.scrubber) this.scrubber.max = String(total || 100);
    if (this.time > total) this.time = Math.max(0, total - 0.01);
    if (this.state.total !== total || this.state.slideCount !== this.plan.length) this.setState({ total, slideCount: this.plan.length });
  }
  rebuild() {
    this.quotes = this.state.showText ? this.quotesNow() : [];
    // Dựng RIÊNG hai kế hoạch cảnh: khổ ngang & khổ dọc — mỗi khổ tối ưu bố cục
    // riêng. Áp lại chỉnh sửa từng slide đã lưu để không mất khi dựng lại.
    this.planL = this.buildPlan(false); this.applyOverrides(this.planL, this.ovL); this.retime(this.planL);
    this.planP = this.buildPlan(true); this.applyOverrides(this.planP, this.ovP); this.retime(this.planP);
    this.syncDuration();
    this.drawAt(this.time);
  }
  // Khôi phục chỉnh sửa từng slide lên kế hoạch vừa dựng (khớp theo vị trí slide).
  // Ảnh đã bị xoá khỏi thư viện sẽ tự bỏ qua; bố cục không hợp số ảnh thì lấy mặc định.
  applyOverrides(plan: Slide[], ov: Map<number, SlideOverride>) {
    if (!ov.size) return;
    const byId = new Map(this.state.photos.map((p) => [p.id, p] as const));
    ov.forEach((o, idx) => {
      const sl = plan[idx]; if (!sl) return;
      if (o.trans) sl.trans = o.trans;
      if (sl.type === "OUTRO" || sl.type === "QUOTE") return; // cảnh không có ảnh
      const photos = o.photoIds.map((id) => byId.get(id)).filter(Boolean) as Photo[];
      if (!photos.length) return;
      if (sl.type === "TITLE") { sl.photos = [photos[0]]; return; }
      if (sl.type === "SPLIT") { sl.photos = [photos[0]]; if (o.side != null) sl.side = o.side; return; }
      // Slide ảnh: khôi phục đúng ảnh + bố cục đã chọn (nếu bố cục hợp số ảnh).
      sl.photos = photos;
      const opts = this.layoutsFor(photos.length);
      sl.type = opts.includes(o.type) ? o.type : opts[0];
    });
  }
  // Ghi nhớ chỉnh sửa của slide tại vị trí i (bố cục, hiệu ứng, ảnh, bên chữ).
  recordOverride(i: number) {
    const sl = this.plan[i]; if (!sl) return;
    this.ov.set(i, { type: sl.type, trans: sl.trans, side: sl.side, photoIds: sl.photos.map((p) => p.id) });
  }
  // Đổi khổ xem trước (ngang 16:9 / dọc 9:16) — chỉnh bố cục ở khổ nào chỉ áp dụng cho khổ đó.
  setAspect(portrait: boolean) {
    if (this.state.portrait === portrait || this.state.exporting) return;
    this.pausePreview();
    this.setState({ portrait }, () => {
      this.setSize(portrait ? 1080 : 1920, portrait ? 1920 : 1080);
      this.syncDuration();
      this.drawAt(this.time);
      this.updateScrub();
    });
  }

  // Chỉ số slide hiện đang xem (theo thời gian con trỏ).
  curIndex() {
    const tt = Math.max(0, Math.min(this.time, this.total - 0.001));
    let i = this.plan.findIndex((s) => tt >= (s.t0 || 0) && tt < (s.t0 || 0) + (s.dur || 0));
    if (i < 0) i = this.plan.length - 1;
    return i;
  }
  // Các bố cục ảnh khả dụng theo số ảnh của slide.
  layoutsFor(k: number): string[] {
    if (k >= 6) return ["HEX"];
    if (k === 5) return ["QUINT"];
    if (k === 4) return ["QUAD", "QUADL"];
    if (k === 3) return ["TRIPLE", "TRIPLE_R", "BANDS", "TRIO"];
    if (k === 2) return ["DUO", "DUOV"];
    return ["FULL", "FULLB", "PANO", "FRAME", "POLAROID"];
  }
  // "Bố cục mới": đổi bố cục + hiệu ứng của RIÊNG slide đang xem (giữ nguyên slide khác).
  regenSlide() {
    if (!this.plan.length) return;
    const i = this.curIndex();
    const sl = this.plan[i];
    const TRANS = ["fade", "zoomsoft", "zoom", "slide", "slideleft", "slideup", "slidedown", "push", "pushleft", "pushup", "pushdown", "wipe", "wiperev", "block", "circle", "blur"];
    const pickDiff = (arr: string[], cur?: string) => { const opts = arr.filter((x) => x !== cur); return (opts.length ? opts : arr)[Math.floor(Math.random() * (opts.length ? opts.length : arr.length))]; };
    // Đổi hiệu ứng cho mọi loại slide.
    if (i > 0) sl.trans = pickDiff(TRANS, sl.trans);
    // Đổi bố cục cho slide ảnh (giữ nguyên số ảnh); slide chữ (SPLIT) thì đổi bên.
    if (sl.type === "SPLIT") { sl.side = sl.side ? 0 : 1; }
    else if (!["TITLE", "OUTRO", "QUOTE"].includes(sl.type)) {
      const opts = this.layoutsFor(sl.photos.length);
      sl.type = pickDiff(opts, sl.type);
      // Cập nhật lại thời lượng theo loại mới, dời mốc thời gian các slide sau.
      this.retime(this.plan); this.syncDuration();
    }
    this.recordOverride(i);
    this.drawAt(this.time);
    this.onChange();
  }

  // ——— Chỉnh RIÊNG slide đang xem: thêm ảnh, đổi ảnh, xoá ảnh, chọn bố cục ———
  // Mỗi chỉnh sửa được GHI NHỚ theo vị trí slide (recordOverride) nên khi dựng lại
  // (đổi tên, thời lượng…) slide đó vẫn giữ chỉnh tay — độc lập với các slide khác.
  isPhotoGrid(sl: Slide | null): boolean { return !!sl && !["TITLE", "OUTRO", "QUOTE", "SPLIT"].includes(sl.type); }
  // Đổi bố cục cho slide ảnh đang xem (giữ nguyên số ảnh).
  setSlideLayout(type: string) {
    const i = this.curIndex(); const sl = this.plan[i];
    if (!this.isPhotoGrid(sl) || !sl || sl.type === type) return;
    sl.type = type;
    this.retime(this.plan); this.syncDuration();
    this.recordOverride(i);
    this.drawAt(this.time); this.onChange();
  }
  // Thêm 1 ảnh (từ thư viện) vào slide đang xem — tự chọn bố cục hợp số ảnh mới.
  addPhotoToSlide(photoId: string) {
    const i = this.curIndex(); const sl = this.plan[i];
    if (!this.isPhotoGrid(sl) || !sl || sl.photos.length >= 6) return;
    const ph = this.state.photos.find((x) => x.id === photoId); if (!ph) return;
    sl.photos = [...sl.photos, ph];
    sl.type = this.layoutsFor(sl.photos.length)[0];
    this.retime(this.plan); this.syncDuration();
    this.recordOverride(i);
    this.drawAt(this.time); this.onChange();
  }
  // Xoá bớt 1 ảnh khỏi slide đang xem (luôn giữ ít nhất 1 ảnh).
  removeSlidePhoto(idx: number) {
    const i = this.curIndex(); const sl = this.plan[i];
    if (!this.isPhotoGrid(sl) || !sl || sl.photos.length <= 1) return;
    sl.photos = sl.photos.filter((_, j) => j !== idx);
    sl.type = this.layoutsFor(sl.photos.length)[0];
    this.retime(this.plan); this.syncDuration();
    this.recordOverride(i);
    this.drawAt(this.time); this.onChange();
  }
  // Đổi ảnh tại vị trí idx của slide đang xem (dùng được cho cả bìa & slide chữ+ảnh).
  replaceSlidePhoto(idx: number, photoId: string) {
    const i = this.curIndex(); const sl = this.plan[i];
    if (!sl || idx < 0 || idx >= sl.photos.length) return;
    const ph = this.state.photos.find((x) => x.id === photoId); if (!ph) return;
    sl.photos = sl.photos.map((x, j) => (j === idx ? ph : x));
    this.recordOverride(i);
    this.drawAt(this.time); this.onChange();
  }

  roundRect(x: number, y: number, w: number, h: number, r: number) { const c = this.ctx!; r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  text(str: string, x: number, y: number, size: number, color: string, family: string, weight: number, align: CanvasTextAlign, italic: boolean, letter: number, alpha: number) {
    const c = this.ctx!; c.save();
    if (alpha != null) c.globalAlpha *= alpha;
    c.fillStyle = color; c.textAlign = align || "left"; c.textBaseline = "top";
    c.font = (italic ? "italic " : "") + weight + " " + size + 'px "' + family + '"';
    if ("letterSpacing" in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = (letter || 0) + "px";
    c.fillText(str, x, y);
    if ("letterSpacing" in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    c.restore();
  }
  fitSize(str: string, family: string, weight: number, maxW: number, cap: number, italic: boolean) { const c = this.ctx!; c.font = (italic ? "italic " : "") + weight + ' 100px "' + family + '"'; const w = c.measureText(str).width || 1; return Math.min(cap, 100 * maxW / w); }
  wrap(str: string, size: number, family: string, italic: boolean, maxW: number) {
    const c = this.ctx!; c.font = (italic ? "italic " : "") + "500 " + size + 'px "' + family + '"';
    const words = (str || "").split(/\s+/), lines: string[] = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }
  // Vẽ 1 ô ảnh. fit='auto': nếu tỉ lệ ảnh lệch nhiều so với ô → "vừa khung"
  // (không cắt ảnh), lấp nền bằng chính ảnh đó làm mờ; ngược lại "phủ đầy" với
  // Ken Burns NHẸ. Zoom đã giảm mạnh để hạn chế cắt ảnh.
  drawPhotoCell(x: number, y: number, w: number, h: number, r: number, p: number, seed: number, photo?: Photo, fit: "auto" | "cover" | "contain" = "auto") {
    const c = this.ctx!; const img = photo ? this.imgs.get(photo.id) : null;
    c.save();
    // Từng ảnh vào cảnh riêng, lệch nhịp nhau (bố cục nhiều ảnh). Kiểu vào cảnh
    // XEN KẼ theo từng cảnh: trượt từ mép / hiện dần nhô lên / phóng nhẹ.
    if (this._cellN >= 2) {
      const ei = this._cellIdx++;
      const step = Math.min(0.07, 0.25 / this._cellN);
      const a0 = 0.02 + ei * step;
      const e = this.smooth(p, a0, a0 + 0.2);
      if (e < 1) {
        if (this._cellMode === 1) { c.globalAlpha *= e; c.translate(0, (1 - e) * 46); }
        else if (this._cellMode === 2) { c.globalAlpha *= e; const zs = 0.92 + 0.08 * e; c.translate(x + w / 2, y + h / 2); c.scale(zs, zs); c.translate(-(x + w / 2), -(y + h / 2)); }
        else {
          const ccx = x + w / 2;
          const centered = Math.abs(ccx - this.W / 2) < this.W * 0.08;
          const fromLeft = centered ? ei % 2 === 0 : ccx < this.W / 2;
          c.translate((1 - e) * (fromLeft ? -(x + w + 60) : this.W - x + 60), 0);
        }
      }
    }
    this.roundRect(x, y, w, h, r); c.clip();
    if (img && img.complete && img.naturalWidth) {
      const iAR = img.naturalWidth / img.naturalHeight, cAR = w / h;
      const mismatch = iAR > cAR ? iAR / cAR : cAR / iAR;
      const kb = this.getTheme().kb || 0.05;
      const mode = fit === "auto" ? (mismatch > 1.5 ? "contain" : "cover") : fit;
      if (mode === "contain") {
        // Nền: bản phủ đầy phóng to, làm MỜ MẠNH + tối, để không có viền đen.
        const cs = Math.max(w / img.naturalWidth, h / img.naturalHeight) * 1.15;
        const bw = img.naturalWidth * cs, bh = img.naturalHeight * cs;
        // Blur nền rất tốn khi xuất (mỗi khung × 30fps) → giảm bán kính lúc xuất
        // để giữ đủ 30fps, đỡ khựng/giật; xem trước vẫn dùng blur mạnh cho đẹp.
        const bl = this.state.exporting ? 30 : 60;
        c.save(); try { c.filter = "blur(" + bl + "px) brightness(.55)"; } catch { /* */ } c.drawImage(img, x + (w - bw) / 2, y + (h - bh) / 2, bw, bh); c.restore();
        // Tiền cảnh: nguyên ảnh (không cắt), phóng rất nhẹ.
        const z = 1 + kb * 0.4 * p;
        const fs = Math.min(w / img.naturalWidth, h / img.naturalHeight) * z;
        const iw = img.naturalWidth * fs, ih = img.naturalHeight * fs;
        c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      } else {
        const z = 1.02 + kb * p; // zoom nhẹ
        const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * z;
        const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
        const sx = (iw - w) / 2, sy = (ih - h) / 2;
        const dx = ((seed % 2) ? 1 : -1) * sx * 0.18 * (2 * p - 1);
        const dy = (((seed >> 1) & 1) ? 1 : -1) * sy * 0.18 * (2 * p - 1);
        c.drawImage(img, x + (w - iw) / 2 + dx, y + (h - ih) / 2 + dy, iw, ih);
      }
    } else { c.fillStyle = "#d8d2c8"; c.fillRect(x, y, w, h); }
    c.restore();
  }
  // Hướng ảnh: L (ngang) / P (dọc) / S (vuông) từ kích thước thật.
  orientOf(photo?: Photo): "L" | "P" | "S" {
    const img = photo ? this.imgs.get(photo.id) : null;
    if (!img || !img.naturalWidth) return "S";
    const r = img.naturalWidth / img.naturalHeight;
    return r > 1.15 ? "L" : r < 0.87 ? "P" : "S";
  }
  // Hướng trội của một nhóm ảnh.
  grpOrient(photos: Photo[]): "L" | "P" | "S" {
    let nP = 0, nL = 0;
    photos.forEach((x) => { const o = this.orientOf(x); if (o === "P") nP++; else if (o === "L") nL++; });
    return nP > nL ? "P" : nL > nP ? "L" : "S";
  }
  drawEmpty() {
    const c = this.ctx!, th = this.getTheme(), W = this.W, H = this.H;
    c.fillStyle = th.ink; c.globalAlpha = 0.9;
    this.text("Tải ảnh lên để bắt đầu", W / 2, H / 2 - 40, 56, th.ink, th.title, 600, "center", th.titleItalic, 0, 1);
    this.text("Kéo thả ảnh cưới của bạn ở bảng bên trái", W / 2, H / 2 + 40, 26, th.sub, th.body, 500, "center", false, 0, 0.9);
    c.globalAlpha = 1;
  }
  renderSlide(slide: Slide, p: number, opts: { alpha?: number; clipX?: number; clipW?: number; clipCircle?: number; dx?: number; dy?: number; scale?: number }) {
    const c = this.ctx!, W = this.W, H = this.H, th = this.getTheme();
    c.save();
    c.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    if (opts.clipCircle != null) { const r = opts.clipCircle * Math.hypot(W, H) / 2; c.beginPath(); c.arc(W / 2, H / 2, Math.max(0, r), 0, Math.PI * 2); c.clip(); }
    else if (opts.clipW != null) { c.beginPath(); c.rect(opts.clipX || 0, 0, opts.clipW, H); c.clip(); }
    if (opts.dx || opts.dy) c.translate(opts.dx || 0, opts.dy || 0);
    if (opts.scale && opts.scale !== 1) { c.translate(W / 2, H / 2); c.scale(opts.scale, opts.scale); c.translate(-W / 2, -H / 2); }
    c.fillStyle = th.bg; c.fillRect(0, 0, W, H);
    this._cellIdx = 0; this._cellN = slide.photos.length;
    this._cellMode = (slide.photos.length + Math.round((slide.t0 || 0) * 10)) % 3;
    switch (slide.type) {
      case "TITLE": this.drawTitle(slide, p); break;
      case "OUTRO": this.drawOutro(slide, p); break;
      case "QUOTE": this.drawQuote(slide, p); break;
      case "FULL": this.drawPhotoCell(0, 0, W, H, 0, p, 3, slide.photos[0]); break;
      case "FULLB": this.drawFullBorder(slide, p); break;
      case "PANO": this.drawPhotoCell(0, 0, W, H, 0, p, 3, slide.photos[0], "contain"); break;
      case "FRAME": this.drawFrame(slide, p); break;
      case "POLAROID": this.drawPolaroid(slide, p); break;
      case "SPLIT": this.drawSplit(slide, p); break;
      case "DUO": this.drawDuo(slide, p); break;
      case "DUOV": this.drawDuoV(slide, p); break;
      case "TRIPLE": this.drawTriple(slide, p); break;
      case "TRIPLE_R": this.drawTriple(slide, p, true); break;
      case "BANDS": this.drawBands(slide, p); break;
      case "TRIO": this.drawTrio(slide, p); break;
      case "QUAD": this.drawQuad(slide, p); break;
      case "QUADL": this.drawQuadL(slide, p); break;
      case "QUINT": this.drawQuint(slide, p); break;
      case "HEX": this.drawHex(slide, p); break;
    }
    c.restore();
  }
  drawTitle(slide: Slide, p: number) {
    const c = this.ctx!, th = this.getTheme(), W = this.W, H = this.H;
    const hero = slide.photos[0];
    if (hero) this.drawPhotoCell(0, 0, W, H, 0, p, 7, hero);
    else { c.fillStyle = th.accent; c.globalAlpha = 0.18; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(0,0,0,0.18)"); g.addColorStop(0.5, "rgba(0,0,0,0.06)"); g.addColorStop(1, "rgba(0,0,0,0.66)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const a = this.smooth(p, 0, 0.22); const rise = (1 - a) * 22;
    c.save(); c.globalAlpha *= a;
    const cx = W / 2; let y = H * 0.585 - rise;
    const eb = (this.state.eyebrow || "LỄ THÀNH HÔN").toUpperCase();
    this.text(eb, cx, y, 26, "#ffffff", th.body, 600, "center", false, 6, 0.9); y += 52;
    c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 40, y); c.lineTo(cx + 40, y); c.stroke(); y += 38;
    const nm = this.coupleName(); const ns = this.fitSize(nm, th.title, 600, W * 0.82, 120, th.titleItalic);
    this.text(nm, cx, y, ns, "#ffffff", th.title, 600, "center", th.titleItalic, 0, 1); y += ns * 1.02 + 30;
    if (this.state.date) this.text(this.state.date, cx, y, 30, "rgba(255,255,255,0.92)", th.body, 500, "center", false, 4, 1);
    c.restore();
  }
  drawOutro(_slide: Slide, p: number) {
    const c = this.ctx!, th = this.getTheme(), W = this.W, H = this.H;
    const a = this.smooth(p, 0, 0.22); const rise = (1 - a) * 20;
    c.save(); c.globalAlpha *= a;
    const cx = W / 2; let y = H * 0.32 - rise;
    this.text("TRÂN TRỌNG CẢM ƠN", cx, y, 24, th.accent, th.body, 600, "center", false, 6, 1); y += 54;
    const big = "Cảm ơn"; const bs = this.fitSize(big, th.title, 600, W * 0.6, 132, th.titleItalic);
    this.text(big, cx, y, bs, th.ink, th.title, 600, "center", th.titleItalic, 0, 1); y += bs + 28;
    c.strokeStyle = th.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 34, y); c.lineTo(cx + 34, y); c.stroke(); y += 34;
    this.text(this.coupleName(), cx, y, 46, th.ink, th.title, 500, "center", th.titleItalic, 0, 1); y += 66;
    if (this.state.date) this.text(this.state.date, cx, y, 26, th.sub, th.body, 500, "center", false, 3, 1);
    c.restore();
  }
  drawQuote(slide: Slide, p: number) {
    const c = this.ctx!, th = this.getTheme(), W = this.W, H = this.H;
    const a = this.smooth(p, 0, 0.2); const rise = (1 - a) * 18;
    c.save(); c.globalAlpha *= a;
    const size = 58; const lines = this.wrap(slide.text || "", size, th.title, th.titleItalic, W * 0.66);
    const lh = size * 1.3; const blockH = lines.length * lh; let y = H / 2 - blockH / 2 - rise;
    c.strokeStyle = th.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 34, y - 42); c.lineTo(W / 2 + 34, y - 42); c.stroke();
    for (const l of lines) { this.text(l, W / 2, y, size, th.ink, th.title, 500, "center", th.titleItalic, 0, 1); y += lh; }
    y += 18; this.text(this.coupleName().toUpperCase(), W / 2, y, 20, th.sub, th.body, 600, "center", false, 4, 1);
    c.restore();
  }
  drawFrame(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H, V = H > W;
    // Ô khung theo ĐÚNG tỉ lệ ảnh (ảnh dọc → ô dọc, ảnh ngang → ô ngang) canh giữa
    // trên nền phẳng — ảnh trọn vẹn, không cắt, không ghép ảnh mờ phía sau.
    const img = slide.photos[0] ? this.imgs.get(slide.photos[0].id) : null;
    const ar = img && img.naturalWidth ? Math.max(0.62, Math.min(1.8, img.naturalWidth / img.naturalHeight)) : (V ? 0.72 : 1.5);
    const maxW = W - (V ? 220 : 360), maxH = H - (V ? 420 : 300);
    const w = Math.min(maxW, Math.round(maxH * ar)), h = Math.round(w / ar);
    const x = (W - w) / 2, y = (H - h) / 2;
    this.drawPhotoCell(x, y, w, h, th.radius, p, 5, slide.photos[0]);
    this.text(this.coupleName(), x, y - 52, 26, th.sub, th.body, 600, "left", false, 2, 1);
    if (this.state.date) this.text(this.state.date, x + w, y + h + 18, 22, th.sub, th.body, 500, "right", false, 3, 1);
  }
  // FULL VIỀN: ảnh phủ đầy khung + đường viền trang trí lồng vào trong (khung
  // kép mảnh) — giữ được cảm giác "full màn hình" nhưng có viền nhẹ nhàng, sang.
  drawFullBorder(slide: Slide, p: number) {
    const c = this.ctx!, th = this.getTheme(), W = this.W, H = this.H;
    this.drawPhotoCell(0, 0, W, H, 0, p, 3, slide.photos[0]);
    const m = Math.round(Math.min(W, H) * 0.05);
    const iw = W - 2 * m, ih = H - 2 * m;
    c.save();
    // Viền ngoài đậm hơn (kèm bóng nhẹ để nổi trên cả ảnh sáng lẫn tối).
    c.shadowColor = "rgba(0,0,0,0.35)"; c.shadowBlur = 12;
    c.strokeStyle = "rgba(255,255,255,0.92)"; c.lineWidth = 3;
    this.roundRect(m, m, iw, ih, th.radius); c.stroke();
    c.shadowColor = "transparent";
    // Viền trong mảnh, lồng vào — tạo khung kép thanh lịch.
    c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1;
    const g2 = 9;
    this.roundRect(m + g2, m + g2, iw - 2 * g2, ih - 2 * g2, Math.max(0, th.radius - 3)); c.stroke();
    c.restore();
  }
  drawSplit(slide: Slide, p: number) {
    const c = this.ctx!, th = this.getTheme(), W = this.W, H = this.H;
    if (H > W) {
      // Khổ dọc: ảnh chiếm nửa trên/dưới, chữ ở phần còn lại.
      const vside = slide.side || 0; const ph = Math.round(H * 0.56);
      const py = vside === 0 ? 0 : H - ph;
      this.drawPhotoCell(0, py, W, ph, 0, p, 4, slide.photos[0]);
      const pad = 76; const ty = vside === 0 ? ph : 0; const thh = H - ph;
      const a = this.smooth(p, 0, 0.2); c.save(); c.globalAlpha *= a;
      const size = 44; const lines = this.wrap(slide.text || "", size, th.title, th.titleItalic, W - pad * 2); const lh = size * 1.3;
      let y = ty + thh / 2 - (lines.length * lh + 92) / 2;
      c.strokeStyle = th.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(pad, y); c.lineTo(pad + 56, y); c.stroke(); y += 32;
      for (const l of lines) { this.text(l, pad, y, size, th.ink, th.title, 500, "left", th.titleItalic, 0, 1); y += lh; }
      y += 22; this.text(this.coupleName().toUpperCase(), pad, y, 18, th.sub, th.body, 600, "left", false, 3, 1);
      c.restore();
      return;
    }
    const side = slide.side || 0; const pw = Math.round(W * 0.55);
    const px = side === 0 ? 0 : W - pw;
    this.drawPhotoCell(px, 0, pw, H, 0, p, 4, slide.photos[0]);
    const tx = side === 0 ? pw : 0; const tw = W - pw; const pad = 90; const cx = tx + pad;
    const a = this.smooth(p, 0, 0.2); c.save(); c.globalAlpha *= a;
    let y = H * 0.34;
    c.strokeStyle = th.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, y); c.lineTo(cx + 56, y); c.stroke(); y += 34;
    const size = 48; const lines = this.wrap(slide.text || "", size, th.title, th.titleItalic, tw - pad * 2); const lh = size * 1.3;
    for (const l of lines) { this.text(l, cx, y, size, th.ink, th.title, 500, "left", th.titleItalic, 0, 1); y += lh; }
    y += 26; this.text(this.coupleName().toUpperCase(), cx, y, 20, th.sub, th.body, 600, "left", false, 3, 1);
    c.restore();
  }
  drawDuo(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H;
    const o = this.grpOrient(slide.photos);
    if (H > W) {
      if (o === "P") {
        // Khổ dọc + 2 ảnh dọc: 2 ô dọc cạnh nhau canh giữa — ảnh không bị cắt.
        const M = 60, g = 22, w = (W - 2 * M - g) / 2;
        const h = Math.min(H - 2 * M, Math.round(w / 0.72)), y = (H - h) / 2;
        this.drawPhotoCell(M, y, w, h, th.radius, p, 2, slide.photos[0]);
        this.drawPhotoCell(M + w + g, y, w, h, th.radius, p, 5, slide.photos[1]);
        return;
      }
      // Ảnh ngang/vuông: xếp dọc 56/44 (khác DUOV chia đều).
      const M = 70, g = 24, w = W - 2 * M;
      const h1 = Math.round((H - 2 * M - g) * 0.56), h2 = (H - 2 * M - g) - h1;
      this.drawPhotoCell(M, M, w, h1, th.radius, p, 2, slide.photos[0]);
      this.drawPhotoCell(M, M + h1 + g, w, h2, th.radius, p, 5, slide.photos[1]);
      return;
    }
    if (o === "L") {
      // Khổ ngang + 2 ảnh ngang: 2 ô ngang cạnh nhau, canh giữa theo chiều cao.
      const M = 70, g = 26, w = (W - 2 * M - g) / 2;
      const h = Math.min(H - 2 * M, Math.round(w / 1.5)), y = (H - h) / 2;
      this.drawPhotoCell(M, y, w, h, th.radius, p, 2, slide.photos[0]);
      this.drawPhotoCell(M + w + g, y, w, h, th.radius, p, 5, slide.photos[1]);
      return;
    }
    const M = 70, g = 26;
    const w = (W - 2 * M - g) / 2, h = H - 2 * M;
    this.drawPhotoCell(M, M, w, h, th.radius, p, 2, slide.photos[0]);
    this.drawPhotoCell(M + w + g, M, w, h, th.radius, p, 5, slide.photos[1]);
  }
  drawDuoV(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H, M = 90, g = 24;
    const w = W - 2 * M, h = (H - 2 * M - g) / 2;
    this.drawPhotoCell(M, M, w, h, th.radius, p, 2, slide.photos[0]);
    this.drawPhotoCell(M, M + h + g, w, h, th.radius, p, 5, slide.photos[1]);
  }
  drawTriple(slide: Slide, p: number, mirror = false) {
    const th = this.getTheme(), W = this.W, H = this.H;
    if (H > W) {
      // Khổ dọc: 1 ảnh lớn + hàng 2 ảnh nhỏ (mirror: hàng nhỏ ở trên).
      const M = 64, g = 22, w = W - 2 * M;
      const bigH = Math.round((H - 2 * M - g) * 0.62), sh = (H - 2 * M - g) - bigH, sw = (w - g) / 2;
      const bigY = mirror ? M + sh + g : M, rowY = mirror ? M : M + bigH + g;
      this.drawPhotoCell(M, bigY, w, bigH, th.radius, p, 2, slide.photos[0]);
      this.drawPhotoCell(M, rowY, sw, sh, th.radius, p, 4, slide.photos[1]);
      this.drawPhotoCell(M + sw + g, rowY, sw, sh, th.radius, p, 6, slide.photos[2]);
      return;
    }
    const M = 70, g = 26;
    const bigW = Math.round((W - 2 * M - g) * 0.6), rightW = (W - 2 * M - g) - bigW, h = H - 2 * M, sh = (h - g) / 2;
    const bigX = mirror ? M + rightW + g : M, colX = mirror ? M : M + bigW + g;
    this.drawPhotoCell(bigX, M, bigW, h, th.radius, p, 2, slide.photos[0]);
    this.drawPhotoCell(colX, M, rightW, sh, th.radius, p, 4, slide.photos[1]);
    this.drawPhotoCell(colX, M + sh + g, rightW, sh, th.radius, p, 6, slide.photos[2]);
  }
  drawBands(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H, M = 60, g = 20;
    const w = W - 2 * M, h = (H - 2 * M - 2 * g) / 3;
    for (let i = 0; i < 3; i++) this.drawPhotoCell(M, M + i * (h + g), w, h, th.radius, p, i + 2, slide.photos[i]);
  }
  drawTrio(slide: Slide, p: number) {
    // Khổ ngang: 3 ô DỌC cạnh nhau canh giữa (hợp ảnh dọc); khổ dọc: 3 băng ngang.
    if (this.H > this.W) { this.drawBands(slide, p); return; }
    const th = this.getTheme(), W = this.W, H = this.H, M = 70, g = 24;
    const w = (W - 2 * M - 2 * g) / 3;
    const h = Math.min(H - 2 * M, Math.round(w / 0.72)), y = (H - h) / 2;
    for (let i = 0; i < 3; i++) this.drawPhotoCell(M + i * (w + g), y, w, h, th.radius, p, i + 2, slide.photos[i]);
  }
  drawQuadL(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H;
    if (H > W) {
      // Khổ dọc: ảnh lớn trên + hàng 3 ảnh nhỏ dưới.
      const M = 64, g = 20, w = W - 2 * M;
      const bigH = Math.round((H - 2 * M - g) * 0.6), sh = (H - 2 * M - g) - bigH, sw = (w - 2 * g) / 3;
      this.drawPhotoCell(M, M, w, bigH, th.radius, p, 2, slide.photos[0]);
      for (let i = 0; i < 3; i++) this.drawPhotoCell(M + i * (sw + g), M + bigH + g, sw, sh, th.radius, p, i + 3, slide.photos[i + 1]);
      return;
    }
    const M = 64, g = 22;
    const bigW = Math.round((W - 2 * M - g) * 0.62), rightW = (W - 2 * M - g) - bigW, h = H - 2 * M, sh = (h - 2 * g) / 3;
    this.drawPhotoCell(M, M, bigW, h, th.radius, p, 2, slide.photos[0]);
    for (let i = 0; i < 3; i++) this.drawPhotoCell(M + bigW + g, M + i * (sh + g), rightW, sh, th.radius, p, i + 3, slide.photos[i + 1]);
  }
  drawQuint(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H;
    if (H > W) {
      // Khổ dọc: ảnh lớn trên + lưới 2×2 dưới.
      const M = 60, g = 20, w = W - 2 * M;
      const bigH = Math.round((H - 2 * M - g) * 0.52), rest = (H - 2 * M - g) - bigH;
      const cw = (w - g) / 2, chh = (rest - g) / 2, by = M + bigH + g;
      this.drawPhotoCell(M, M, w, bigH, th.radius, p, 2, slide.photos[0]);
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach((cc, ix) => this.drawPhotoCell(M + cc[0] * (cw + g), by + cc[1] * (chh + g), cw, chh, th.radius, p, ix + 3, slide.photos[ix + 1]));
      return;
    }
    const M = 64, g = 20;
    const bigW = Math.round((W - 2 * M - g) * 0.58), rightW = (W - 2 * M - g) - bigW, h = H - 2 * M;
    const cw = (rightW - g) / 2, chh = (h - g) / 2;
    this.drawPhotoCell(M, M, bigW, h, th.radius, p, 2, slide.photos[0]);
    const bx = M + bigW + g;
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach((cc, ix) => this.drawPhotoCell(bx + cc[0] * (cw + g), M + cc[1] * (chh + g), cw, chh, th.radius, p, ix + 3, slide.photos[ix + 1]));
  }
  drawHex(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H, M = 56, g = 18;
    const cols = H > W ? 2 : 3, rows = H > W ? 3 : 2; // khổ dọc: lưới 2×3 thay vì 3×2
    const w = (W - 2 * M - (cols - 1) * g) / cols, h = (H - 2 * M - (rows - 1) * g) / rows;
    for (let ix = 0; ix < 6; ix++) this.drawPhotoCell(M + (ix % cols) * (w + g), M + Math.floor(ix / cols) * (h + g), w, h, th.radius, p, ix + 2, slide.photos[ix]);
  }
  drawPolaroid(slide: Slide, p: number) {
    const c = this.ctx!, W = this.W, H = this.H;
    // Khung polaroid theo hướng ảnh: ảnh dọc → khung đứng, ảnh ngang → khung ngang.
    const o = this.orientOf(slide.photos[0]);
    const ratio = o === "P" ? 1.22 : o === "S" ? 0.95 : 0.7;
    const pw = Math.min(W * 0.62, 1180, Math.round((H - 300) / ratio)), ph = pw * ratio, x = (W - pw) / 2, y = (H - (ph + 120)) / 2;
    c.save(); c.translate(W / 2, H / 2); c.rotate(-0.03); c.translate(-W / 2, -H / 2);
    c.fillStyle = "#fff"; c.shadowColor = "rgba(0,0,0,.4)"; c.shadowBlur = 60; c.shadowOffsetY = 24;
    this.roundRect(x, y, pw, ph + 120, 8); c.fill(); c.shadowColor = "transparent";
    this.drawPhotoCell(x + 40, y + 40, pw - 80, ph - 40, 2, p, 3, slide.photos[0]);
    c.restore();
  }
  drawQuad(slide: Slide, p: number) {
    const th = this.getTheme(), W = this.W, H = this.H;
    const o = this.grpOrient(slide.photos);
    if (H <= W && o === "P") {
      // Khổ ngang + 4 ảnh dọc: hàng 4 ô dọc canh giữa.
      const M = 70, g = 22, w = (W - 2 * M - 3 * g) / 4;
      const h = Math.min(H - 2 * M, Math.round(w / 0.72)), y = (H - h) / 2;
      for (let i = 0; i < 4; i++) this.drawPhotoCell(M + i * (w + g), y, w, h, th.radius, p, i + 2, slide.photos[i]);
      return;
    }
    if (H > W && o === "L") {
      // Khổ dọc + 4 ảnh ngang: 4 băng ngang xếp dọc.
      const M = 64, g = 20, w = W - 2 * M, h = (H - 2 * M - 3 * g) / 4;
      for (let i = 0; i < 4; i++) this.drawPhotoCell(M, M + i * (h + g), w, h, th.radius, p, i + 2, slide.photos[i]);
      return;
    }
    const M = 70, g = 26;
    const w = (W - 2 * M - g) / 2, h = (H - 2 * M - g) / 2;
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
    cells.forEach((cc, ix) => this.drawPhotoCell(M + cc[0] * (w + g), M + cc[1] * (h + g), w, h, th.radius, p, ix + 2, slide.photos[ix]));
  }
  drawAt(t: number) {
    const c = this.ctx; if (!c) return;
    const th = this.getTheme(), W = this.W, H = this.H;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.clearRect(0, 0, W, H); c.fillStyle = th.bg; c.fillRect(0, 0, W, H);
    if (!this.plan.length || !this.state.photos.length) { this.drawEmpty(); return; }
    const total = this.total; const tt = Math.max(0, Math.min(t, total - 0.001));
    let i = this.plan.findIndex((s) => tt >= (s.t0 || 0) && tt < (s.t0 || 0) + (s.dur || 0)); if (i < 0) i = this.plan.length - 1;
    const cur = this.plan[i], localT = tt - (cur.t0 || 0), d = cur.dur || 0, p = d > 0 ? localT / d : 0;
    const TR = Math.min(th.tr || 0.7, d * 0.5);
    if (i > 0 && localT < TR) {
      const prev = this.plan[i - 1];
      const e = this.easeIO(localT / TR);
      switch (cur.trans) {
        case "zoomsoft": this.renderSlide(prev, 1, { scale: 1 + 0.05 * e }); this.renderSlide(cur, p, { alpha: e, scale: 1.06 - 0.06 * e }); break;
        case "zoom": this.renderSlide(prev, 1, { scale: 1 + 0.10 * e }); this.renderSlide(cur, p, { alpha: this.smooth(e, 0, 0.55), scale: 1.15 - 0.15 * e }); break;
        case "slide": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { dx: (1 - e) * W }); break;
        case "slideleft": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { dx: -(1 - e) * W }); break;
        case "pushleft": this.renderSlide(prev, 1, { dx: e * W }); this.renderSlide(cur, p, { dx: -(1 - e) * W }); break;
        case "slideup": case "slideU": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { dy: (1 - e) * H }); break;
        case "push": this.renderSlide(prev, 1, { dx: -e * W }); this.renderSlide(cur, p, { dx: (1 - e) * W }); break;
        case "pushup": this.renderSlide(prev, 1, { dy: -e * H }); this.renderSlide(cur, p, { dy: (1 - e) * H }); break;
        case "slidedown": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { dy: -(1 - e) * H }); break;
        case "pushdown": this.renderSlide(prev, 1, { dy: e * H }); this.renderSlide(cur, p, { dy: -(1 - e) * H }); break;
        case "wipe": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { clipW: e * W, scale: 1.05 - 0.05 * e }); break;
        case "wiperev": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { clipX: W - e * W, clipW: e * W, scale: 1.05 - 0.05 * e }); break;
        case "block": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { clipW: e * W }); c.save(); c.fillStyle = th.accent; c.globalAlpha = 0.92; c.fillRect(e * W - 10, 0, 10, H); c.restore(); break;
        case "circle": this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { clipCircle: e }); break;
        case "blur": this.renderSlide(prev, 1, { scale: 1 + 0.03 * e }); this.renderSlide(cur, p, { alpha: e, scale: 1.05 - 0.05 * e }); break;
        default: this.renderSlide(prev, 1, {}); this.renderSlide(cur, p, { alpha: e });
      }
    } else { this.renderSlide(cur, p, {}); }
    if (th.letterbox) { c.fillStyle = "#0b0b0d"; c.fillRect(0, 0, W, 64); c.fillRect(0, H - 64, W, 64); }
    if (th.dark) { const gg = c.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95); gg.addColorStop(0, "rgba(0,0,0,0)"); gg.addColorStop(1, "rgba(0,0,0,0.34)"); c.fillStyle = gg; c.fillRect(0, 0, W, H); }
  }

  updateScrub() { if (this.scrubber) this.scrubber.value = String(this.time); if (this.timeLabel) this.timeLabel.textContent = this.fmt(this.time); }
  playTick = (ts: number) => {
    if (this._last == null) this._last = ts;
    const dt = (ts - this._last) / 1000; this._last = ts;
    this.time += dt;
    if (this.time >= this.total) this.time = this.time % (this.total || 1);
    this.drawAt(this.time); this.updateScrub();
    this._raf = requestAnimationFrame(this.playTick);
  };
  togglePlay() {
    if (!this.state.photos.length) return;
    if (this.state.playing) { this.pausePreview(); return; }
    this.setState({ playing: true });
    this.playMusic(this.time);
    this._last = null; this._raf = requestAnimationFrame(this.playTick);
  }
  pausePreview() { this.setState({ playing: false }); if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } this._last = null; this.pauseMusic(); }
  onScrub(v: number) { this.time = v; this.drawAt(v); if (this.timeLabel) this.timeLabel.textContent = this.fmt(v); if (this.state.music === "upload" && this.audioEl) { try { this.audioEl.currentTime = this.audioEl.duration ? v % this.audioEl.duration : v; } catch { /* */ } } this.onChange(); }

  ensureAudio() {
    if (this.actx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
    this.actx = new AC();
    this.master = this.actx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.actx.destination);
    this.recDest = this.actx.createMediaStreamDestination(); this.master.connect(this.recDest);
  }
  playMusic(from: number) {
    const m = this.state.music; if (m === "none") return;
    this.ensureAudio(); if (!this.actx) return;
    if (this.actx.resume) this.actx.resume();
    this.stopMusicNodes();
    if (m === "upload") {
      if (!this.audioEl) return;
      if (!this.mediaSrc) { try { this.mediaSrc = this.actx.createMediaElementSource(this.audioEl); this.mediaSrc.connect(this.master!); } catch { /* */ } }
      try { this.audioEl.currentTime = this.audioEl.duration ? (from || 0) % this.audioEl.duration : (from || 0); } catch { /* */ }
      this.audioEl.loop = true; this.audioEl.play().catch(() => {});
    } else { this.startProc(m); }
  }
  pauseMusic() { if (this.state.music === "upload" && this.audioEl) { try { this.audioEl.pause(); } catch { /* */ } } this.stopMusicNodes(); }
  stopMusicNodes() {
    if (this._proc) { clearInterval(this._proc); this._proc = null; }
    if (this._procNodes) { this._procNodes.forEach((n) => { try { n.stop(); } catch { /* */ } try { n.disconnect(); } catch { /* */ } }); this._procNodes = []; }
  }
  _note(freq: number, at: number, dur: number, vol: number) {
    const ctx = this.actx!;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); o2.connect(g); g.connect(this.master!);
    o.start(at); o2.start(at); o.stop(at + dur + 0.1); o2.stop(at + dur + 0.1);
  }
  startProc(kind: string) {
    const ctx = this.actx!; this._procNodes = [];
    if (kind === "strings") {
      [130.81, 196.0].forEach((f) => {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 680;
        const g = ctx.createGain(); g.gain.value = 0.028;
        o.connect(lp); lp.connect(g); g.connect(this.master!); o.start(); this._procNodes.push(o);
      });
    }
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const step = () => {
      const now = ctx.currentTime;
      const f = scale[Math.floor(Math.random() * scale.length)];
      this._note(f, now, kind === "strings" ? 2.6 : 1.9, kind === "strings" ? 0.05 : 0.09);
      if (Math.random() < 0.35) this._note(scale[Math.floor(Math.random() * scale.length)], now + 0.14, 1.6, 0.045);
    };
    step();
    this._proc = setInterval(step, kind === "strings" ? 1500 : 960);
  }

  // Đặt kích thước canvas rendering (16:9 ngang mặc định, 9:16 dọc khi xuất dọc).
  setSize(w: number, h: number) {
    this.W = w; this.H = h;
    if (this.canvas) { this.canvas.width = w; this.canvas.height = h; }
  }
  async exportVideo(aspect: "landscape" | "portrait" = "landscape") {
    if (this.state.exporting) return;
    if (!this.state.photos.length) { this.setState({ exportError: "Hãy tải ảnh lên trước khi xuất video." }); setTimeout(() => this.setState({ exportError: "" }), 4000); return; }
    this.pausePreview();
    this._cancelExport = false;
    this.setState({ exporting: true, exportPct: 0, exportError: "" });
    // Chuyển canvas sang đúng khổ cần xuất — dùng kế hoạch cảnh riêng của khổ đó.
    if (aspect === "portrait") this.setSize(1080, 1920); else this.setSize(1920, 1080);
    this.syncTotal();
    this.time = 0; this.drawAt(0);
    await new Promise((r) => setTimeout(r, 80));
    try {
      const canvas = this.canvas!, fps = 30;
      // Nộp frame THỦ CÔNG: captureStream(0) = recorder chỉ nhận khung khi ta gọi
      // requestFrame() → mỗi khung vẽ ra được ghi đúng một lần, đều nhau, không bị
      // chụp trùng khung cũ (nguyên nhân khựng/giật). Nếu trình duyệt không hỗ trợ
      // thì quay lại chế độ tự lấy mẫu theo fps.
      const capOf = (r: number) => (canvas as HTMLCanvasElement & { captureStream: (f?: number) => MediaStream }).captureStream(r);
      let vs = capOf(0);
      let vtrack = vs.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
      const manual = !!vtrack && typeof vtrack.requestFrame === "function";
      if (!manual) { vs = capOf(fps); vtrack = vs.getVideoTracks()[0] as typeof vtrack; }
      const tracks: MediaStreamTrack[] = [...vs.getVideoTracks()];
      if (this.state.music !== "none") {
        this.ensureAudio();
        if (this.actx) { if (this.actx.resume) await this.actx.resume(); this.playMusic(0); if (this.recDest) tracks.push(...this.recDest.stream.getAudioTracks()); }
      }
      const stream = new MediaStream(tracks);
      const mimes = ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mime = mimes.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 16000000, audioBitsPerSecond: 192000 } : {});
      const chunks: BlobPart[] = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
      rec.start(120);
      const total = this.total, t0 = performance.now(), frameMs = 1000 / fps;
      // Vẽ + nộp khung đầu ngay để stream có nội dung.
      this.time = 0; this.drawAt(0); if (manual) vtrack.requestFrame!();
      await new Promise<void>((resolve) => {
        let lastSub = performance.now();
        const tick = () => {
          const now = performance.now();
          const el = (now - t0) / 1000;
          this.time = Math.min(el, total);
          if (manual) {
            // Nộp đúng nhịp ~fps (bám đồng hồ thực để đồng bộ nhạc); khi vẽ chậm thì
            // nộp ngay khung mới nhất — luôn là khung tươi, không lặp khung cũ.
            if (now - lastSub >= frameMs - 1) { this.drawAt(this.time); vtrack.requestFrame!(); lastSub = now; }
          } else {
            this.drawAt(this.time); // chế độ tự lấy mẫu: luôn vẽ để canvas mới nhất
          }
          const pct = Math.max(1, Math.min(99, Math.round(el / total * 100)));
          if (pct !== this.state.exportPct) this.setState({ exportPct: pct });
          if (this._cancelExport || el >= total) {
            this.time = total; this.drawAt(total); if (manual) vtrack.requestFrame!(); // khung cuối trọn vẹn
            resolve(); return;
          }
          this._expRaf = requestAnimationFrame(tick);
        };
        this._expRaf = requestAnimationFrame(tick);
      });
      if (this._expRaf) { cancelAnimationFrame(this._expRaf); this._expRaf = null; }
      try { rec.stop(); } catch { /* */ }
      this.pauseMusic();
      await stopped;
      if (!this._cancelExport && chunks.length) {
        const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mime || "video/webm" });
        const url = URL.createObjectURL(blob);
        const nm = ((this.state.groom || "") + "-" + (this.state.bride || "")).replace(/\s+/g, "").replace(/[^\w-]/g, "") || "wedding";
        const suffix = aspect === "portrait" ? "-doc" : "-ngang";
        const a = document.createElement("a"); a.href = url; a.download = "mstudo-" + nm + suffix + "." + ext; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 6000);
      }
    } catch (e) {
      this.setState({ exportError: "Không xuất được: " + ((e as Error)?.message || e) });
      setTimeout(() => this.setState({ exportError: "" }), 5000);
    }
    this._cancelExport = false;
    this.setState({ exporting: false, exportPct: 0 });
    // Trả canvas về khổ đang xem trước.
    const pv = this.state.portrait;
    this.setSize(pv ? 1080 : 1920, pv ? 1920 : 1080);
    this.syncDuration();
    this.time = 0; this.drawAt(0); this.updateScrub();
  }
  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._expRaf) cancelAnimationFrame(this._expRaf);
    this.stopMusicNodes();
    try { this.state.photos.forEach((p) => URL.revokeObjectURL(p.url)); } catch { /* */ }
    try { if (this.actx) this.actx.close(); } catch { /* */ }
  }
}

// Ngân hàng câu cảm xúc mẫu cho tab Câu chuyện (đa dạng độ dài — ngắn & dài).
const PHRASE_BANK: string[] = [
  "Và họ đã sống hạnh phúc bên nhau.",
  "Mãi mãi bắt đầu từ hôm nay.",
  "Yêu em, hôm nay và mọi ngày sau.",
  "Từ hôm nay, hai ta là một.",
  "Cảm ơn em đã chọn anh.",
  "Nơi nào có em, nơi đó là nhà.",
  "Chuyện tình mình — chương đẹp nhất vừa mở ra.",
  "Anh chọn em, giữa hàng triệu người, và chọn lại mỗi ngày.",
  "Có những người ta gặp một lần rồi thương cả đời — với anh, đó là em.",
  "Hạnh phúc không phải là điểm đến, mà là hành trình mình cùng nhau đi.",
  "Mình sẽ cùng nhau đi qua những mùa nắng mưa, tay trong tay, không rời.",
  "Cảm ơn vì đã đến, đã ở lại, và đã cùng em viết nên câu chuyện của cả hai.",
  "Yêu là khi hai người không nhìn nhau, mà cùng nhìn về một hướng — và mình đã tìm thấy hướng đi ấy.",
  "Từ ánh mắt đầu tiên đến lời hẹn ước hôm nay, mỗi khoảnh khắc bên em đều là điều anh trân trọng nhất.",
  "Ngày hôm nay, trước sự chứng kiến của những người thương yêu, chúng mình chính thức viết tiếp chương mới của cuộc đời.",
  "Cảm ơn ba mẹ hai bên, cảm ơn bạn bè, cảm ơn tất cả đã ở đây cùng chúng con trong ngày trọng đại này.",
  "Không cần điều gì lớn lao, chỉ cần mỗi sáng thức dậy được thấy em cười là đủ.",
  "Mình đã mất cả thanh xuân để tìm nhau, và sẽ dành cả phần đời còn lại để giữ nhau.",
];

// Load the display fonts the canvas uses (Playfair Display + Be Vietnam Pro;
// Cormorant/Manrope already ship with the app) once per page.
function ensureFonts() {
  if (document.getElementById("slide-fonts")) return;
  const l = document.createElement("link");
  l.id = "slide-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,600&family=Be+Vietnam+Pro:wght@500;600;700&display=swap";
  document.head.appendChild(l);
}

export default function SlideStudio() {
  const engRef = useRef<SlideEngine | null>(null);
  const [, force] = useState(0);
  if (!engRef.current) { engRef.current = new SlideEngine(); engRef.current.onChange = () => force((n) => n + 1); }
  const eng = engRef.current;
  const S = eng.state;
  const storyRef = useRef<HTMLTextAreaElement | null>(null);
  const [sugg, setSugg] = useState<string[]>([]);
  const [lib, setLib] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const [exportMenu, setExportMenu] = useState(false);
  // Bộ chọn ảnh cho slide đang xem: { mode:"add"|"swap", idx } — mở lưới thư viện ảnh.
  const [picker, setPicker] = useState<{ mode: "add" | "swap"; idx: number } | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem("slide_phrases"); if (raw) setLib(JSON.parse(raw)); } catch { /* */ }
  }, []);
  const saveLib = (next: string[]) => { setLib(next); try { localStorage.setItem("slide_phrases", JSON.stringify(next)); } catch { /* */ } };

  // Sinh 1 câu gợi ý mới, khác các câu đã hiện (ưu tiên chưa dùng; xen ngắn/dài).
  function genSuggestion() {
    const used = new Set([...sugg, ...lib]);
    const pool = PHRASE_BANK.filter((s) => !used.has(s));
    const src = pool.length ? pool : PHRASE_BANK.filter((s) => s !== sugg[0]);
    const pick = src[Math.floor(Math.random() * src.length)] || PHRASE_BANK[0];
    setSugg((s) => [pick, ...s]);
  }
  // Thêm một câu vào ô câu chuyện (mỗi câu là 1 đoạn — cách nhau dòng trống).
  function appendStory(text: string) {
    const cur = (storyRef.current?.value ?? eng.state.story ?? "").trim();
    const next = cur ? cur + "\n\n" + text : text;
    if (storyRef.current) storyRef.current.value = next;
    eng.setField("story", next);
  }
  function saveOwn() {
    const t = own.trim(); if (!t || lib.includes(t)) { setOwn(""); return; }
    saveLib([t, ...lib]); setOwn("");
  }

  useEffect(() => {
    ensureFonts();
    const fams = ["Playfair Display", "Cormorant Garamond", "Be Vietnam Pro", "Manrope"];
    if (document.fonts?.load) {
      Promise.all(fams.flatMap((f) => [document.fonts.load(`600 40px "${f}"`), document.fonts.load(`italic 600 40px "${f}"`)])).then(() => eng.rebuild()).catch(() => {});
    }
    eng.rebuild();
    return () => eng.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const green = "#1f9d63";
  const TABS = [["photos", "1", "Ảnh"], ["info", "2", "Thông tin"], ["story", "3", "Câu chuyện"], ["music", "4", "Nhạc"], ["style", "5", "Phong cách"]] as const;
  const MUSIC = [["none", "Không nhạc", "Chỉ hình ảnh, không âm thanh"], ["piano", "Piano nhẹ", "Nhẹ nhàng, du dương (mẫu)"], ["strings", "Dây đàn ấm", "Sâu lắng, tình cảm (mẫu)"], ["upload", "Nhạc của bạn", "Dùng file bạn đã tải lên"]] as const;
  const qn = eng.quotesNow().length;
  // Nhãn tiếng Việt cho từng loại bố cục (hiển thị ở bảng chỉnh slide).
  const LAYOUT_LABEL: Record<string, string> = {
    FULL: "Full màn hình", FULLB: "Full viền", PANO: "Toàn cảnh", FRAME: "Khung ảnh", POLAROID: "Polaroid",
    DUO: "2 ảnh ngang", DUOV: "2 ảnh dọc", TRIPLE: "3 ảnh", TRIPLE_R: "3 ảnh (ngược)", BANDS: "3 băng", TRIO: "3 cột",
    QUAD: "4 ảnh", QUADL: "4 ảnh (1 lớn)", QUINT: "5 ảnh", HEX: "6 ảnh",
    TITLE: "Bìa mở đầu", OUTRO: "Lời kết", QUOTE: "Câu chữ", SPLIT: "Chữ + ảnh",
  };
  // Slide đang xem (theo con trỏ thời gian) để chỉnh ảnh / bố cục riêng.
  const curIdx = eng.plan.length ? eng.curIndex() : -1;
  const curSlide = curIdx >= 0 ? eng.plan[curIdx] : null;
  const curIsGrid = eng.isPhotoGrid(curSlide);
  const curHasPhotos = !!curSlide && curSlide.photos.length > 0;
  const applyPick = (photoId: string) => {
    if (!picker) return;
    if (picker.mode === "add") eng.addPhotoToSlide(photoId);
    else eng.replaceSlidePhoto(picker.idx, photoId);
    setPicker(null);
  };
  const inp: React.CSSProperties = { width: "100%", height: 42, padding: "0 14px", border: "1px solid #e2dccf", borderRadius: 10, fontSize: 14, background: "#faf8f3", color: "#26241f" };
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: "#6a6459" };

  return (
    <div className="lg:h-[calc(100vh-120px)]" style={{ minHeight: 520, display: "flex", flexDirection: "column", background: "#e9e5dd", color: "#26241f", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
      {/* Header */}
      <header style={{ height: 60, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "#fffdf9", borderBottom: "1px solid #e7e2d9" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Video slide ảnh cưới</div>
          <div style={{ fontSize: 12, color: "#8a8378" }}>Tự động tạo từ ảnh của bạn · mstudo</div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setExportMenu((v) => !v)} style={{ height: 40, padding: "0 18px", border: "none", borderRadius: 10, background: green, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 18px rgba(31,157,99,.3)" }}>↓ Xuất video ▾</button>
          {exportMenu && (
            <>
              <div onClick={() => setExportMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", right: 0, top: 46, zIndex: 41, width: 230, background: "#fffdf9", border: "1px solid #e7e2d9", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.18)", overflow: "hidden" }}>
                <button onClick={() => { setExportMenu(false); eng.exportVideo("landscape"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 40, height: 24, borderRadius: 4, background: green, flex: "none" }} />
                  <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#26241f" }}>Video ngang</span><span style={{ fontSize: 12, color: "#8a8378" }}>16:9 · YouTube, TV, màn chiếu</span></span>
                </button>
                <div style={{ height: 1, background: "#efe9df" }} />
                <button onClick={() => { setExportMenu(false); eng.exportVideo("portrait"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 24, height: 40, borderRadius: 4, background: green, flex: "none" }} />
                  <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#26241f" }}>Video dọc</span><span style={{ fontSize: 12, color: "#8a8378" }}>9:16 · Reels, TikTok, Story</span></span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row" style={{ flex: 1, minHeight: 0 }}>
        {/* Controls */}
        <aside className="w-full lg:w-[400px] lg:flex-none" style={{ background: "#fffdf9", borderRight: "1px solid #e7e2d9", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: "none", display: "flex", gap: 2, padding: "10px 10px 0", borderBottom: "1px solid #efe9df" }}>
            {TABS.map(([id, num, label]) => (
              <button key={id} onClick={() => eng.go(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 2px 12px", border: "none", borderBottom: S.tab === id ? `2px solid ${green}` : "2px solid transparent", background: "transparent", cursor: "pointer", color: S.tab === id ? green : "#9a9488", fontSize: 11, fontWeight: 700 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: S.tab === id ? green : "#ece7de", color: S.tab === id ? "#fff" : "#9a9488" }}>{num}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {S.tab === "photos" && (
              <div>
                <label onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files) eng.addFiles(e.dataTransfer.files); }} onDragOver={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "30px 20px", border: "2px dashed #d8d0c3", borderRadius: 14, cursor: "pointer", textAlign: "center", background: "#faf8f3" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Kéo thả ảnh vào đây</div>
                  <div style={{ fontSize: 12.5, color: "#8a8378" }}>hoặc bấm để chọn nhiều ảnh · JPG, PNG</div>
                  <input type="file" accept="image/*" multiple onChange={(e) => { eng.addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
                </label>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#6a6459" }}>{S.photos.length ? `${S.photos.length} ảnh` : "Chưa có ảnh"}</span>
                  <span style={{ fontSize: 12, color: "#a49d90" }}>Kéo để sắp xếp lại</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {S.photos.map((ph, i) => (
                    <div key={ph.id} draggable onDragStart={() => { eng._drag = ph.id; }} onDragOver={(e) => e.preventDefault()} onDrop={() => eng.reorderPhotos(eng._drag, ph.id)} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#eae5dc", cursor: "grab" }}>
                      <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
                      <span style={{ position: "absolute", left: 5, top: 5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 6, background: "rgba(20,18,15,.72)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <button onClick={() => eng.removePhoto(ph.id)} style={{ position: "absolute", right: 5, top: 5, width: 20, height: 20, border: "none", borderRadius: 6, background: "rgba(20,18,15,.72)", color: "#fff", fontSize: 13, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {S.tab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div><div style={lbl}>Tên chú rể</div><input onChange={(e) => eng.setField("groom", e.target.value)} defaultValue={S.groom} placeholder="VD: Hoàng Phú" style={inp} /></div>
                <div><div style={lbl}>Tên cô dâu</div><input onChange={(e) => eng.setField("bride", e.target.value)} defaultValue={S.bride} placeholder="VD: Bảo Hân" style={inp} /></div>
                <div><div style={lbl}>Ngày cưới</div><input onChange={(e) => eng.setField("date", e.target.value)} defaultValue={S.date} placeholder="VD: 20 · 12 · 2025" style={inp} /></div>
                <div><div style={lbl}>Câu mở đầu (không bắt buộc)</div><input onChange={(e) => eng.setField("eyebrow", e.target.value)} defaultValue={S.eyebrow} placeholder="VD: LỄ THÀNH HÔN" style={inp} /></div>
              </div>
            )}
            {S.tab === "story" && (
              <div>
                <div style={lbl}>Lời nhắn · câu chuyện · cảm nghĩ</div>
                <textarea ref={storyRef} onChange={(e) => eng.setField("story", e.target.value)} defaultValue={S.story} placeholder={"Viết những dòng cảm xúc của bạn...\n\nMỗi đoạn cách nhau một dòng trống sẽ thành một slide chữ riêng."} style={{ ...inp, height: 200, padding: 14, lineHeight: 1.6, resize: "vertical" }} />
                <div style={{ fontSize: 12, color: "#a49d90", marginTop: 8 }}>{S.showText ? (qn ? `${qn} slide chữ sẽ được tạo từ câu chuyện` : "Chưa có nội dung — cách đoạn bằng một dòng trống") : "Đang tắt slide chữ (bật lại ở tab Phong cách)"}</div>

                {/* Tạo gợi ý câu cảm xúc */}
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={lbl}>Gợi ý câu cảm xúc</span>
                  <button onClick={genSuggestion} style={{ height: 32, padding: "0 12px", border: "none", borderRadius: 8, background: green, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✨ Tạo gợi ý</button>
                </div>
                {sugg.length === 0 && <p style={{ fontSize: 12, color: "#a49d90", marginTop: 6 }}>Bấm “Tạo gợi ý” để sinh câu mẫu — mỗi lần một câu mới, câu cũ vẫn giữ lại.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {sugg.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #e2dccf", borderRadius: 10, background: "#faf8f3" }}>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{s}</span>
                      <button onClick={() => appendStory(s)} title="Thêm vào câu chuyện" style={{ flex: "none", height: 28, padding: "0 10px", border: `1px solid ${green}`, borderRadius: 8, background: "#fff", color: green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Thêm</button>
                    </div>
                  ))}
                </div>

                {/* Thư viện câu của bạn (lưu để dùng lần sau) */}
                <div style={{ marginTop: 18 }}><span style={lbl}>Thư viện câu của bạn</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={own} onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveOwn(); }} placeholder="Nhập câu của riêng bạn rồi lưu lại…" style={{ ...inp, flex: 1 }} />
                  <button onClick={saveOwn} disabled={!own.trim()} style={{ flex: "none", height: 42, padding: "0 14px", border: "1px solid #e2dccf", borderRadius: 10, background: "#fff", fontSize: 13, fontWeight: 700, color: "#6a6459", cursor: "pointer", opacity: own.trim() ? 1 : 0.5 }}>Lưu</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {lib.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #e2dccf", borderRadius: 10, background: "#fff" }}>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{s}</span>
                      <button onClick={() => appendStory(s)} style={{ flex: "none", height: 28, padding: "0 10px", border: `1px solid ${green}`, borderRadius: 8, background: "#fff", color: green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Thêm</button>
                      <button onClick={() => saveLib(lib.filter((_, j) => j !== i))} title="Xoá" style={{ flex: "none", width: 28, height: 28, border: "1px solid #e2dccf", borderRadius: 8, background: "#fff", color: "#b06a6a", fontSize: 14, cursor: "pointer", padding: 0 }}>×</button>
                    </div>
                  ))}
                  {lib.length === 0 && <p style={{ fontSize: 12, color: "#a49d90" }}>Chưa có câu nào — lưu câu bạn thích để dùng cho các video sau.</p>}
                </div>
              </div>
            )}
            {S.tab === "music" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {MUSIC.map(([id, label, desc]) => (
                  <button key={id} onClick={() => eng.selectMusic(id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: S.music === id ? `1.5px solid ${green}` : "1px solid #e2dccf", borderRadius: 10, background: S.music === id ? "#f0f8f3" : "#faf8f3", cursor: "pointer" }}>
                    <div style={{ textAlign: "left" }}><div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div><div style={{ fontSize: 12, color: "#8a8378", marginTop: 1 }}>{desc}</div></div>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", border: S.music === id ? `5px solid ${green}` : "2px solid #cfc8bb", background: "#fff", flex: "none" }} />
                  </button>
                ))}
                <label style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px dashed #d8d0c3", borderRadius: 10, cursor: "pointer", background: "#faf8f3" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#6a6459" }}>{S.audioName ? `Đã chọn: ${S.audioName}` : "Tải file nhạc của bạn lên"}</span>
                  <input type="file" accept="audio/*" onChange={(e) => { eng.setAudioFile(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                </label>
                <div style={{ fontSize: 12, color: "#a49d90", marginTop: 2 }}>Nhạc sẽ được ghép vào file video khi xuất.</div>
              </div>
            )}
            {S.tab === "style" && (
              <div>
                <div style={{ ...lbl, marginBottom: 10 }}>Phong cách</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {Object.entries(THEMES).map(([id, t]) => (
                    <button key={id} onClick={() => eng.selectTheme(id)} style={{ padding: 8, border: S.theme === id ? `2px solid ${green}` : "1px solid #e2dccf", borderRadius: 12, background: S.theme === id ? "#f0f8f3" : "#fff", cursor: "pointer" }}>
                      <div style={{ height: 54, borderRadius: 8, background: `linear-gradient(120deg, ${t.c1} 62%, ${t.c2} 62%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: `"${t.title}"`, fontStyle: t.titleItalic ? "italic" : "normal", fontSize: 26, fontWeight: 600, color: t.ink }}>Aa</span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8, textAlign: "left" }}>{t.name}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#6a6459", marginBottom: 10 }}><span>Thời lượng mỗi ảnh</span><span style={{ color: green }}>{S.perPhoto.toFixed(1)} giây</span></div>
                  <input type="range" min={2} max={6} step={0.2} defaultValue={S.perPhoto} onChange={(e) => eng.setField("perPhoto", parseFloat(e.target.value))} style={{ width: "100%", accentColor: green }} />
                </div>
                <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                  {([["diverse", "Hiệu ứng chuyển cảnh đa dạng"], ["showText", "Chèn slide chữ / câu chuyện"]] as const).map(([k, label]) => {
                    const on = S[k] as boolean;
                    return (
                      <button key={k} onClick={() => eng.setField(k, !on as never)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #e2dccf", borderRadius: 10, background: "#faf8f3", cursor: "pointer", width: "100%" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                        <span style={{ width: 40, height: 23, borderRadius: 999, background: on ? green : "#d5cfc4", flex: "none", position: "relative", transition: "background .15s" }}><span style={{ position: "absolute", top: 2, left: on ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Preview */}
        <main className="min-h-[320px]" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "#1a1a1e" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, minHeight: 0 }}>
            <div style={{ ...(S.portrait ? { height: "100%", maxHeight: 820, aspectRatio: "9 / 16" } : { width: "100%", maxWidth: 1120, aspectRatio: "16 / 9" }), background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.5)", position: "relative" }}>
              <canvas width={1920} height={1080} ref={(el) => { if (el && el !== eng.canvas) { eng.canvas = el; eng.ctx = el.getContext("2d"); eng.rebuild(); } }} style={{ width: "100%", height: "100%", display: "block" }} />
              <div style={{ position: "absolute", left: 14, top: 12, display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.42)", padding: "4px 10px", borderRadius: 999 }}>Xem trước · {S.portrait ? "9:16 dọc" : "16:9 ngang"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,.42)", padding: "4px 10px", borderRadius: 999 }}>{S.slideCount} cảnh</span>
              </div>
              <div style={{ position: "absolute", right: 14, top: 12, display: "flex", gap: 6 }}>
                {([["landscape", "Ngang"], ["portrait", "Dọc"]] as const).map(([id, label]) => {
                  const on = S.portrait === (id === "portrait");
                  return (
                    <button key={id} onClick={() => eng.setAspect(id === "portrait")} title={id === "portrait" ? "Xem & chỉnh riêng khổ dọc 9:16 — không ảnh hưởng khổ ngang" : "Xem & chỉnh khổ ngang 16:9"} style={{ height: 26, padding: "0 12px", border: "none", borderRadius: 999, background: on ? green : "rgba(0,0,0,.42)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Bảng chỉnh RIÊNG slide đang xem: thêm / đổi / xoá ảnh + chọn bố cục */}
          {curHasPhotos && (
            <div style={{ flex: "none", padding: "12px 24px 0" }}>
              <div style={{ background: "#232329", border: "1px solid #34343b", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#e6e2da" }}>
                    Cảnh {curIdx + 1}/{S.slideCount} · <span style={{ color: green }}>{LAYOUT_LABEL[curSlide!.type] || curSlide!.type}</span>
                  </span>
                  {/* Dải ảnh của slide: bấm để đổi, × để xoá bớt, ＋ để thêm */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {curSlide!.photos.map((ph, i) => (
                      <div key={ph.id + "-" + i} style={{ position: "relative", width: 46, height: 46, borderRadius: 8, overflow: "hidden", background: "#111", border: "1px solid #44444c" }}>
                        <img src={ph.url} alt="" onClick={() => setPicker({ mode: "swap", idx: i })} title="Đổi ảnh này" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }} />
                        {curIsGrid && curSlide!.photos.length > 1 && (
                          <button onClick={() => eng.removeSlidePhoto(i)} title="Xoá ảnh khỏi cảnh" style={{ position: "absolute", right: 2, top: 2, width: 17, height: 17, border: "none", borderRadius: 5, background: "rgba(15,15,18,.8)", color: "#fff", fontSize: 12, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
                        )}
                      </div>
                    ))}
                    {curIsGrid && curSlide!.photos.length < 6 && (
                      <button onClick={() => setPicker({ mode: "add", idx: -1 })} title="Thêm ảnh vào cảnh" style={{ width: 46, height: 46, flex: "none", border: "1.5px dashed #4c4c55", borderRadius: 8, background: "transparent", color: "#b7b2a9", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>＋</button>
                    )}
                  </div>
                </div>
                {/* Chọn bố cục cho slide ảnh (gồm Full viền) */}
                {curIsGrid && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#9a958c", marginRight: 2 }}>Bố cục:</span>
                    {eng.layoutsFor(curSlide!.photos.length).map((t) => {
                      const on = curSlide!.type === t;
                      return (
                        <button key={t} onClick={() => eng.setSlideLayout(t)} style={{ height: 28, padding: "0 12px", border: on ? `1.5px solid ${green}` : "1px solid #3f3f46", borderRadius: 999, background: on ? "rgba(31,157,99,.16)" : "transparent", color: on ? "#8fe4b8" : "#cfcbc4", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{LAYOUT_LABEL[t] || t}</button>
                      );
                    })}
                  </div>
                )}
                {!curIsGrid && (
                  <div style={{ fontSize: 11.5, color: "#9a958c", marginTop: 8 }}>
                    {curSlide!.type === "TITLE" ? "Bấm ảnh để đổi ảnh bìa." : "Cảnh chữ + ảnh — bấm ảnh để đổi ảnh minh hoạ."}
                  </div>
                )}
              </div>
            </div>
          )}
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "14px 24px 20px" }}>
            <button onClick={() => eng.togglePlay()} style={{ width: 44, height: 44, flex: "none", border: "none", borderRadius: "50%", background: green, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(31,157,99,.35)" }}>{S.playing ? "❚❚" : "▶"}</button>
            <span ref={(el) => { eng.timeLabel = el; }} style={{ fontSize: 12.5, color: "#cfcbc4", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>0:00</span>
            <input type="range" min={0} max={100} step={0.05} defaultValue={0} ref={(el) => { eng.scrubber = el; if (el) el.max = String(eng.total || 100); }} onChange={(e) => eng.onScrub(parseFloat(e.target.value) || 0)} style={{ flex: 1, accentColor: green }} />
            <span style={{ fontSize: 12.5, color: "#8f8b84", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>{eng.fmt(S.total)}</span>
            <button onClick={() => eng.regenSlide()} title="Đổi bố cục + hiệu ứng của slide đang xem" style={{ height: 36, padding: "0 14px", border: "1px solid #3a3a40", borderRadius: 9, background: "transparent", color: "#e6e2da", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>↻ Bố cục slide này</button>
          </div>
        </main>
      </div>

      {/* Export overlay */}
      {S.exporting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,15,18,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ width: 380, background: "#fffdf9", borderRadius: 18, padding: 30, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.4)" }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#26241f" }}>Đang xuất video…</div>
            <div style={{ fontSize: 13, color: "#8a8378", marginTop: 6 }}>Giữ tab này mở cho tới khi hoàn tất. Video sẽ tự tải về.</div>
            <div style={{ height: 8, background: "#eee7db", borderRadius: 5, margin: "20px 0 8px", overflow: "hidden" }}><div style={{ width: `${S.exportPct}%`, height: "100%", background: green, borderRadius: 5, transition: "width .2s" }} /></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: green }}>{S.exportPct}%</div>
            <button onClick={() => { eng._cancelExport = true; }} style={{ marginTop: 18, height: 38, padding: "0 18px", border: "1px solid #e2dccf", borderRadius: 9, background: "transparent", fontSize: 13, fontWeight: 600, color: "#6a6459", cursor: "pointer" }}>Hủy</button>
          </div>
        </div>
      )}
      {S.exportError && (
        <div onClick={() => eng.setState({ exportError: "" })} style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "#cc4b4b", color: "#fff", padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 60, cursor: "pointer", maxWidth: 520 }}>{S.exportError}</div>
      )}

      {/* Chọn ảnh từ thư viện để thêm vào / đổi cho slide đang xem */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,15,18,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "82vh", display: "flex", flexDirection: "column", background: "#fffdf9", borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.4)", overflow: "hidden" }}>
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #efe9df" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#26241f" }}>{picker.mode === "add" ? "Thêm ảnh vào cảnh" : "Đổi ảnh"}</div>
              <button onClick={() => setPicker(null)} style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "#f0ece3", color: "#6a6459", fontSize: 16, cursor: "pointer" }}>×</button>
            </div>
            {S.photos.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: "#8a8378" }}>Chưa có ảnh nào trong thư viện — tải ảnh lên ở tab “Ảnh”.</div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                {S.photos.map((ph, i) => (
                  <button key={ph.id} onClick={() => applyPick(ph.id)} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid #e2dccf", background: "#eae5dc", cursor: "pointer", padding: 0 }}>
                    <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <span style={{ position: "absolute", left: 5, top: 5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 6, background: "rgba(20,18,15,.72)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
