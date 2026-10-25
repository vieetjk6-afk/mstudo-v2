"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAIN_HOST } from "@/lib/hosts";
import type { createClient } from "@/lib/supabase/client";
import type { Site, SiteSeo } from "@/lib/types";
import { compressImage, checkImageFile } from "@/lib/image";
import { uploadImage, dataUrlToBlob } from "@/lib/upload-client";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG cho phần "cài đặt trang" của website studio: tên miền phụ,
   xuất bản / gỡ xuất bản, SEO & ảnh chia sẻ.

   Trước đây nằm thẳng trong CanvasBuilder (trình dựng kéo-thả). Tách ra đây để
   trình dựng (bản cũ lẫn bản mới) và màn tổng quan Website ở giao diện mới gọi
   CÙNG một đường lưu: cùng route /api/site/subdomain, cùng câu ghi bảng sites,
   cùng thông báo. Hai nơi chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Supabase = ReturnType<typeof createClient>;

/** Tình trạng phục vụ của `<sub>.mstudo.com` — khớp HostState ở API. */
export type DomainState = "ready" | "pending" | "conflict" | "manual";
export const DOMAIN_STATE_LABEL: Record<DomainState, string> = {
  ready: "Tên miền đã chạy",
  pending: "Đang chờ DNS xác minh",
  conflict: "Tên miền đang thuộc project Vercel khác",
  manual: "Máy chủ chưa nối API Vercel — cần thêm domain thủ công",
};
export const DOMAIN_STATE_COLOR: Record<DomainState, string> = {
  ready: "var(--success, #3E6F63)",
  pending: "var(--gold, #C9A24B)",
  conflict: "var(--danger, #E0533D)",
  manual: "var(--gold, #C9A24B)",
};

/**
 * Tên miền phụ + xuất bản. `flash` là chỗ hiện thông báo của màn đang dùng
 * (toast của trình dựng, toast của màn tổng quan).
 */
