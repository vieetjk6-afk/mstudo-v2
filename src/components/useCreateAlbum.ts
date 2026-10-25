"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { studioUrl } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/client";
import { isFolderLink } from "@/lib/drive";
import { effectivePlan, planAllowsWatermark, type Plan } from "@/lib/plans";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của luồng tạo album nhanh từ Google Drive (bản cũ
   CreateAlbumFlow — cũng dùng ở trang /start — và bản mới CreateAlbumFlowV2):
   quyền theo gói, giữ form qua đăng nhập Google, tách thư mục con, tạo album
   + nguồn Drive + mật khẩu + đồng bộ, mã QR, chép link.
   ═══════════════════════════════════════════════════════════════════════════ */

function slugify(s: string) {
  const base = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "album"}-${Math.random().toString(36).slice(2, 7)}`;
}

const PENDING_KEY = "vk_pending_album";

export type CreateAlbumProps = {
  mode?: "selection" | "delivery";
  /** Domain riêng của studio — link gửi khách phải mang tên miền đó, không phải mstudo.com. */
  studioHost?: string | null;
};

export function useCreateAlbum({ mode = "selection", studioHost = null }: CreateAlbumProps) {
  const { t } = useLang();
  const supabase = createClient();
  const isDelivery = mode === "delivery";

  const [name, setName] = useState("");
  const [drives, setDrives] = useState<string[]>([""]);
  const [password, setPassword] = useState("");
  const [max, setMax] = useState("");
  const [watermark, setWatermark] = useState("");
  // Đóng dấu chìm là TỰ CHỌN, mặc định TẮT. Trước đây không có cờ này: ô chữ
  // watermark được điền sẵn tên studio, mà điều kiện lưu lại là
  // `!!watermark.trim()`, nên mọi album tạo ở đây đều bật watermark dù studio
  // không chạm vào. Mặc định của CSDL đã là false (migrations/watermark_opt_in.sql)
  // nhưng lệnh INSERT ghi đè thẳng nên mặc định đó không có tác dụng ở đường này.
  const [wmOn, setWmOn] = useState(false);
  const [allowNote, setAllowNote] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  // Plan permissions — free accounts cannot enable download / notes.
  const [canZip, setCanZip] = useState(true);
  // Watermark: chỉ Photographer Plus & Studio (ảnh có watermark không tải thẳng
  // từ Drive được, phải đi qua proxy).
  const [canWatermark, setCanWatermark] = useState(true);
  const [canNotes, setCanNotes] = useState(true);

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);

  async function splitSubfolders() {
    const parent = drives.map((d) => d.trim()).find(Boolean);
    if (!parent) {
      setSplitMsg("Hãy dán link folder tổng ở ô đầu tiên trước.");
      return;
    }
    setSplitting(true);
    setSplitMsg(null);
    const res = await fetch("/api/drive/subfolders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: parent }),
    });
    const data = await res.json();
    setSplitting(false);
    if (data.error) return setSplitMsg(data.error);
    const folders = (data.folders ?? []) as { url: string }[];
    if (folders.length === 0) return setSplitMsg("Không tìm thấy folder con trong link này.");
    setDrives(folders.map((f) => f.url));
    setSplitMsg(`Đã thêm ${folders.length} folder con — mỗi folder sẽ là một tab riêng trong album.`);
  }
  const [result, setResult] = useState<{ slug: string; id: string; count: number } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Link gửi khách: ưu tiên domain riêng của studio; chưa bật website riêng thì
  // mới rơi về host đang mở bảng điều khiển.
  const albumPath = result ? `/a/${result.slug}` : "";
  const shareLink = (() => {
    if (!result) return "";
    const built = studioUrl(studioHost, albumPath);
    if (/^https?:\/\//i.test(built)) return built;
    return `${typeof window !== "undefined" ? window.location.origin : ""}${albumPath}`;
  })();

  // Detect auth + restore a pending form after returning from Google sign-in.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setLoggedIn(!!user);

      if (user) {
        const { data: p } = await supabase.from("profiles").select("can_zip, can_notes, full_name, role, plan, plan_expires_at").eq("id", user.id).maybeSingle();
        // Default the watermark to the studio's OWN name (not a fixed brand).
        const studioName = (p?.full_name ?? "").trim() || "Studio";
        setWatermark((w) => w || studioName);
        if (p) {
          setCanZip(!!p.can_zip);
          setCanNotes(!!p.can_notes);
          setCanWatermark(planAllowsWatermark(effectivePlan(p.plan as Plan, p.plan_expires_at), p.role === "admin"));
          if (!p.can_zip) setAllowDownload(false);
          if (!p.can_notes) setAllowNote(false);
        }
      }

      const pending = window.sessionStorage.getItem(PENDING_KEY);
      if (pending) {
        try {
          const f = JSON.parse(pending);
          setName(f.name ?? "");
          setDrives(f.drives?.length ? f.drives : [""]);
          setPassword(f.password ?? "");
          setMax(f.max ?? "");
          if (f.watermark) setWatermark(f.watermark);
          setWmOn(!!f.wmOn);
          setAllowNote(f.allowNote ?? true);
        } catch {}
        window.sessionStorage.removeItem(PENDING_KEY);
        if (user) setNotice("Đã đăng nhập với Google — bấm “Tạo trang chọn” để hoàn tất.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    // Stash the form so it survives the OAuth round-trip.
    window.sessionStorage.setItem(
      PENDING_KEY,
      // Nhớ cả cờ bật/tắt: studio cố ý bật rồi bị đẩy sang đăng nhập Google mà
      // quay lại thấy tắt thì tưởng hệ thống nuốt mất lựa chọn.
      JSON.stringify({ name, drives, password, max, watermark, wmOn, allowNote })
    );
    const next = window.location.pathname;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  async function create() {
    setError(null);
    setNotice(null);
    setWarn(null);
    if (!name.trim()) {
      setError("Hãy nhập tên album");
      return;
    }
    if (!loggedIn) {
      await signInWithGoogle();
      return;
    }
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        await signInWithGoogle();
        return;
      }

      const slug = slugify(name);
      const { data: album, error: aErr } = await supabase
        .from("albums")
        .insert({
          owner_id: user.id,
          title: name.trim(),
          slug,
          selection_limit: isDelivery ? null : (max ? Number(max) : null),
          watermark_enabled: canWatermark && wmOn && !!watermark.trim(),
          download_enabled: allowDownload,
          watermark_text: watermark.trim() || null,
          phase: isDelivery ? "delivery" : "selection",
          status: "published",
        })
        .select("id, slug")
        .single();
      if (aErr || !album) {
        // Account exists but isn't allowed to create albums yet.
        throw new Error(
          aErr?.message?.includes("row-level security")
            ? "Tài khoản của bạn chưa được cấp quyền tạo album. Liên hệ quản trị viên."
            : aErr?.message ?? "Không tạo được album"
        );
      }

      const links = drives.map((d) => d.trim()).filter(Boolean);
      if (links.length > 0) {
        const rows = links.map((url, i) => ({
          album_id: album.id,
          name: isFolderLink(url) ? `Folder ${i + 1}` : `Nhóm ${i + 1}`,
          drive_url: url,
          kind: isFolderLink(url) ? "folder" : "file",
          stage: isDelivery ? "delivery" : "selection",
          position: i,
        }));
        const { error: sErr } = await supabase.from("album_sources").insert(rows);
        if (sErr) throw new Error(sErr.message);
      }

      if (password.trim()) {
        await fetch(`/api/albums/${album.id}/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
      }

      let count = 0;
      if (links.length > 0) {
        const syncRes = await fetch(`/api/albums/${album.id}/sync`, { method: "POST" });
        const syncData = await syncRes.json().catch(() => ({}));
        count = syncData.total ?? 0;
        if (count === 0) {
          const detail = syncData.error || (syncData.errors || []).join("; ");
          setWarn(
            "Album đã tạo nhưng chưa lấy được ảnh nào từ Drive. Hãy kiểm tra: thư mục đã chia sẻ ở chế độ “Anyone with the link”, và link là link THƯ MỤC Drive." +
              (detail ? ` (Chi tiết: ${detail})` : "")
          );
        }
      }

      const built = studioUrl(studioHost, `/a/${album.slug}`);
      const link = /^https?:\/\//i.test(built) ? built : `${window.location.origin}/a/${album.slug}`;
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(link, {
        margin: 1,
        width: 320,
        color: { dark: "#0a0a0c", light: "#ffffff" },
      });
      setQr(dataUrl);
      setResult({ slug: album.slug, id: album.id, count });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const createLabel = busy
    ? "Đang tạo…"
    : loggedIn === false
    ? "Đăng nhập Google & tạo"
    : "Tạo trang chọn";


  return {
    isDelivery,
    name, setName, drives, setDrives, password, setPassword, max, setMax, watermark, setWatermark, wmOn, setWmOn,
    allowNote, setAllowNote, allowDownload, setAllowDownload, canZip, canWatermark, canNotes,
    loggedIn, busy, error, notice, warn, splitting, splitMsg, splitSubfolders,
    result, qr, copied, shareLink, create, copyLink, createLabel,
  };
}
