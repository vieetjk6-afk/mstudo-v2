"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Lock } from "lucide-react";
import { BRANCH_ALL, BRANCH_NONE, UNASSIGNED_LABEL } from "@/lib/branch-rules";
import { useTheme } from "@/lib/theme";

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

   BẢNG CHỌN ĐI QUA PORTAL RA <body>, KHÔNG neo vào nút. Hai lý do, cái nào một
   mình cũng đủ làm hỏng bảng chọn `absolute` cũ:

     1. Topbar mang `backdrop-filter: blur(12px)`. Phần tử có backdrop-filter TRỞ
        THÀNH containing block cho mọi con `position: fixed` — nên ngay cả khi
        đổi sang `fixed` mà vẫn nằm trong <header> thì toạ độ vẫn tính theo
        header, không theo khung nhìn.
     2. `absolute right-0` chỉ canh mép phải bảng chọn bằng mép phải NÚT. Trên
        điện thoại nút nằm giữa topbar, bảng rộng 248px đổ ngược sang trái và
        chạy lọt ra ngoài mép trái màn hình — đúng lỗi "bấm chọn chi nhánh bị
        lệch khung, một phần bị khuất".

   Thay vào đó: đo `getBoundingClientRect()` của nút rồi đặt toạ độ `fixed` theo
   KHUNG NHÌN, kẹp lại trong hai mép với lề 8px, và bề rộng không bao giờ vượt
   quá `100vw - 16px`. Đo lại khi cuộn/đổi kích thước để bảng không rời khỏi nút.

   Portal ra <body> là ra khỏi khối token `.studio-shell`, nên bảng chọn TỰ MANG
   lại class phạm vi + `data-theme` — nếu không `var(--ac)` rơi về bí danh nâu ở
   `:root` và dòng đang chọn đổi màu (xem chú thích dài trong studio/Modal.tsx).
   ═══════════════════════════════════════════════════════════════════════════ */

export type SwitcherBranch = { id: string; name: string; code: string | null; active: boolean };

/** Lề tối thiểu giữa bảng chọn và mép màn hình. */
const EDGE = 8;
const MENU_W = 248;

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
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  /** Toạ độ theo KHUNG NHÌN (position: fixed) — null khi chưa đo được. */
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);

  useEffect(() => setMounted(true), []);

  /** Đo nút rồi kẹp bảng chọn vào trong khung nhìn. */
  const place = useCallback(() => {
    const b = btn.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const width = Math.min(MENU_W, vw - EDGE * 2);
    // Ưu tiên canh mép phải bảng bằng mép phải nút (bảng đổ xuống dưới bên trái
    // nút, như mọi menu topbar khác), rồi kẹp cả hai đầu — hai phép Math này là
    // thứ giữ bảng không lọt ra ngoài màn hình dù nút nằm ở đâu.
    const left = Math.min(Math.max(EDGE, r.right - width), vw - width - EDGE);
    const top = r.bottom + 6;
    // Chừa 8px dưới đáy: bảng dài hơn thì tự cuộn trong lòng nó.
    setPos({ top, left, width, maxH: Math.max(160, vh - top - EDGE) });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // Bảng chọn nằm ngoài cây DOM của nút (portal), nên phải hỏi cả hai.
      if (btn.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // `capture: true` để bắt cả khi trang cuộn bên trong một khối con.
    const onScroll = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

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
    // Không cần `relative`: bảng chọn không còn neo vào khối này nữa.
    <div className="flex-none">
      <button
        ref={btn}
        // Đo NGAY trong lượt bấm, trước khi mở: `useLayoutEffect` sẽ kêu cảnh báo
        // khi render ở server, còn `useEffect` thì mở lần thứ hai bảng dùng lại
        // toạ độ cũ đúng một khung hình rồi mới nhảy về chỗ mới.
        onClick={() => {
          if (!open) place();
          setOpen((v) => !v);
        }}
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

      {mounted && open && pos &&
        createPortal(
          <div
            ref={menu}
            role="listbox"
            // `studio-shell` + data-theme: dựng lại khối token đã mất khi ra <body>.
            // z-140: trên mọi thứ của shell (topbar z-30, ⌘K z-95), nhưng DƯỚI hộp
            // thoại z-150 — mở một hộp thoại thì nó phải che bảng chọn này.
            className="studio-shell fixed z-[140] overflow-y-auto rounded-[12px] py-1.5"
            data-theme={theme}
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxH,
              background: "var(--sf)",
              border: "1px solid var(--bd)",
              boxShadow: "var(--sh-modal)",
            }}
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
          </div>,
          document.body,
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
