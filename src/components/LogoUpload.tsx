"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";

const MAX_BYTES = 500 * 1024; // 500 KB
const MAX_LABEL = "500 KB";

interface Props {
  value: string;
  onChange: (url: string) => void;
  ownerId?: string; // (giữ để tương thích lời gọi cũ; upload nay qua /api/upload)
  bucket?: string; // default: "logos"
  label?: string;
}

export default function LogoUpload({ value, onChange, bucket = "logos", label = "Logo" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target) return;
    if (!file) return;
    setErr(null);

    if (file.size > MAX_BYTES) {
      setErr(`Ảnh quá lớn (${Math.round(file.size / 1024)} KB). Giới hạn ${MAX_LABEL}.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("Chỉ chấp nhận file ảnh (PNG, JPG, SVG, WEBP).");
      return;
    }

    setUploading(true);
    try {
      // Lưu qua API: ưu tiên Drive của admin, tự fallback Supabase. original=1
      // để giữ nguyên ảnh gốc (logo PNG trong suốt).
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", bucket);
      fd.append("original", "1");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        if (data.error === "bucket_missing") {
          setErr(`Chưa tạo bucket "${bucket}" trong Supabase Storage (hoặc kết nối Drive admin trong Cài đặt hệ thống).`);
        } else {
          setErr(data.error === "too_large" ? "Ảnh quá lớn." : data.error || "Tải lên thất bại.");
        }
        return;
      }
      onChange(data.url as string);
    } catch {
      setErr("Tải lên thất bại, thử lại.");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <label className="label">{label} <span style={{ color: "var(--text3)", fontWeight: 400 }}>(tối đa {MAX_LABEL})</span></label>
      <div className="flex items-center gap-2">
        {/* Preview */}
        {value ? (
          <div className="relative shrink-0">
            <img src={value} alt="logo" className="h-10 w-10 rounded-lg object-contain" style={{ border: "1px solid var(--border)", background: "var(--surface2)" }} />
            <button
              type="button"
              aria-label="Gỡ logo"
              onClick={() => onChange("")}
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
            >
              <X size={9} />
            </button>
          </div>
        ) : null}

        {/* URL input */}
        <input
          className="input flex-1"
          placeholder="https://… hoặc tải lên ↓"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* Upload button */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className="btn-ghost shrink-0 gap-2 px-3 py-2 text-xs"
        >
          <Upload size={14} />
          {uploading ? "Đang tải…" : "Tải lên"}
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      </div>
      {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
