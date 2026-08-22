"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Lock } from "lucide-react";
import { BRANCH_ALL, BRANCH_NONE, UNASSIGNED_LABEL } from "@/lib/branch-rules";

/* ═══════════════════════════════════════════════════════════════════════════
   Ô CHỌN CHI NHÁNH trên thanh trên cùng — "xem gộp hoặc tách".

   Lựa chọn lưu trong COOKIE để mọi màn của shell cùng nói về một cơ sở khi
   người dùng đi từ Hợp đồng sang Lịch sang Thu chi. Đặt cookie ở client rồi
   `router.refresh()`: server component đọc lại cookie ở lần render sau và truy
   vấn đã mang điều kiện chi nhánh — không cần thêm tham số vào URL của từng
   liên kết trong app.

   Component này KHÔNG hiện gì khi studio chưa khai chi nhánh nào (branches
   rỗng): studio một cơ sở — tức đa số — không được thấy thêm một ô điều khiển
   chẳng để làm gì.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SwitcherBranch = { id: string; name: string; code: string | null; active: boolean };

export default function BranchSwitcher({
  branches,
  selected,
  cookieName,
  locked = false,
}: {
  branches: SwitcherBranch[];
  /** null = gộp · "none" = chưa gán · id = một cơ sở. */
  selected: string | null;
  cookieName: string;
  /**
   * Phạm vi do VAI TRÒ quyết định (Toàn quyền chi nhánh) — hiện dạng chip khoá,
   * không mở danh sách. Đây chỉ là phần hiển thị: hàng rào thật nằm ở
   * `getBranchScope` phía server, nên sửa DOM cũng không đổi được phạm vi.
   */
  locked?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (branches.length === 0 && !locked) return null;

  function pick(value: string) {
    // 180 ngày: lựa chọn phạm vi là thói quen làm việc, không phải thao tác một
    // lần — chủ studio phụ trách một cơ sở không nên phải chọn lại mỗi phiên.
    // `SameSite=Lax` đủ vì cookie chỉ ảnh hưởng cách LỌC dữ liệu của chính họ.
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; path=/; max-age=${180 * 24 * 3600}; samesite=lax`;
    setOpen(false);
    router.refresh();
  }

  const current =
    selected === null
      ? "Tất cả chi nhánh"
      : selected === BRANCH_NONE
        ? UNASSIGNED_LABEL
        : branches.find((b) => b.id === selected)?.name || "Tất cả chi nhánh";

  const shortCurrent =
    selected === null
      ? "Tất cả"
      : selected === BRANCH_NONE
        ? "Chưa gán"
        : branches.find((b) => b.id === selected)?.code?.trim() ||
          branches.find((b) => b.id === selected)?.name ||
          "Tất cả";

  if (locked) {
    const missing = selected === BRANCH_NONE;
    return (
      <span
        className="flex h-[34px] flex-none items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-bold"
        style={{
          border: `1px solid ${missing ? "var(--rd)" : "var(--acM)"}`,
          background: missing ? "var(--rdS)" : "var(--acS)",
          color: missing ? "var(--rd)" : "var(--ac)",
        }}
        title={
          missing
            ? "Vai trò Toàn quyền chi nhánh nhưng chưa được gán chi nhánh — liên hệ chủ studio."
            : `Bạn chỉ xem được chi nhánh ${current}`
        }
      >
        <Lock size={14} />
        <span className="hidden max-w-[130px] truncate min-[900px]:inline">{missing ? "Chưa gán chi nhánh" : current}</span>
        <span className="max-w-[70px] truncate min-[900px]:hidden">{missing ? "Chưa gán" : shortCurrent}</span>
      </span>
    );
  }

  return (
    <div ref={box} className="relative flex-none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-[34px] items-center gap-1.5 rounded-[9px] px-2.5 text-[12.5px] font-semibold"
        style={{
          border: "1px solid var(--bd)",
          background: selected === null ? "var(--sf)" : "var(--acS)",
          color: selected === null ? "var(--tx2)" : "var(--ac)",
        }}
        title={`Chi nhánh: ${current}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 size={16} />
        {/* Dưới 900px chỉ hiện mã ngắn: topbar còn ô ⌘K, chuông và avatar. */}
        <span className="hidden max-w-[130px] truncate min-[900px]:inline">{current}</span>
        <span className="max-w-[70px] truncate min-[900px]:hidden">{shortCurrent}</span>
        <ChevronDown size={14} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] w-[248px] overflow-y-auto rounded-[12px] py-1.5"
          style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "var(--sh-modal)" }}
        >
          <Row label="Tất cả chi nhánh" sub="Xem gộp toàn studio" on={selected === null} onClick={() => pick(BRANCH_ALL)} />
          <div className="my-1" style={{ borderTop: "1px solid var(--bd2)" }} />
          {branches.map((b) => (
            <Row
              key={b.id}
              label={b.name}
              sub={[b.code?.trim(), b.active ? null : "tạm ẩn"].filter(Boolean).join(" · ") || undefined}
              on={selected === b.id}
              onClick={() => pick(b.id)}
            />
          ))}
          <div className="my-1" style={{ borderTop: "1px solid var(--bd2)" }} />
          <Row
            label={UNASSIGNED_LABEL}
            sub="Dữ liệu chưa thuộc cơ sở nào"
            on={selected === BRANCH_NONE}
            onClick={() => pick(BRANCH_NONE)}
          />
        </div>
      )}
    </div>
  );
}

function Row({ label, sub, on, onClick }: { label: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button
      role="option"
      aria-selected={on}
      onClick={onClick}
      className="ck-row flex w-full items-center gap-2 px-3 py-2 text-left"
      style={{ background: on ? "var(--acS)" : "transparent" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px]" style={{ fontWeight: on ? 700 : 550, color: on ? "var(--ac)" : "var(--tx)" }}>
          {label}
        </span>
        {sub && <span className="block truncate text-[11px]" style={{ color: "var(--tx3)" }}>{sub}</span>}
      </span>
      {on && <Check size={15} style={{ flex: "none", color: "var(--ac)" }} />}
    </button>
  );
}
