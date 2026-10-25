"use client";

import { useState } from "react";
import type { ContractStatus } from "@/lib/types";
import type { BoardCard } from "./BoardView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của Bảng công việc (bản cũ BoardView và bản mới
   BoardV2): danh sách thẻ, kéo thả, bật/tắt hai cột phụ và CHUYỂN TRẠNG THÁI
   qua route server. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Bốn cột LUÔN hiện — đúng dòng chảy của một hợp đồng đang sống.
 *
 * "Nháp" và "Đã huỷ" tách ra vì chúng nằm ngoài dòng chảy đó: nháp là đơn chưa
 * gửi, huỷ là đơn đã chết. Để cả sáu cột thì trên laptop 1280px cột cuối bị
 * đẩy khuất khỏi mép phải mà không có dấu hiệu gì báo là cuộn được — thẻ nằm
 * trong đó coi như biến mất. Bốn cột thì vừa màn, và hai cột kia bật lại bằng
 * một nút khi cần.
 */
export const CORE_COLUMNS: ContractStatus[] = ["sent", "approved", "in_progress", "post_production", "completed"];
export const EXTRA_COLUMNS: ContractStatus[] = ["draft", "cancelled"];

export function useBoard(initial: BoardCard[]) {
  const [cards, setCards] = useState<BoardCard[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<ContractStatus | null>(null);
  const [showExtra, setShowExtra] = useState(false);

  // Vẫn giữ đúng thứ tự vòng đời khi bật thêm: nháp đứng đầu, huỷ đứng cuối.
  const columns = showExtra ? (["draft", ...CORE_COLUMNS, "cancelled"] as ContractStatus[]) : CORE_COLUMNS;
  const extraCount = cards.filter((c) => EXTRA_COLUMNS.includes(c.status)).length;

  async function moveTo(id: string, status: ContractStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    const prev = card.status;
    setCards((p) => p.map((c) => (c.id === id ? { ...c, status } : c)));
    // Route server tập trung: đóng dấu completed_at + tạo album giao khi hoàn thành.
    try {
      const res = await fetch("/api/studio/contract-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: id, status }),
      });
      if (!res.ok) setCards((p) => p.map((c) => (c.id === id ? { ...c, status: prev } : c)));
    } catch {
      setCards((p) => p.map((c) => (c.id === id ? { ...c, status: prev } : c)));
    }
  }

  /** Bộ xử lý kéo thả cho một CỘT — giống hệt nhau ở hai bản. */
  const columnDnd = (col: ContractStatus) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(col);
    },
    onDragLeave: () => setOver((o) => (o === col ? null : o)),
    onDrop: () => {
      if (dragId) moveTo(dragId, col);
      setDragId(null);
      setOver(null);
    },
  });

  /** Bộ xử lý kéo thả cho một THẺ. */
  const cardDnd = (id: string) => ({
    draggable: true,
    onDragStart: () => setDragId(id),
    onDragEnd: () => {
      setDragId(null);
      setOver(null);
    },
  });

  return { cards, dragId, over, showExtra, setShowExtra, columns, extraCount, moveTo, columnDnd, cardDnd };
}
