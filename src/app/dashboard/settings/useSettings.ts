"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của "Cấu hình mstudo" (bản cũ SettingsPanel và bản mới
   SettingsPanelV2): form site_settings, cờ tính năng, lưu, góp ý. Hai bản chỉ
   khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Feedback {
  id: string;
  name: string;
  email: string | null;
  message: string;
  handled: boolean;
  created_at: string;
}

type Flags = Record<string, string>;

/**
 * Cờ tính năng "Sắp ra mắt" — mỗi cờ có cách lưu riêng (giữ y như bản cũ):
 *   • inbox / album / slide / drive_sync / planner: mặc định KHOÁ; mở = "live".
 *   • story: mặc định mở; khoá = "coming_soon", mở = xoá khoá.
 *   • desktop: mặc định ẨN hẳn; xuất bản = "live".
 * `locked` = đang hiện "Sắp ra mắt"/ẩn với studio.
 */
export const FEATURE_FLAGS: {
  key: string;
  label: string;
  desc: string;
  locked: (f: Flags | null | undefined) => boolean;
  apply: (cur: Flags, locked: boolean) => void;
}[] = [
  {
    key: "inbox",
    label: "Hộp thư hợp nhất",
    desc: "Khi còn khoá, chatbox website chạy như cũ và không ghi gì vào hộp thư.",
    locked: (f) => (f?.inbox ?? "coming_soon") !== "live",
    apply: (cur, on) => { cur.inbox = on ? "coming_soon" : "live"; },
  },
  {
    key: "story",
    label: "Love Story",
    desc: "Trang kể chuyện tình yêu của cặp đôi.",
    locked: (f) => f?.story === "coming_soon",
    apply: (cur, on) => { if (on) cur.story = "coming_soon"; else delete cur.story; },
  },
  {
    key: "album",
    label: "Thiết kế Album",
    desc: "Dàn trang album in.",
    locked: (f) => (f?.album ?? "coming_soon") !== "live",
    apply: (cur, on) => { cur.album = on ? "coming_soon" : "live"; },
  },
  {
    key: "slide",
    label: "Slide cưới",
    desc: "Slide chiếu tiệc cưới.",
    locked: (f) => (f?.slide ?? "coming_soon") !== "live",
    apply: (cur, on) => { cur.slide = on ? "coming_soon" : "live"; },
  },
  {
    key: "drive_sync",
    label: "Đồng bộ Drive",
    desc: "Đồng bộ thư mục Google Drive vào album.",
    locked: (f) => (f?.drive_sync ?? "coming_soon") !== "live",
    apply: (cur, on) => { cur.drive_sync = on ? "coming_soon" : "live"; },
  },
  {
    key: "planner",
    label: "Kế hoạch cưới (cổng khách)",
    desc: "Khi còn khoá, khách không thấy trang kế hoạch cưới; hợp đồng của tài khoản admin vẫn dùng được để thử.",
    locked: (f) => (f?.planner ?? "coming_soon") !== "live",
    apply: (cur, on) => { cur.planner = on ? "coming_soon" : "live"; },
  },
  {
    key: "desktop",
    label: "MStudo Desktop",
    desc: "Khi chưa xuất bản thì ẩn hoàn toàn với studio (chỉ admin thấy).",
    locked: (f) => (f?.desktop ?? "") !== "live",
    apply: (cur, on) => { if (on) delete cur.desktop; else cur.desktop = "live"; },
  },
];

/** Gói & giá — mỗi gói 4 cột của site_settings. */
export const PRICE_ROWS = [
  { name: "Basic", m: "price_basic_month", y: "price_basic_year", dm: "basic_discount_month_percent", dy: "basic_discount_year_percent" },
  { name: "Photographer", m: "price_photographer_month", y: "price_photographer_year", dm: "photographer_discount_month_percent", dy: "photographer_discount_year_percent" },
  { name: "Photographer Plus", m: "price_photographer_plus_month", y: "price_photographer_plus_year", dm: "photographer_plus_discount_month_percent", dy: "photographer_plus_discount_year_percent" },
  { name: "Studio", m: "price_studio_month", y: "price_studio_year", dm: "studio_discount_month_percent", dy: "studio_discount_year_percent" },
] as { name: string; m: keyof SiteSettings; y: keyof SiteSettings; dm: keyof SiteSettings; dy: keyof SiteSettings }[];

/** Ô giá: số nguyên ≥ 0. Ô giảm: 0–100. */
export const toPrice = (v: string) => Math.max(0, Math.round(Number(v) || 0));
export const toPercent = (v: string) => Math.max(0, Math.min(100, Number(v) || 0));

export function useSettings(settings: SiteSettings | null, initialFeedbacks: Feedback[]) {
  const [form, setForm] = useState<Partial<SiteSettings>>(settings ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const str = (k: keyof SiteSettings) => ((form[k] ?? "") as string);

  // ── Cờ tính năng ──────────────────────────────────────────────────────────
  const flags = form.feature_flags as Flags | null | undefined;
  const flagLocked = (key: string) => FEATURE_FLAGS.find((x) => x.key === key)!.locked(flags);
  function setFlagLocked(key: string, locked: boolean) {
    const cur = { ...((form.feature_flags as Flags) ?? {}) };
    FEATURE_FLAGS.find((x) => x.key === key)!.apply(cur, locked);
    set("feature_flags" as keyof SiteSettings, cur as never);
  }
  /** Giao diện mới (thử nghiệm) — xem @/lib/ui-version. */
  const uiV2Value = flags?.ui_v2 ?? "admin";
  function setUiV2(v: string) {
    const cur = { ...((form.feature_flags as Flags) ?? {}) };
    if (v === "admin") delete cur.ui_v2; else cur.ui_v2 = v;
    set("feature_flags" as keyof SiteSettings, cur as never);
  }

  // ── Feedback ─────────────────────────────────────────────────────────────
  const [feedbacks, setFeedbacks] = useState<Feedback[]>(initialFeedbacks);
  async function handleFeedback(action: "handled" | "delete", id: string, handled?: boolean) {
    setFeedbacks((r) => action === "delete" ? r.filter((x) => x.id !== id) : r.map((x) => x.id === id ? { ...x, handled: !!handled } : x));
    await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "feedback", action, id, handled }),
    });
  }
  // ── Save ──────────────────────────────────────────────────────────────────
  /** Lưu toàn bộ form. Trả true khi lưu được. */
  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setMsg(res.ok ? "Đã lưu" : "Lỗi");
    setTimeout(() => setMsg(null), 2500);
    return res.ok;
  }

  return {
    form, setForm, set, str, saving, msg, save,
    flagLocked, setFlagLocked, uiV2Value, setUiV2,
    feedbacks, handleFeedback,
  };
}

export type SettingsState = ReturnType<typeof useSettings>;
