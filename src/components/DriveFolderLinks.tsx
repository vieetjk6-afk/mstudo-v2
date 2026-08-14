"use client";

import { useState } from "react";
import { Download, ChevronDown, ExternalLink } from "lucide-react";

export interface DriveFolder {
  name: string;
  url: string;
}

/**
 * Nút mở thư mục ảnh trên Google Drive. Một thư mục → link thẳng; nhiều thư mục
 * → menu thả xuống.
 *
 * Vì sao là link Drive chứ không phải nút tải trong app: Google tự nén và tự
 * phục vụ file, nên **không byte nào đi qua Vercel/Supabase**. Đây là đường tải
 * hàng loạt duy nhất không tốn băng thông — xem docs/supabase-usage.md.
 *
 * Trên iPhone, khách mở link bằng app Google Drive rồi "Gửi bản sao → Lưu ảnh"
 * là ảnh vào thẳng thư viện Ảnh, cả loạt một lần.
 */
export default function DriveFolderLinks({
  folders,
  label,
  labelOne,
  className,
}: {
  folders: DriveFolder[];
  label: string;
  labelOne: string;
  className: string;
}) {
  const [open, setOpen] = useState(false);

  if (folders.length === 0) return null;

  if (folders.length === 1) {
    return (
      <a href={folders[0].url} target="_blank" rel="noopener noreferrer" className={className}>
        <Download size={14} /> {labelOne}
      </a>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className={className}>
        <Download size={14} /> {label}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 min-w-[220px] max-w-[80vw] rounded-xl p-1.5 shadow-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {folders.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-[var(--surface2)]"
                style={{ color: "var(--text)" }}
              >
                <ExternalLink size={14} style={{ color: "var(--text3)" }} className="shrink-0" />
                <span className="truncate">{f.name || "Thư mục Drive"}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
