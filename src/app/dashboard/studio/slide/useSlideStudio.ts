"use client";

import { useEffect, useRef, useState } from "react";
import { PHRASE_BANK, SlideEngine, ensureFonts } from "./slide-engine";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của Slide cưới (bản cũ SlideStudio và bản mới
   SlideStudioV2): tạo bộ máy dựng video, nạp phông, thư viện câu cảm xúc,
   gợi ý câu, bộ chọn ảnh cho cảnh đang xem. Hai bản chỉ khác cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Năm bước bên bảng điều khiển: [id, số thứ tự, nhãn]. */
export const SLIDE_TABS = [["photos", "1", "Ảnh"], ["info", "2", "Thông tin"], ["story", "3", "Câu chuyện"], ["music", "4", "Nhạc"], ["style", "5", "Phong cách"]] as const;
/** Các lựa chọn nhạc: [id, nhãn, mô tả]. */
export const SLIDE_MUSIC = [["none", "Không nhạc", "Chỉ hình ảnh, không âm thanh"], ["piano", "Piano nhẹ", "Nhẹ nhàng, du dương (mẫu)"], ["strings", "Dây đàn ấm", "Sâu lắng, tình cảm (mẫu)"], ["upload", "Nhạc của bạn", "Dùng file bạn đã tải lên"]] as const;
/** Nhãn tiếng Việt cho từng loại bố cục (hiển thị ở bảng chỉnh slide). */
export const LAYOUT_LABEL: Record<string, string> = {
  FULL: "Full màn hình", FULLB: "Full viền", PANO: "Toàn cảnh", FRAME: "Khung ảnh", POLAROID: "Polaroid",
  DUO: "2 ảnh ngang", DUOV: "2 ảnh dọc", TRIPLE: "3 ảnh", TRIPLE_R: "3 ảnh (ngược)", BANDS: "3 băng", TRIO: "3 cột",
  QUAD: "4 ảnh", QUADL: "4 ảnh (1 lớn)", QUINT: "5 ảnh", HEX: "6 ảnh",
  TITLE: "Bìa mở đầu", OUTRO: "Lời kết", QUOTE: "Câu chữ", SPLIT: "Chữ + ảnh",
};

export function useSlideStudio() {
  const engRef = useRef<SlideEngine | null>(null);
  const [, force] = useState(0);
  if (!engRef.current) { engRef.current = new SlideEngine(); engRef.current.onChange = () => force((n) => n + 1); }
  const eng = engRef.current;
  const S = eng.state;
  const storyRef = useRef<HTMLTextAreaElement | null>(null);
  const [sugg, setSugg] = useState<string[]>([]);
  const [lib, setLib] = useState<string[]>([]);
  const [own, setOwn] = useState("");
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

  const qn = eng.quotesNow().length;
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

  /** Gắn thẻ <canvas> xem trước vào bộ máy (ref callback — dùng chung cả hai bản). */
  const canvasRef = (el: HTMLCanvasElement | null) => { if (el && el !== eng.canvas) { eng.canvas = el; eng.ctx = el.getContext("2d"); eng.rebuild(); } };

  return {
    eng, S, storyRef, sugg, lib, own, setOwn, saveLib, genSuggestion, appendStory, saveOwn,
    picker, setPicker, applyPick, qn, curIdx, curSlide, curIsGrid, curHasPhotos, canvasRef,
  };
}
