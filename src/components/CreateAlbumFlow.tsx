"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Link2,
  Lock,
  ArrowRight,
  Copy,
  Check,
  Eye,
  QrCode,
  Sparkles,
  FolderTree,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { studioUrl } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/client";
import { isFolderLink } from "@/lib/drive";
import { effectivePlan, planAllowsWatermark, type Plan } from "@/lib/plans";
import PlanUsage from "@/components/PlanUsage";

function slugify(s: string) {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "album"}-${Math.random().toString(36).slice(2, 7)}`;
}

const PENDING_KEY = "vk_pending_album";

export default function CreateAlbumFlow({ mode = "selection", studioHost = null }: {
  mode?: "selection" | "delivery";
  /** Domain riêng của studio — link gửi khách phải mang tên miền đó, không phải mstudo.com. */
  studioHost?: string | null;
}) {
  const { t } = useLang();
  const supabase = createClient();
  const isDelivery = mode === "delivery";

  const [name, setName] = useState("");
  const [drives, setDrives] = useState<string[]>([""]);
  const [password, setPassword] = useState("");
  const [max, setMax] = useState("");
  const [watermark, setWatermark] = useState("");
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
      JSON.stringify({ name, drives, password, max, watermark, allowNote })
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
          watermark_enabled: canWatermark && !!watermark.trim(),
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

  return (
    <>
    <PlanUsage />
    <div className="grid gap-[clamp(16px,2vw,24px)] [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
      {/* STEP 1 */}
      <div className="card p-[clamp(20px,3vw,32px)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em]" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            BƯỚC 1
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--gold)" }}>Thông tin album</span>
        </div>
        <h2 className="mb-1.5 font-serif text-3xl font-semibold leading-tight">Link thư mục Drive</h2>
        <p className="mb-5 text-[13.5px] leading-snug" style={{ color: "var(--text2)" }}>
          Dán một hoặc nhiều link Google Drive (folder share công khai, hoặc file ảnh).
        </p>

        <label className="label">Tên album</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Mai & Long · Đám cưới" className="input" />

        <div className="mt-3.5 flex flex-col gap-2.5">
          {drives.map((d, i) => (
            <div key={i} className="relative">
              <Link2 size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text3)" }} />
              <input
                value={d}
                onChange={(e) => setDrives((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={i === 0 ? "https://drive.google.com/drive/folders/..." : "Link Drive bổ sung…"}
                className="input pl-[42px] text-[13.5px]"
              />
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-4">
          <button onClick={() => setDrives((arr) => [...arr, ""])} className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gold)" }}>
            <Plus size={15} /> Thêm link Drive
          </button>
          <button onClick={splitSubfolders} disabled={splitting} className="flex items-center gap-1.5 text-[13px] font-semibold disabled:opacity-50" style={{ color: "var(--gold)" }}>
            <FolderTree size={15} /> {splitting ? "Đang tách…" : "Tách folder con từ link tổng"}
          </button>
        </div>
        {splitMsg && <p className="mt-2 text-[12.5px]" style={{ color: "var(--text2)" }}>{splitMsg}</p>}

        {/* Ở chế độ GIAO KHÁCH (delivery) không có giới hạn chọn ảnh nên ẩn ô
            "số ảnh tối đa" (vốn bị ép null) để không hiện control chết. */}
        <div className={isDelivery ? "mt-[18px]" : "mt-[18px] grid grid-cols-2 gap-3"}>
          <div>
            <label className="label flex items-center gap-1.5">
              <Lock size={12} /> Mật khẩu
            </label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tuỳ chọn" className="input" />
          </div>
          {!isDelivery && (
            <div>
              <label className="label"># Số ảnh tối đa</label>
              <input value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Ví dụ: 50" className="input" />
            </div>
          )}
        </div>

        {canWatermark && (
          <>
            <label className="label mt-4">Watermark</label>
            <input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="Tên studio" className="input" />
          </>
        )}

        {/* Ghi chú trên ảnh chỉ có nghĩa ở album CHỌN ẢNH, không áp dụng khi giao khách. */}
        {!isDelivery && (
        <div className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)", opacity: canNotes ? 1 : 0.55 }}>
          <span className="flex-1 text-[13.5px]">
            Cho phép ghi chú trên ảnh {!canNotes && <span style={{ color: "var(--text3)" }}>· nâng cấp để bật 🔒</span>}
          </span>
          <button
            onClick={() => canNotes && setAllowNote((v) => !v)}
            disabled={!canNotes}
            className="relative h-[26px] w-[46px] flex-shrink-0 rounded-full transition-all disabled:cursor-not-allowed"
            style={allowNote ? { background: "var(--gold)" } : { background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <span
              className="absolute top-[3px] h-5 w-5 rounded-full transition-all"
              style={allowNote ? { left: "23px", background: "#0a0a0c" } : { left: "3px", background: "var(--text2)" }}
            />
          </button>
        </div>
        )}

        <div className="mt-3 flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)", opacity: canZip ? 1 : 0.55 }}>
          <span className="flex-1 text-[13.5px]">
            Cho phép khách tải ảnh xuống {!canZip && <span style={{ color: "var(--text3)" }}>· nâng cấp để bật 🔒</span>}
          </span>
          <button
            onClick={() => canZip && setAllowDownload((v) => !v)}
            disabled={!canZip}
            className="relative h-[26px] w-[46px] flex-shrink-0 rounded-full transition-all disabled:cursor-not-allowed"
            style={allowDownload ? { background: "var(--gold)" } : { background: "var(--surface)", border: "1px solid var(--border2)" }}
          >
            <span className="absolute top-[3px] h-5 w-5 rounded-full transition-all" style={allowDownload ? { left: "23px", background: "#0a0a0c" } : { left: "3px", background: "var(--text2)" }} />
          </button>
        </div>

        {notice && <p className="mt-4 text-sm" style={{ color: "var(--gold)" }}>{notice}</p>}
        {error && <p className="mt-4 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

        <button onClick={create} disabled={busy} className="btn-primary mt-5 w-full rounded-xl py-3.5 text-[15px]">
          {createLabel}
          <ArrowRight size={16} />
        </button>
        {loggedIn === false && (
          <p className="mt-2.5 text-center text-[12px]" style={{ color: "var(--text3)" }}>
            Cần đăng nhập Google để tạo &amp; quản lý album.
          </p>
        )}
      </div>

      {/* STEP 2 */}
      <div className="card p-[clamp(20px,3vw,32px)]">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em]" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            BƯỚC 2
          </span>
          <span className="text-[12.5px]" style={{ color: "var(--gold)" }}>Gửi cho khách</span>
        </div>
        <h2 className="mb-1.5 font-serif text-3xl font-semibold leading-tight">Link gửi khách</h2>
        <p className="mb-5 text-[13.5px] leading-snug" style={{ color: "var(--text2)" }}>
          Copy link hoặc tải mã QR gửi qua Zalo / Email / in vào thiệp.
        </p>

        <div className="flex gap-2.5">
          <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl px-4 py-3.5 text-[13px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: result ? "var(--text)" : "var(--text3)" }}>
            {result ? shareLink : "Tạo album ở Bước 1 để hiện link"}
          </div>
          <button
            onClick={copyLink}
            disabled={!result}
            aria-label="Sao chép link"
            className="flex w-[50px] flex-shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40"
            style={copied ? { background: "var(--gold)", color: "#0a0a0c" } : { background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)" }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {warn && (
          <p className="mt-3.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed" style={{ background: "color-mix(in srgb, var(--gold) 12%, transparent)", color: "var(--gold)" }}>
            {warn}
          </p>
        )}

        <div className="mt-[18px] flex aspect-square max-h-[330px] flex-col items-center justify-center gap-4 rounded-2xl p-5" style={{ border: "1px dashed var(--border2)", background: "var(--surface2)" }}>
          {qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Mã QR mở album của khách" className="rounded-xl bg-white p-3" width={180} height={180} />
              <span className="text-[12.5px]" style={{ color: "var(--text2)" }}>
                Quét để mở trang chọn ảnh{result?.count ? ` · ${result.count} ảnh` : ""}
              </span>
            </>
          ) : (
            <>
              <QrCode size={72} strokeWidth={1.3} style={{ color: "var(--text3)" }} />
              <span className="text-[13px]" style={{ color: "var(--text3)" }}>Mã QR sẽ hiện sau khi tạo</span>
            </>
          )}
        </div>

        {result && (
          <div className="mt-3.5 flex flex-col gap-2.5">
            <Link href={shareLink || `/a/${result.slug}`} target="_blank" className="btn-ghost w-full rounded-xl py-3.5 text-sm">
              <Eye size={16} /> Xem thử trang khách sẽ thấy
            </Link>
            <Link href={`/dashboard/albums/${result.id}`} className="text-center text-[13px]" style={{ color: "var(--gold)" }}>
              Mở trình chỉnh sửa album →
            </Link>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export function CreateHero({ mode = "selection" }: { mode?: "selection" | "delivery" }) {
  const isDelivery = mode === "delivery";
  return (
    <div className="mb-10 max-w-2xl">
      <div className="mb-5 inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Sparkles size={13} style={{ color: "var(--gold)" }} />
        <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text2)" }}>
          Tạo nhanh từ Google Drive
        </span>
      </div>
      <h1 className="text-[clamp(32px,5vw,56px)] font-bold leading-[0.98] tracking-[-0.02em]">
        {isDelivery ? "Tạo album giao khách" : "Tạo trang chọn ảnh"}
        <span className="block font-serif font-normal italic" style={{ color: "var(--gold)" }}>
          trong vài phút<span className="not-italic" style={{ color: "var(--text)" }}>.</span>
        </span>
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--text2)" }}>
        {isDelivery
          ? "Album ảnh đã hoàn thiện để khách xem và tải về. Dán thư mục Google Drive, đặt khoá nếu cần."
          : "Dán thư mục Google Drive, đặt khoá nếu cần, rồi gửi link hoặc mã QR cho khách."}
      </p>
    </div>
  );
}
