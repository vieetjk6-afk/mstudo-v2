"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2 } from "lucide-react";

/**
 * HOÀN TÁC TRONG TOAST (tính năng mới số 9 của bản thiết kế)
 *
 * Thay cho `confirm("Xoá … ?")`. Hộp confirm bắt người dùng dừng lại và đọc
 * TRƯỚC khi làm — trong khi thứ họ cần là làm nhanh rồi sửa được nếu lỡ tay.
 * Ở đây: hàng biến mất ngay, toast sống 5 giây có nút "Hoàn tác", và việc xoá
 * thật chỉ chạy KHI TOAST HẾT GIỜ.
 *
 * Hoãn xoá thay vì xoá-rồi-thêm-lại là có chủ ý: thêm lại một dòng đã xoá không
 * bao giờ khôi phục đúng nguyên trạng (id mới, mất bản ghi con, sai thứ tự).
 * Chưa gọi xuống máy chủ thì không có gì để khôi phục cả.
 *
 * Rời trang trong lúc toast còn sống thì việc xoá được chạy nốt ngay lúc đó —
 * nếu không, người dùng thấy hàng biến mất nhưng tải lại trang nó vẫn còn.
 */

const UNDO_MS = 5000;

type Pending = {
  label: string;
  commit: () => void | Promise<void>;
  undo: () => void;
};

export function useUndoToast() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [plain, setPlain] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Giữ trong ref để hàm dọn dẹp lúc unmount đọc được bản mới nhất mà không
  // phải đăng ký lại effect mỗi lần đổi.
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  /** Chốt luôn việc đang chờ (hết 5 giây, hoặc có hành động khác chen vào). */
  const flush = useCallback(() => {
    const p = pendingRef.current;
    clearTimer();
    pendingRef.current = null;
    setPending(null);
    if (p) void p.commit();
  }, []);

  useEffect(() => {
    // Rời trang / đóng tab: chạy nốt việc đang chờ.
    const onLeave = () => {
      const p = pendingRef.current;
      if (p) void p.commit();
    };
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      onLeave();
      clearTimer();
    };
  }, []);

  /**
   * Chạy một hành động hoàn tác được.
   * Người gọi tự cập nhật giao diện trước (ẩn hàng đi), `undo` để trả lại,
   * `commit` mới là lệnh thật gửi xuống máy chủ.
   */
  const run = useCallback(
    (next: Pending) => {
      // Đang có việc chờ mà bấm tiếp việc khác → chốt việc cũ, không nuốt mất.
      const prev = pendingRef.current;
      if (prev) void prev.commit();
      clearTimer();
      setPlain(null);
      setPending(next);
      pendingRef.current = next;
      timer.current = setTimeout(flush, UNDO_MS);
    },
    [flush]
  );

  const undo = useCallback(() => {
    const p = pendingRef.current;
    clearTimer();
    pendingRef.current = null;
    setPending(null);
    p?.undo();
  }, []);

  /** Toast thường, không có nút hoàn tác. */
  const toast = useCallback((m: string) => {
    setPlain(m);
    setTimeout(() => setPlain((cur) => (cur === m ? null : cur)), 2500);
  }, []);

  const view = (
    <UndoToastView pending={pending} plain={plain} onUndo={undo} />
  );

  return { run, toast, view, flush };
}

function UndoToastView({
  pending,
  plain,
  onUndo,
}: {
  pending: Pending | null;
  plain: string | null;
  onUndo: () => void;
}) {
  if (!pending && !plain) return null;
  return (
    <div
      className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[12px] py-2 pl-4 pr-2 text-[13px] font-semibold"
      style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)", animation: "vkToast .2s ease" }}
      role="status"
    >
      <span>{pending?.label ?? plain}</span>
      {pending && (
        <button
          onClick={onUndo}
          className="flex flex-none items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-bold"
          style={{ background: "color-mix(in srgb, var(--sf) 18%, transparent)", color: "var(--sf)" }}
        >
          <Undo2 size={14} /> Hoàn tác
        </button>
      )}
    </div>
  );
}
