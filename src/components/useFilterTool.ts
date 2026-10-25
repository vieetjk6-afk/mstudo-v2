"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { stripExtension } from "@/lib/drive";
import { matchKey } from "@/lib/face-people";
import { triggerDownload } from "@/lib/download";
import { MAX_LOCAL_DEPTH, MAX_LOCAL_FILES, dirDepth, splitWebkitPath, walkLocalDir } from "@/lib/local-walk";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của công cụ Lọc ảnh — bản cũ <FilterTool/> (trang
   /dashboard/filter + popup FilterDialog) và bản mới <FilterToolV2/>. Nguồn
   Drive / thư mục trên máy (File System Access API), luật ghép tên, hạn mức
   lọc, copy sang thư mục đích / Drive, ZIP. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SourceFile {
  key: string;
  name: string;
  /** Thư mục con chứa file, tính từ thư mục gốc đã chọn ("" = ngay thư mục gốc). */
  dir?: string;
  driveId?: string;
  file?: File;
  handle?: any; // FileSystemFileHandle
}

/** Câu tóm tắt nguồn ảnh trên máy — luôn nói rõ đã quét được những gì. */
function localNoteText(dirName: string, count: number, subfolders: number, truncated: boolean): string {
  if (count === 0)
    return subfolders > 0
      ? `Không thấy file ảnh nào trong “${dirName}” (đã quét cả ${subfolders} thư mục con).`
      : `Không thấy file ảnh nào trong “${dirName}”.`;
  return (
    `Nguồn: ${dirName} · ${count} ảnh` +
    (subfolders > 0 ? ` (gồm cả ${subfolders} thư mục con)` : "") +
    (truncated ? ` — đã đạt trần ${MAX_LOCAL_FILES} ảnh, danh sách có thể chưa đủ` : "") +
    " — không upload, xử lý ngay trên máy."
  );
}

// Luật ghép tên file dùng CHUNG với phần gom ảnh theo người. Hai luật gần giống
// nhau đặt ở hai file sẽ lệch nhau lúc nào không biết, nên chỉ có một.
export const norm = matchKey;
export const ext = (n: string) => (n.includes(".") ? n.split(".").pop()!.toLowerCase() : "");
export const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "tif", "tiff", "bmp", "avif"]);
export const RAW_EXTS = new Set(["cr2", "cr3", "nef", "nrw", "arw", "sr2", "srf", "raf", "rw2", "orf", "dng", "pef", "srw", "raw", "3fr", "fff", "iiq", "rwl", "mrw", "mef", "mos", "erf", "kdc", "dcr", "x3f"]);
// Accepted image/RAW extensions (RAW files often have an empty MIME type).
const IMG_RE =
  /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp|avif|cr2|cr3|nef|nrw|arw|sr2|srf|raf|rw2|orf|dng|pef|srw|raw|3fr|fff|iiq|rwl|mrw|mef|mos|erf|kdc|dcr|x3f)$/i;
// Extensions the browser can render in an <img> for previews.
const DISPLAYABLE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export type FilterToolOptions = {
  /** Mở sẵn với danh sách ảnh khách chọn của album này (dùng cho popup). */
  albumId?: string;
  /** Link thư mục Drive nạp sẵn (nếu không truyền sẽ lấy nguồn của album). */
  driveUrl?: string;
  /** Trang đầy đủ: nạp ?album= / ?drive= / ?driveconn= từ URL. */
  readQueryParams?: boolean;
  /** Chỉ cho màn xem trước: dữ liệu giả nạp sẵn, không gọi máy chủ. */
  seed?: { pasteText?: string; localFiles?: SourceFile[]; localNote?: string; albums?: { id: string; title: string }[] };
};

