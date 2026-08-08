"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Link2,
  ListChecks,
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  Check,
  Search,
  HardDrive,
  FolderInput,
  FolderOutput,
  CopyCheck,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import { buildZip, triggerDownload } from "@/lib/download";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SourceFile {
  key: string;
  name: string;
  driveId?: string;
  file?: File;
  handle?: any; // FileSystemFileHandle
}

const norm = (s: string) => stripExtension(s).trim().toLowerCase();
const ext = (n: string) => (n.includes(".") ? n.split(".").pop()!.toLowerCase() : "");
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "tif", "tiff", "bmp", "avif"]);
const RAW_EXTS = new Set(["cr2", "cr3", "nef", "nrw", "arw", "sr2", "srf", "raf", "rw2", "orf", "dng", "pef", "srw", "raw", "3fr", "fff", "iiq", "rwl", "mrw", "mef", "mos", "erf", "kdc", "dcr", "x3f"]);
// Accepted image/RAW extensions (RAW files often have an empty MIME type).
const IMG_RE =
  /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp|avif|cr2|cr3|nef|nrw|arw|sr2|srf|raf|rw2|orf|dng|pef|srw|raw|3fr|fff|iiq|rwl|mrw|mef|mos|erf|kdc|dcr|x3f)$/i;
// Extensions the browser can render in an <img> for previews.
const DISPLAYABLE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export default function FilterPage() {
  const supabase = createClient();

  const [photoSource, setPhotoSource] = useState<"drive" | "local">("drive");
  const [fsSupported, setFsSupported] = useState(false);

  const [driveUrl, setDriveUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<SourceFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [localFiles, setLocalFiles] = useState<SourceFile[]>([]);
  const [srcDirName, setSrcDirName] = useState("");
  const [destDir, setDestDir] = useState<any>(null);
  const [destName, setDestName] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"paste" | "album">("paste");
  const [pasteText, setPasteText] = useState("");
  const [albums, setAlbums] = useState<{ id: string; title: string }[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [albumNames, setAlbumNames] = useState<string[]>([]);

  const [copied, setCopied] = useState(false);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Monthly filter quota (free = 10/month). One "use" is counted per result set.
  const [filterQuota, setFilterQuota] = useState<
    { unlimited: boolean; limit: number | null; used: number; remaining: number | null } | null
  >(null);
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  const consumedKeyRef = useRef<string>("");

  useEffect(() => {
    setFsSupported(typeof window !== "undefined" && "showDirectoryPicker" in window);
    // Chỉ lấy album CHỌN ẢNH của CHÍNH studio đang đăng nhập:
    //  - eq owner_id: RLS cho admin đọc mọi album, nên phải tự giới hạn theo chủ
    //    sở hữu để admin không thấy danh sách của studio khác.
    //  - eq phase 'selection': album đã chuyển sang giai đoạn GIAO KHÁCH thì
    //    không cần lọc nữa nên ẩn khỏi danh sách.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("albums")
        .select("id, title")
        .eq("owner_id", user.id)
        .eq("is_gallery", false)
        .eq("phase", "selection")
        .order("updated_at", { ascending: false })
        .then(({ data }) => setAlbums(data ?? []));
    });
    fetch("/api/filter/use")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFilterQuota({ unlimited: d.unlimited, limit: d.limit, used: d.used, remaining: d.remaining }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDrive() {
    setLoadingDrive(true);
    setDriveError(null);
    const res = await fetch("/api/drive/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: driveUrl }),
    });
    const data = await res.json();
    setLoadingDrive(false);
    if (data.error) {
      setDriveError(data.error);
      setDriveFiles([]);
      return;
    }
    setDriveFiles((data.files ?? []).map((f: any) => ({ key: f.id, name: f.name, driveId: f.id })));
  }

  // ── Local source (File System Access API) ──────────────────────
  async function pickSourceFS() {
    try {
      const dir = await (window as any).showDirectoryPicker({ id: "vk-src" });
      const files: SourceFile[] = [];
      for await (const entry of dir.values()) {
        if (entry.kind === "file" && IMG_RE.test(entry.name)) {
          files.push({ key: entry.name, name: entry.name, handle: entry });
        }
      }
      setSrcDirName(dir.name);
      setLocalFiles(files);
      setCopyMsg(null);
    } catch {
      /* user cancelled */
    }
  }
  function pickSourceInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => IMG_RE.test(f.name));
    setSrcDirName(`${files.length} ảnh đã chọn`);
    setLocalFiles(files.map((file, i) => ({ key: `${i}-${file.name}`, name: file.name, file })));
  }
  async function pickDest() {
    try {
      const dir = await (window as any).showDirectoryPicker({ id: "vk-dest", mode: "readwrite" });
      setDestDir(dir);
      setDestName(dir.name);
    } catch {
      /* cancelled */
    }
  }

  async function loadAlbum(id: string) {
    setAlbumId(id);
    if (!id) return setAlbumNames([]);
    const { data } = await supabase.from("selections").select("photo_name").eq("album_id", id);
    setAlbumNames([...new Set((data ?? []).map((r) => r.photo_name).filter(Boolean))]);
  }

  const sourceFiles = photoSource === "drive" ? driveFiles : localFiles;

  const wantedNames = useMemo(
    () => (mode === "paste" ? pasteText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) : albumNames),
    [mode, pasteText, albumNames]
  );
  const wantedSet = useMemo(() => new Set(wantedNames.map(norm)), [wantedNames]);
  const matched = useMemo(() => sourceFiles.filter((f) => wantedSet.has(norm(f.name))), [sourceFiles, wantedSet]);
  const matchedNorm = useMemo(() => new Set(matched.map((f) => norm(f.name))), [matched]);

  // Filter matched results by file format (image / RAW / a specific extension).
  const [fmt, setFmt] = useState("all");
  const availableExts = useMemo(
    () => [...new Set(matched.map((m) => ext(m.name)).filter(Boolean))].sort(),
    [matched]
  );
  const shown = useMemo(() => {
    if (fmt === "all") return matched;
    if (fmt === "image") return matched.filter((m) => IMAGE_EXTS.has(ext(m.name)));
    if (fmt === "raw") return matched.filter((m) => RAW_EXTS.has(ext(m.name)));
    return matched.filter((m) => ext(m.name) === fmt);
  }, [matched, fmt]);
  const notFound = useMemo(() => wantedNames.filter((n) => !matchedNorm.has(norm(n))), [wantedNames, matchedNorm]);
  const matchedKey = matched.map((m) => m.key).join("|");

  // Generate previews for matched local files.
  useEffect(() => {
    if (photoSource !== "local") return;
    let cancelled = false;
    const urls: Record<string, string> = {};
    (async () => {
      for (const m of matched.slice(0, 300)) {
        // RAW files can't be rendered by the browser — skip preview, show icon.
        if (!DISPLAYABLE_RE.test(m.name)) continue;
        try {
          const file = m.handle ? await m.handle.getFile() : m.file;
          if (file) urls[m.key] = URL.createObjectURL(file);
        } catch {
          /* skip */
        }
        if (cancelled) break;
      }
      if (!cancelled) setThumbs(urls);
    })();
    return () => {
      cancelled = true;
      Object.values(urls).forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedKey, photoSource]);

  // Count one filter use per result set (server-enforced monthly quota).
  async function ensureFilterUse(): Promise<boolean> {
    if (consumedKeyRef.current && consumedKeyRef.current === matchedKey) return true;
    setFilterMsg(null);
    try {
      const res = await fetch("/api/filter/use", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (d?.limit !== undefined) setFilterQuota({ unlimited: d.unlimited, limit: d.limit, used: d.used, remaining: d.remaining });
      if (res.status === 401) {
        setFilterMsg("Bạn cần đăng nhập để dùng công cụ lọc ảnh.");
        return false;
      }
      if (!res.ok) {
        setFilterMsg(`Tài khoản của bạn chỉ được lọc ${d?.limit ?? 10} lần/tháng và đã dùng hết. Nâng cấp để dùng không giới hạn.`);
        return false;
      }
      consumedKeyRef.current = matchedKey;
      return true;
    } catch {
      setFilterMsg("Không kiểm tra được hạn mức sử dụng.");
      return false;
    }
  }

  async function copyMatched() {
    if (!(await ensureFilterUse())) return;
    navigator.clipboard.writeText(shown.map((f) => stripExtension(f.name)).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function exportMatched() {
    if (!(await ensureFilterUse())) return;
    triggerDownload(
      new Blob([shown.map((f) => stripExtension(f.name)).join("\n")], { type: "text/plain;charset=utf-8" }),
      "loc-anh.txt"
    );
  }
  async function zipMatched() {
    if (shown.length === 0) return;
    if (!(await ensureFilterUse())) return;
    setZipProgress(0);
    if (photoSource === "local") {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const m of shown) {
        const file = m.handle ? await m.handle.getFile() : m.file;
        if (file) zip.file(m.name, file);
      }
      const blob = await zip.generateAsync({ type: "blob" }, (meta) => setZipProgress(Math.round(meta.percent)));
      triggerDownload(blob, "loc-anh.zip");
    } else {
      const blob = await buildZip(
        shown.map((f) => ({ fileId: f.driveId!, name: f.name })),
        { watermark: null, onProgress: (d, tot) => setZipProgress(Math.round((d / tot) * 100)) }
      );
      triggerDownload(blob, "loc-anh.zip");
    }
    setZipProgress(null);
  }

  // Copy matched files directly from source folder to destination folder.
  async function copyToDest() {
    if (!destDir || shown.length === 0) return;
    if (!(await ensureFilterUse())) return;
    setCopying(true);
    setCopyMsg(null);
    let done = 0;
    for (const m of shown) {
      try {
        const file = m.handle ? await m.handle.getFile() : m.file;
        if (!file) continue;
        const fh = await destDir.getFileHandle(m.name, { create: true });
        const w = await fh.createWritable();
        await w.write(file);
        await w.close();
        done++;
        setCopyMsg(`Đang copy… ${done}/${shown.length}`);
      } catch {
        /* skip this file */
      }
    }
    setCopying(false);
    setCopyMsg(`Đã copy ${done}/${shown.length} ảnh sang “${destName}”.`);
  }

  const srcTab = (key: "drive" | "local", label: string, Icon: typeof Link2) => (
    <button
      onClick={() => setPhotoSource(key)}
      className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
      style={photoSource === key ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="page-in">
      {/* Quay lại màn Công cụ ảnh — công cụ này là một trong ba thẻ ở đó. */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <Link
          href="/dashboard/tools"
          aria-label="Về Công cụ ảnh"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          <ArrowLeft size={17} />
        </Link>
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Khách gửi danh sách tên file — công cụ tự tách những ảnh đó ra thư mục riêng.</p>
      </div>

      {/* Ba bước của bản thiết kế: nguồn ảnh → danh sách cần lọc → nơi lưu.
          Kết quả tự cập nhật theo từng bước nên không cần nút "chạy". */}
      <div className="flex max-w-[900px] flex-col gap-3">
        <Step no={1} title="Nguồn ảnh" desc="Thư mục chứa TOÀN BỘ ảnh của buổi chụp — trên Google Drive hoặc ngay trên máy tính.">
          <div className="mb-3 flex gap-2">
            {srcTab("drive", "Google Drive", Link2)}
            {srcTab("local", "Máy tính", HardDrive)}
          </div>

          {photoSource === "drive" ? (
            <>
              <div className="flex gap-2.5">
                <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="input" />
                <button onClick={loadDrive} disabled={loadingDrive || !driveUrl.trim()} className="btn-primary whitespace-nowrap">
                  <Search size={15} /> {loadingDrive ? "Đang tải…" : "Tải ảnh"}
                </button>
              </div>
              {driveError && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{driveError}</p>}
              {driveFiles.length > 0 && (
                <p className="mt-3 text-[13px]" style={{ color: "var(--text2)" }}>Đã tải <b>{driveFiles.length}</b> ảnh từ Drive.</p>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => (fsSupported ? pickSourceFS() : fileInput.current?.click())}
                className="btn-ghost w-full py-3"
              >
                <FolderInput size={16} /> Chọn thư mục nguồn
              </button>
              <input ref={fileInput} type="file" multiple hidden onChange={pickSourceInput} />
              {srcDirName && (
                <p className="mt-2 text-[13px]" style={{ color: "var(--text2)" }}>
                  Nguồn: <b>{srcDirName}</b> · {localFiles.length} ảnh (không upload — xử lý cục bộ).
                </p>
              )}

            </>
          )}
        </Step>

        <Step no={2} title="Danh sách cần lọc" desc="Tên ảnh khách gửi — dán tay, hoặc lấy thẳng từ lượt chọn của một album.">
          <div className="mb-3 flex gap-2">
            <button onClick={() => setMode("paste")} className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={mode === "paste" ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}>
              <ClipboardPaste size={14} /> Tự nhập
            </button>
            <button onClick={() => setMode("album")} className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={mode === "album" ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}>
              <ListChecks size={14} /> Từ lựa chọn khách
            </button>
          </div>

          {mode === "paste" ? (
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"Mỗi dòng một tên ảnh, ví dụ:\nIMG_001\nIMG_045\n(không cần đuôi .jpg)"} className="input min-h-[160px] resize-y" />
          ) : (
            <>
              <select className="input" value={albumId} onChange={(e) => loadAlbum(e.target.value)}>
                <option value="">— Chọn album —</option>
                {albums.map((a) => (<option key={a.id} value={a.id}>{a.title}</option>))}
              </select>
              <p className="mt-3 text-[13px]" style={{ color: "var(--text2)" }}>
                {albumId ? `Khách đã chọn ${albumNames.length} ảnh.` : "Chọn album để lấy danh sách ảnh khách đã chọn."}
              </p>
            </>
          )}
        </Step>

        <Step
          no={3}
          title="Nơi lưu kết quả"
          desc={photoSource === "local" && fsSupported
            ? "Chọn thư mục đích rồi copy thẳng sang — ảnh không rời khỏi máy bạn."
            : "Ảnh khớp danh sách tải về máy dưới dạng file ZIP ở phần kết quả bên dưới."}
        >
          {photoSource === "local" && fsSupported ? (
            <>
              <button onClick={pickDest} className="btn-ghost w-full py-3">
                <FolderOutput size={16} /> Chọn thư mục đích {destName && `· ${destName}`}
              </button>
              <button
                onClick={copyToDest}
                disabled={!destDir || shown.length === 0 || copying}
                className="btn-primary mt-2.5 w-full py-3 disabled:opacity-40"
              >
                <CopyCheck size={16} /> {copying ? "Đang copy…" : `Copy ${shown.length} ảnh sang thư mục đích`}
              </button>
              {copyMsg && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>{copyMsg}</p>}
            </>
          ) : (
            <p className="rounded-[10px] px-3.5 py-3 text-[12.5px] leading-relaxed" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
              {photoSource === "local"
                ? "Trình duyệt này không copy thẳng ra thư mục được — dùng Chrome/Edge trên máy tính, hoặc tải ZIP ở phần kết quả."
                : "Nguồn Drive: bấm “Tải ZIP” ở phần kết quả để lấy đúng những ảnh khớp danh sách."}
            </p>
          )}
        </Step>
      </div>

      {/* Kết quả */}
      <div className="mt-3.5 card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-[14px] font-bold">Kết quả lọc · {shown.length} ảnh</h2>
          {/* Format filter */}
          <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="input w-auto px-2 py-1 text-xs">
            <option value="all">Mọi định dạng</option>
            <option value="image">Ảnh thường (JPG/PNG…)</option>
            <option value="raw">RAW máy ảnh</option>
            {availableExts.map((x) => (
              <option key={x} value={x}>.{x.toUpperCase()}</option>
            ))}
          </select>
          {notFound.length > 0 && (
            <span className="rounded-full px-2.5 py-1 text-[12px]" style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--gold)" }}>
              {notFound.length} tên không tìm thấy
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={copyMatched} disabled={shown.length === 0} className="btn-ghost text-[13px] disabled:opacity-40">
              {copied ? <Check size={14} /> : <Copy size={14} />} Copy (không đuôi)
            </button>
            <button onClick={exportMatched} disabled={shown.length === 0} className="btn-ghost text-[13px] disabled:opacity-40">
              <FileText size={14} /> Xuất .txt
            </button>
            <button onClick={zipMatched} disabled={shown.length === 0 || zipProgress !== null} className="btn-primary text-[13px] disabled:opacity-40">
              <Download size={14} /> {zipProgress !== null ? `${zipProgress}%` : "Tải ZIP"}
            </button>
          </div>
        </div>

        {filterQuota && !filterQuota.unlimited && (
          <p className="mb-3 text-[12.5px]" style={{ color: (filterQuota.remaining ?? 0) <= 0 ? "var(--gold)" : "var(--text3)" }}>
            Lọc ảnh tháng này: <b style={{ color: "var(--text)" }}>{filterQuota.used}/{filterQuota.limit}</b> lần
          </p>
        )}
        {filterMsg && (
          <p className="mb-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: "color-mix(in srgb, var(--gold) 14%, transparent)", color: "var(--gold)" }}>
            {filterMsg}
          </p>
        )}

        {shown.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: "var(--text3)" }}>
            {sourceFiles.length === 0 ? "Chọn nguồn ảnh và nhập danh sách để bắt đầu lọc." : matched.length === 0 ? "Chưa có ảnh nào khớp danh sách." : "Không có file đúng định dạng đã chọn."}
          </p>
        ) : (
          <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fill,minmax(130px,1fr))]">
            {shown.map((f) => (
              <div key={f.key} className="overflow-hidden rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div className="flex aspect-square items-center justify-center" style={{ color: "var(--text3)" }}>
                  {f.driveId || thumbs[f.key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.driveId ? thumbnailUrl(f.driveId, 400) : thumbs[f.key]} alt={f.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <FileText size={28} />
                  )}
                </div>
                <p className="truncate px-2 py-1.5 text-[11px]" style={{ color: "var(--text2)" }} title={f.name}>{stripExtension(f.name)}</p>
              </div>
            ))}
          </div>
        )}

        {notFound.length > 0 && (
          <div className="mt-5 rounded-xl p-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--gold)" }}>Không tìm thấy trong nguồn ảnh ({notFound.length}):</p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text2)" }}>{notFound.join(", ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Một bước trong công cụ lọc — vòng tròn số + tên bước + mô tả, rồi phần điều
 *  khiển. Đúng khối bước của bản thiết kế, xếp dọc cho dễ đi theo thứ tự. */
function Step({ no, title, desc, children }: { no: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] px-[18px] py-4" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <div className="mb-3 flex items-center gap-3.5">
        <span
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold"
          style={{ background: "var(--acS)", color: "var(--ac)" }}
        >
          {no}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
