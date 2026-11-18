"use client";

import { useEffect, useRef, useState } from "react";

type Signed = { code: string; url: string; expiresAt: number; bucket: string; uploads: { path: string; token: string }[] };
type Done = { url: string; expiresAt: number; count: number };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function fmtSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/**
 * Đẩy một file thẳng lên Storage bằng URL ký sẵn. Dùng XHR (không dùng
 * supabase-js) để có tiến độ % — file lớn qua mạng điện thoại mất cả phút.
 */
function putSigned(bucket: string, path: string, token: string, file: File, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const url = `${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`;
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    if (ANON) xhr.setRequestHeader("apikey", ANON);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Lỗi ${xhr.status}`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (/size|large|exceed/i.test(j?.message || j?.error || "")) msg = "File quá lớn";
          else if (j?.message) msg = j.message;
        } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Mất kết nối"));
    xhr.send(file);
  });
}

export default function UploadBox({ needPin, maxFiles, maxMb }: { needPin: boolean; maxFiles: number; maxMb: number }) {
  const [files, setFiles] = useState<File[]>([]);
  const [pin, setPin] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("qs_pin");
      if (saved) setPin(saved);
    } catch {}
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    setDone(null);
    const next = [...files, ...Array.from(list)].slice(0, maxFiles);
    const big = next.find((f) => f.size > maxMb * 1024 * 1024);
    if (big) setError(`"${big.name}" lớn hơn ${maxMb}MB`);
    setFiles(next.filter((f) => f.size <= maxMb * 1024 * 1024));
  }

  async function upload() {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const r = await fetch("/api/quick-share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || (r.status === 429 ? "Gửi quá nhiều, đợi chút rồi thử lại" : "Không tạo được link"));
      const s = j as Signed;
      if (needPin) {
        try {
          localStorage.setItem("qs_pin", pin);
        } catch {}
      }

      const total = files.reduce((a, f) => a + f.size, 0) || 1;
      const loaded = files.map(() => 0);
      // Chạy song song tối đa 3 file một lúc.
      let next = 0;
      const worker = async () => {
        while (next < files.length) {
          const i = next++;
          await putSigned(s.bucket, s.uploads[i].path, s.uploads[i].token, files[i], (n) => {
            loaded[i] = n;
            setProgress(Math.min(99, Math.round((loaded.reduce((a, b) => a + b, 0) / total) * 100)));
          });
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
      setProgress(100);
      setDone({ url: s.url, expiresAt: s.expiresAt, count: files.length });
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi, thử lại");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.url);
    } catch {
      const t = document.createElement("textarea");
      t.value = done.url;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const totalSize = files.reduce((a, f) => a + f.size, 0);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl">
      {done && (
        <div className="mb-5 rounded-xl border border-emerald-700/60 bg-emerald-900/20 p-4">
          <div className="text-sm text-emerald-300">Đã tải lên {done.count} file — link dùng được trong 30 phút</div>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={done.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
            />
            <button onClick={copy} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium hover:bg-emerald-600">
              {copied ? "Đã chép" : "Chép link"}
            </button>
          </div>
          <a href={done.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-neutral-400 underline">
            Mở thử link
          </a>
        </div>
      )}

      <div
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) addFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          drag ? "border-red-500 bg-red-500/10" : "border-neutral-700 hover:border-neutral-500"
        }`}
      >
        <div className="text-4xl">📤</div>
        <div className="mt-2 font-medium">Bấm để chọn file hoặc kéo thả vào đây</div>
        <div className="text-xs text-neutral-500">Chọn được nhiều file cùng lúc</div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 max-h-60 divide-y divide-neutral-800 overflow-y-auto">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-neutral-500">{fmtSize(f.size)}</span>
              {!busy && (
                <button
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="shrink-0 px-1 text-neutral-500 hover:text-red-400"
                  aria-label="Bỏ file"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {needPin && (
        <input
          type="password"
          inputMode="numeric"
          placeholder="Mã PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
        />
      )}

      {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

      {busy && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full bg-red-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        onClick={upload}
        disabled={!files.length || busy || (needPin && !pin)}
        className="mt-4 w-full rounded-lg bg-red-700 py-2.5 font-medium hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? `Đang tải lên… ${progress}%` : files.length ? `Tải lên ${files.length} file (${fmtSize(totalSize)}) & lấy link` : "Tải lên & lấy link"}
      </button>
    </div>
  );
}