export function useSitePublishing({
  site,
  supabase,
  mainHost,
  canPublish,
  flash,
}: {
  site: Site;
  supabase: Supabase;
  mainHost: string;
  canPublish: boolean;
  flash: (m: string, ms?: number) => void;
}) {
  const [published, setPublished] = useState(site.published);
  const [subdomain, setSubdomain] = useState(site.subdomain ?? "");
  const [savedSub, setSavedSub] = useState(site.subdomain ?? "");
  const [savingDomain, setSavingDomain] = useState(false);
  // Host đã phục vụ được chưa (do /api/site/subdomain trả về). null = chưa hỏi.
  const [domainState, setDomainState] = useState<DomainState | null>(null);
  const [busy, setBusy] = useState(false);
  // flash của màn gọi có thể là hàm mới mỗi lượt vẽ; giữ bản mới nhất trong ref
  // để checkDomainStatus vẫn gắn đúng một lần như trước.
  const flashRef = useRef(flash);
  flashRef.current = flash;

  /**
   * Lưu tên miền phụ QUA API chứ không ghi thẳng bảng `sites` như trước.
   *
   * Ghi thẳng thì database có dòng mới nhưng Vercel vẫn chưa biết có host mới,
   * nên `<sub>.mstudo.com` chỉ chạy khi project tình cờ đã có wildcard
   * `*.mstudo.com`. Route /api/site/subdomain lưu xong sẽ đăng ký host trên
   * Vercel và trả về tình trạng thật, nên studio biết ngay trang đã chạy chưa —
   * và nếu chưa thì vướng ở đâu.
   *
   * Trả về { sub, state } của lần lưu này (sub = null khi người dùng xoá trống
   * ô), hoặc undefined khi lưu hỏng — togglePublish() dựa vào đó để dừng lại.
   * Trả kèm `state` chứ không bắt nơi gọi đọc biến domainState: setState của
   * React chưa hiện ra trong cùng một lượt chạy, nên nơi gọi sẽ đọc phải giá
   * trị cũ ngay đúng lúc cần nó nhất (lần xuất bản đầu tiên).
   */
  async function saveSubdomain(value: string): Promise<{ sub: string | null; state: DomainState | null } | undefined> {
    const v = value.trim().toLowerCase();
    // Ô để trống = bỏ tên miền phụ (giữ đúng hành vi cũ), không phải lỗi nhập.
    const body = v ? { action: "set", subdomain: v } : { action: "remove" };
    setSavingDomain(true);
    let d: Record<string, unknown> = {};
    try {
      const res = await fetch("/api/site/subdomain", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      d = await res.json().catch(() => ({}));
      if (!res.ok) { flash((d.hint as string) || "Không lưu được tên miền, thử lại."); return undefined; }
    } catch {
      flash("Mất kết nối — chưa lưu được tên miền.");
      return undefined;
    } finally {
      setSavingDomain(false);
    }
    const saved = (d.subdomain as string | null) ?? null;
    const state = (d.state as DomainState) ?? null;
    setSubdomain(saved ?? "");
    setSavedSub(saved ?? "");
    setDomainState(state);
    if (!saved) { flash("Đã bỏ tên miền phụ."); return { sub: null, state }; }
    // "ready" + đã xuất bản là trường hợp không có gì phải nói thêm; mọi trạng
    // thái khác đều kèm hint giải thích vì sao trang chưa mở được.
    flash((d.hint as string) || "Đã lưu tên miền.", d.blocker === "ready" ? 2200 : 6500);
    return { sub: saved, state };
  }

  async function saveDomain() {
    await saveSubdomain(subdomain);
  }

  /**
   * Hỏi lại Vercel/DNS xem host đã phục vụ được chưa.
   *
   * `quiet` = lượt hỏi tự động lúc mở trình tạo: chỉ cập nhật chấm tình trạng,
   * không bắn toast và không ép Vercel bỏ bộ nhớ tạm.
   */
  const checkDomainStatus = useCallback(async (quiet: boolean) => {
    if (!quiet) setSavingDomain(true);
    try {
      const res = await fetch("/api/site/subdomain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", force: !quiet }),
      });
      const d = await res.json().catch(() => ({}));
      setDomainState((d.state as DomainState) ?? null);
      if (!quiet) flashRef.current((d.hint as string) || "Chưa kiểm tra được.", 6500);
    } catch {
      if (!quiet) flashRef.current("Mất kết nối — chưa kiểm tra được.");
    } finally {
      if (!quiet) setSavingDomain(false);
    }
  }, []);

  const checkDomain = () => checkDomainStatus(false);

  // Mở trình tạo mà đã có tên miền phụ: hỏi ngay một lượt để chấm tình trạng
  // nói thật, thay vì phải bấm "Kiểm tra" mới biết trang có chạy hay không.
  useEffect(() => {
    if (site.subdomain) checkDomainStatus(true);
  }, [site.subdomain, checkDomainStatus]);

  async function togglePublish() {
    if (!canPublish) return;
    // Auto-save the domain typed in the bar before publishing. Qua API để host
    // được đăng ký luôn — xuất bản mà Vercel chưa nhận host thì link vẫn chết.
    let sub = savedSub;
    let state = domainState;
    if (!published && subdomain.trim().toLowerCase() !== savedSub) {
      const saved = await saveSubdomain(subdomain);
      if (saved === undefined) return; // lưu hỏng — đã báo lý do, đừng xuất bản tiếp
      sub = saved.sub ?? "";
      state = saved.state;
    }
    if (!published && !sub) { flash("Nhập tên miền phụ trước khi xuất bản."); return; }
    setBusy(true);
    const next = !published;
    await supabase.from("sites").update({ published: next, updated_at: new Date().toISOString() }).eq("id", site.id);
    setPublished(next);
    setBusy(false);
    if (!next) { flash("Đã gỡ xuất bản."); return; }
    // Vừa xuất bản: nếu host chưa sẵn sàng thì nói rõ, đừng để studio bấm vào
    // link rồi gặp trang lỗi của Vercel mà tưởng app hỏng.
    if (state && state !== "ready") {
      flash(`Đã xuất bản. ${sub}.${mainHost || MAIN_HOST} chưa phục vụ được — bấm “Kiểm tra” để xem còn vướng gì.`, 6500);
    } else {
      flash("Đã xuất bản trang!");
    }
  }

  return {
    published,
    subdomain,
    setSubdomain,
    savedSub,
    savingDomain,
    domainState,
    busy,
    saveSubdomain,
    saveDomain,
    checkDomain,
    togglePublish,
  };
}

/* ── SEO & ảnh chia sẻ (sites.seo) ─────────────────────────────────────────
   Đây là chữ hiện trên Google và khi dán link vào Facebook/Zalo. Trước đây bảng
   `sites` đã có cột `seo` và generateMetadata đã đọc, chỉ thiếu chỗ nhập. */
export function useSiteSeo({ site, supabase, onFlash }: { site: Site; supabase: Supabase; onFlash: (m: string) => void }) {
  const initial = (site.seo || {}) as SiteSeo;
  const [seo, setSeo] = useState<SiteSeo>(initial);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async (next: SiteSeo) => {
    setSeo(next);
    const { error } = await supabase.from("sites").update({ seo: next, updated_at: new Date().toISOString() }).eq("id", site.id);
    if (error) onFlash(`Chưa lưu được SEO: ${error.message}`);
  }, [site.id, supabase, onFlash]);

  async function pickOg(file: File) {
    const check = checkImageFile(file);
    if (!check.ok) { onFlash(check.error); return; }
    setBusy(true);
    // 1200×630 là khổ ảnh chia sẻ chuẩn của Facebook/Zalo.
    const dataUrl = await compressImage(file, { maxDim: 1200, quality: 0.72, mime: "image/jpeg" });
    let url = dataUrl;
    try { url = await uploadImage(await dataUrlToBlob(dataUrl), { filename: "og.jpg" }); } catch { /* fallback: nhúng data URL */ }
    setBusy(false);
    save({ ...seo, og_image: url });
  }

  const titleLen = (seo.title || "").length;
  const descLen = (seo.description || "").length;

  return { seo, setSeo, busy, save, pickOg, titleLen, descLen };
}