export function useFilterTool({ albumId: albumIdProp, driveUrl: driveUrlProp, readQueryParams = false, seed }: FilterToolOptions) {
  const supabase = createClient();

  const [photoSource, setPhotoSource] = useState<"drive" | "local">(seed?.localFiles ? "local" : "drive");
  const [fsSupported, setFsSupported] = useState(false);

  const [driveUrl, setDriveUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<SourceFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  /** Tóm tắt lần tải gần nhất — LUÔN hiện, kể cả khi tải về 0 ảnh, để bấm
   *  "Tải ảnh" không bao giờ giống như không có gì xảy ra. */
  const [driveNote, setDriveNote] = useState<string | null>(null);

  const [localFiles, setLocalFiles] = useState<SourceFile[]>(seed?.localFiles ?? []);
  /** Tóm tắt lần quét thư mục gần nhất (kể cả khi không thấy ảnh nào). */
  const [localNote, setLocalNote] = useState<string | null>(seed?.localNote ?? null);
  const [scanningLocal, setScanningLocal] = useState(false);
  const [destDir, setDestDir] = useState<any>(null);
  const [destName, setDestName] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  /** Lần copy gần nhất đã chép được ít nhất 1 ảnh → hiện nút "Mở thư mục đích". */
  const [copyDone, setCopyDone] = useState(false);
  /** Bản mới: chép vào một thư mục con (tạo mới nếu chưa có) bên trong thư mục
   *  đích. Rỗng = chép thẳng vào thư mục đích như bản cũ. */
  const [destSub, setDestSub] = useState("");
  /** Tiến độ copy ra thư mục đích (bản mới vẽ thanh tiến độ). */
  const [copyProgress, setCopyProgress] = useState<{ done: number; total: number } | null>(null);
  /** Thư mục thật vừa nhận ảnh (thư mục đích hoặc thư mục con của nó). */
  const lastOutDir = useRef<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"paste" | "album">("paste");
  const [pasteText, setPasteText] = useState(seed?.pasteText ?? "");
  const [albums, setAlbums] = useState<{ id: string; title: string }[]>(seed?.albums ?? []);
  const [albumId, setAlbumId] = useState("");
  const [albumNames, setAlbumNames] = useState<string[]>([]);

  const [copied, setCopied] = useState(false);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Copy ảnh đã lọc thẳng sang Drive (không tải về máy). Studio KẾT NỐI Drive
  // MỘT LẦN (toàn quyền, offline); sau đó máy chủ tự tạo thư mục + chép, KHÔNG
  // cần đăng nhập lại.
  const [newFolderName, setNewFolderName] = useState("Ảnh lọc");
  const [driveCopying, setDriveCopying] = useState(false);
  const [driveCopyMsg, setDriveCopyMsg] = useState<string | null>(null);
  const [driveCopyLink, setDriveCopyLink] = useState<string | null>(null);
  const [driveConn, setDriveConn] = useState<{ configured: boolean; connected: boolean } | null>(null);

  // Monthly filter quota (free = 10/month). One "use" is counted per result set.
  const [filterQuota, setFilterQuota] = useState<
    { unlimited: boolean; limit: number | null; used: number; remaining: number | null } | null
  >(null);
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  /** Khối "Lọc ảnh bằng AI" đang mở? Gập lại mặc định — xem chỗ dùng bên dưới. */
  const [aiOpen, setAiOpen] = useState(false);
  const consumedKeyRef = useRef<string>("");

  useEffect(() => {
    setFsSupported(typeof window !== "undefined" && "showDirectoryPicker" in window);
    if (seed) return; // màn xem trước: không gọi máy chủ
    // Trạng thái kết nối Drive (toàn quyền) cho công cụ Lọc ảnh + kết quả sau khi
    // vừa kết nối xong (?driveconn=connected|error).
    fetch("/api/filter/drive/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDriveConn({ configured: !!d.configured, connected: !!d.connected }))
      .catch(() => {});
    if (readQueryParams) {
      const conn = new URLSearchParams(window.location.search).get("driveconn");
      if (conn === "connected") setDriveCopyMsg("Đã kết nối Google Drive. Giờ bấm Copy là chép tự động, không cần đăng nhập lại.");
      else if (conn === "unauthorized") setDriveCopyMsg("Phiên đăng nhập đã hết. Hãy đăng nhập lại rồi bấm “Kết nối Google Drive”.");
      else if (conn === "notconfigured") setDriveCopyMsg("Máy chủ chưa bật kết nối Google Drive cho công cụ Lọc ảnh. Hãy liên hệ quản trị.");
      else if (conn === "error") setDriveCopyMsg("Kết nối Google Drive thất bại. Hãy thử lại.");
    }
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

    // Mở sẵn từ nút "Lọc ảnh" trong quản trị: album được truyền thẳng (popup)
    // hoặc qua ?album=<id> (trang đầy đủ) → tự chọn danh sách ảnh khách chọn +
    // nạp nguồn ảnh là link Drive của album; ?drive=<url> nạp thẳng nguồn Drive.
    (async () => {
      const sp = readQueryParams ? new URLSearchParams(window.location.search) : null;
      const albumParam = albumIdProp || sp?.get("album") || "";
      const driveParam = driveUrlProp || sp?.get("drive") || "";
      if (albumParam) {
        setMode("album");
        await loadAlbum(albumParam);
        let url = driveParam || "";
        if (!url) {
          const { data } = await supabase
            .from("album_sources")
            .select("drive_url")
            .eq("album_id", albumParam)
            .eq("kind", "folder")
            .not("drive_url", "is", null)
            .order("position", { ascending: true })
            .limit(1);
          url = (data?.[0]?.drive_url as string) || "";
        }
        if (url) {
          setPhotoSource("drive");
          setDriveUrl(url);
          await loadDrive(url);
        }
      } else if (driveParam) {
        setPhotoSource("drive");
        setDriveUrl(driveParam);
        await loadDrive(driveParam);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDrive(url?: string) {
    const u = (url ?? driveUrl).trim();
    if (!u) {
      setDriveError("Chưa nhập link thư mục Drive.");
      return;
    }
    setLoadingDrive(true);
    setDriveError(null);
    setDriveNote(null);
    try {
      const res = await fetch("/api/drive/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Quét cả thư mục con: ảnh buổi chụp hay được xếp sẵn theo JPG / RAW /
        // ngày, thư mục gốc không có file nào nên trước đây tải về rỗng.
        body: JSON.stringify({ url: u, recursive: true }),
      });
      // Lỗi máy chủ có thể trả HTML (không phải JSON) — bắt luôn để không nuốt
      // lỗi và kẹt nút ở trạng thái "Đang tải…".
      const data = await res.json().catch(() => null);
      if (!data) {
        setDriveFiles([]);
        setDriveError(`Máy chủ trả lời không hợp lệ (mã ${res.status}). Hãy thử lại.`);
        return;
      }
      if (data.error) {
        setDriveFiles([]);
        setDriveError(data.error);
        return;
      }
      const files = (data.files ?? []).map((f: any) => ({ key: f.id, name: f.name, driveId: f.id }));
      setDriveFiles(files);
      const subs = Number(data.subfolders) || 0;
      if (files.length === 0) {
        setDriveNote(
          subs > 0
            ? `Không thấy file ảnh nào trong link này (đã quét cả ${subs} thư mục con). Kiểm tra lại link, hoặc dán link đúng thư mục chứa ảnh.`
            : "Không thấy file ảnh nào trong link này. Kiểm tra link đúng thư mục chứa ảnh, và tài khoản Drive đã kết nối có quyền xem thư mục đó."
        );
      } else {
        setDriveNote(
          `Đã tải ${files.length} ảnh từ Drive` +
            (subs > 0 ? ` (gồm cả ${subs} thư mục con)` : "") +
            (data.truncated ? " — đã đạt giới hạn quét, danh sách có thể chưa đủ." : ".")
        );
      }
    } catch {
      setDriveFiles([]);
      setDriveError("Không tải được danh sách ảnh từ Drive. Kiểm tra mạng rồi thử lại.");
    } finally {
      setLoadingDrive(false);
    }
  }

  // ── Local source (File System Access API) ──────────────────────
  /** Chrome/Edge: bộ chọn thư mục thật. Trình duyệt khác: <input webkitdirectory>. */
  function pickSourceFolder() {
    if (fsSupported) pickSourceFS();
    else folderInput.current?.click();
  }

  async function pickSourceFS() {
    let dir: any;
    try {
      dir = await (window as any).showDirectoryPicker({ id: "vk-src" });
    } catch {
      return; /* người dùng bấm huỷ */
    }
    setScanningLocal(true);
    setCopyMsg(null);
    try {
      const { files, subfolders, truncated } = await walkLocalDir(dir, (n) => IMG_RE.test(n));
      setLocalFiles(files);
      setLocalNote(localNoteText(dir.name, files.length, subfolders, truncated));
    } catch {
      setLocalFiles([]);
      setLocalNote("Không đọc được thư mục này. Hãy chọn lại và cấp quyền cho trình duyệt.");
    } finally {
      setScanningLocal(false);
    }
  }

  /** Nhánh <input>: webkitdirectory trả về CẢ file trong thư mục con (kèm webkitRelativePath). */
  function pickSourceInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter((f) => IMG_RE.test(f.name));
    const subs = new Set<string>();
    const files: SourceFile[] = [];
    let rootName = "";
    let truncated = false;
    for (const [i, file] of picked.entries()) {
      const rel = ((file as any).webkitRelativePath as string) || "";
      const { root, dir } = splitWebkitPath(rel);
      if (root && !rootName) rootName = root;
      if (dirDepth(dir) >= MAX_LOCAL_DEPTH) continue;
      if (dir) subs.add(dir);
      files.push({ key: rel || `${i}-${file.name}`, name: file.name, dir, file });
      if (files.length >= MAX_LOCAL_FILES) {
        truncated = true;
        break;
      }
    }
    const label = rootName || `${files.length} ảnh đã chọn`;
    setLocalFiles(files);
    setLocalNote(localNoteText(label, files.length, subs.size, truncated));
    setCopyMsg(null);
    e.target.value = ""; // chọn lại đúng thư mục đó vẫn kích hoạt onChange
  }
  /** Trả về thư mục vừa chọn (null nếu huỷ) để bản mới chọn xong là chép luôn. */
  async function pickDest(): Promise<any | null> {
    try {
      const dir = await (window as any).showDirectoryPicker({ id: "vk-dest", mode: "readwrite" });
      setDestDir(dir);
      setDestName(dir.name);
      setCopyDone(false);
      return dir;
    } catch {
      /* cancelled */
      return null;
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

  // Chỉ DỰNG một cửa sổ ô ảnh, không phải cả tập khớp (có thể hàng nghìn file
  // của cả buổi chụp). Dựng hết thì mỗi file là một <img> → cuộn giật, ngốn bộ
  // nhớ. Đường xem trước local vốn đã chặn ở 300; lưới hiển thị nay cũng vậy.
  const GRID_PAGE = 300;
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);
  // Tập khớp đổi (danh sách mới / đổi định dạng) → dựng lại từ đầu cửa sổ.
  useEffect(() => { setGridLimit(GRID_PAGE); }, [matchedKey, fmt]);
  const gridShown = useMemo(() => shown.slice(0, gridLimit), [shown, gridLimit]);

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
    // Chỉ nén được ảnh ĐANG NẰM TRÊN MÁY. Nhánh cũ cho nguồn Drive gọi buildZip,
    // tức kéo từng ảnh qua /api/img rồi mới nén — ZIP cần byte trong JS mà Drive
    // không gửi header CORS nên không chuyển hướng thẳng sang Google được, thành
    // ra mỗi lượt tải ngốn nguyên bộ ảnh của Fast Origin Transfer. Nguồn Drive
    // giờ dùng "Copy sang Drive" bên dưới: chép thẳng file giữa hai thư mục, tốn
    // 0 byte và nhanh hơn hẳn.
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const m of shown) {
      const file = m.handle ? await m.handle.getFile() : m.file;
      if (file) zip.file(m.name, file);
    }
    const blob = await zip.generateAsync({ type: "blob" }, (meta) => setZipProgress(Math.round(meta.percent)));
    triggerDownload(blob, "loc-anh.zip");
    setZipProgress(null);
  }

  // Copy matched files directly from source folder to destination folder.
  async function copyToDest(dirOverride?: any) {
    const baseDir = dirOverride ?? destDir;
    const baseName: string = dirOverride ? dirOverride.name : destName;
    if (!baseDir || shown.length === 0) return;
    if (!(await ensureFilterUse())) return;
    setCopying(true);
    setCopyMsg(null);
    setCopyDone(false);
    setCopyProgress({ done: 0, total: shown.length });

    // Thư mục con (chỉ bản mới đặt): tạo trong thư mục đích nếu chưa có.
    const sub = destSub.trim();
    let outDir = baseDir;
    if (sub) {
      try {
        outDir = await baseDir.getDirectoryHandle(sub, { create: true });
      } catch {
        setCopying(false);
        setCopyProgress(null);
        setCopyMsg(`Không tạo được thư mục con “${sub}” trong “${baseName}”. Hãy đổi tên khác (không dùng ký tự / \\ : * ? " < > |).`);
        return;
      }
    }
    lastOutDir.current = outDir;
    const outName = sub ? `${baseName}/${sub}` : baseName;

    // Quét cả thư mục con nên HAI ảnh KHÁC NHAU có thể trùng tên (IMG_001.jpg ở
    // "Ngày 1" và ở "Ngày 2"). Thư mục đích phẳng, ghi thẳng theo tên là tấm sau
    // đè mất tấm trước mà không ai biết → tấm trùng được thêm hậu tố.
    const used = new Set<string>();
    let renamed = 0;
    const uniqueName = (name: string) => {
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const suffix = dot > 0 ? name.slice(dot) : "";
      for (let i = 2; ; i++) {
        const candidate = `${base} (${i})${suffix}`;
        if (!used.has(candidate)) {
          used.add(candidate);
          renamed++;
          return candidate;
        }
      }
    };

    let done = 0;
    let failed = 0;
    for (const m of shown) {
      try {
        const file = m.handle ? await m.handle.getFile() : m.file;
        if (!file) {
          failed++;
          continue;
        }
        const fh = await outDir.getFileHandle(uniqueName(m.name), { create: true });
        const w = await fh.createWritable();
        await w.write(file);
        await w.close();
        done++;
        setCopyMsg(`Đang copy… ${done}/${shown.length}`);
      } catch {
        failed++;
      }
      setCopyProgress({ done: done + failed, total: shown.length });
    }
    setCopying(false);
    setCopyProgress(null);
    setCopyDone(done > 0);
    setCopyMsg(
      `Đã copy ${done}/${shown.length} ảnh sang “${outName}”` +
        (renamed ? ` · ${renamed} ảnh trùng tên (khác thư mục con) được đổi tên để không đè nhau` : "") +
        (failed ? ` · ${failed} ảnh lỗi` : "") +
        "."
    );
  }

  // Trình duyệt không cho biết đường dẫn thật của thư mục (chỉ có handle) nên
  // không gọi được Explorer/Finder. Cách gần nhất: mở hộp thoại hệ thống NGAY
  // TẠI thư mục đích (startIn) — thấy luôn ảnh vừa copy, và từ đó mở được bằng
  // Explorer (chuột phải → Mở). Chọn hay huỷ đều bỏ qua, không làm gì thêm.
  async function openDestFolder() {
    const dir = lastOutDir.current ?? destDir;
    if (!dir) return;
    try {
      await (window as any).showOpenFilePicker({ startIn: dir, multiple: true });
    } catch {
      /* huỷ / trình duyệt không hỗ trợ startIn */
    }
  }

  // Copy ảnh đã lọc sang Drive — máy chủ dùng KẾT NỐI đã lưu (toàn quyền) để tự
  // tạo thư mục "Ảnh lọc" trong thư mục gốc đang lọc rồi chép ảnh vào, KHÔNG cần
  // đăng nhập lại. Bytes không qua máy studio.
  async function copyToDrive() {
    const files = shown.filter((f) => f.driveId).map((f) => ({ id: f.driveId as string, name: f.name }));
    if (files.length === 0) return;
    if (!(await ensureFilterUse())) return;
    setDriveCopying(true);
    setDriveCopyMsg(null);
    setDriveCopyLink(null);
    try {
      const res = await fetch("/api/filter/copy-to-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files,
          sourceFolderUrl: driveUrl.trim(),
          newFolderName: newFolderName.trim(),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || d?.error) {
        setDriveCopyMsg(d?.error || "Không copy được sang Drive.");
      } else {
        setDriveCopyLink(d.folderUrl ?? null);
        const failN = Array.isArray(d.failed) ? d.failed.length : 0;
        const skipN = Number(d.skipped) || 0;
        setDriveCopyMsg(
          `Đã copy ${d.copied}/${files.length} ảnh vào thư mục “${d.folderName || "Ảnh lọc"}”` +
            `${d.reused ? " (thư mục đã có sẵn trong link gốc)" : " (vừa tạo trong link ảnh gốc)"}` +
            `${skipN ? ` · ${skipN} ảnh đã có từ trước nên bỏ qua` : ""}` +
            `${failN ? ` · ${failN} ảnh lỗi` : ""}.`
        );
      }
    } catch {
      setDriveCopyMsg("Mất kết nối khi copy sang Drive.");
    }
    setDriveCopying(false);
  }

  return {
    photoSource, setPhotoSource, fsSupported,
    driveUrl, setDriveUrl, driveFiles, loadingDrive, driveError, driveNote, loadDrive,
    localFiles, localNote, scanningLocal, pickSourceFolder, pickSourceInput, fileInput, folderInput,
    destDir, destName, pickDest, destSub, setDestSub, copying, copyMsg, copyDone, copyProgress, copyToDest, openDestFolder,
    mode, setMode, pasteText, setPasteText, albums, albumId, albumNames, loadAlbum,
    copied, zipProgress, thumbs,
    newFolderName, setNewFolderName, driveCopying, driveCopyMsg, driveCopyLink, driveConn, copyToDrive,
    filterQuota, filterMsg, aiOpen, setAiOpen, ensureFilterUse,
    sourceFiles, wantedNames, wantedSet, matched, fmt, setFmt, availableExts, shown, notFound,
    GRID_PAGE, gridLimit, setGridLimit, gridShown,
    copyMatched, exportMatched, zipMatched,
  };
}

export type FilterToolState = ReturnType<typeof useFilterTool>;
