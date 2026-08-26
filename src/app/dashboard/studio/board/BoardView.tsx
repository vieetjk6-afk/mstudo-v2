"use client";

import { useState } from "react";
import Link from "next/link";
import { contractTotal, vnd, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, type ContractStatus } from "@/lib/types";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDate, todayVN } from "@/lib/date";

export type BoardCard = {
  id: string;
  title: string;
  client_name: string | null;
  status: ContractStatus;
  event_date: string | null;
  delivery_due: string | null;
  contract_items: { qty: number; unit_price: number }[];
  contract_tasks: { done: boolean }[];
};

/**
 * Bốn cột LUÔN hiện — đúng dòng chảy của một hợp đồng đang sống.
 *
 * "Nháp" và "Đã huỷ" tách ra vì chúng nằm ngoài dòng chảy đó: nháp là đơn chưa
 * gửi, huỷ là đơn đã chết. Để cả sáu cột thì trên laptop 1280px cột cuối bị
 * đẩy khuất khỏi mép phải mà không có dấu hiệu gì báo là cuộn được — thẻ nằm
 * trong đó coi như biến mất. Bốn cột thì vừa màn, và hai cột kia bật lại bằng
 * một nút khi cần.
 */
const CORE_COLUMNS: ContractStatus[] = ["sent", "approved", "in_progress", "completed"];
const EXTRA_COLUMNS: ContractStatus[] = ["draft", "cancelled"];
export default function BoardView({ initial }: { initial: BoardCard[] }) {
  const [cards, setCards] = useState<BoardCard[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<ContractStatus | null>(null);
  const [showExtra, setShowExtra] = useState(false);
  const today = todayVN();

  // Vẫn giữ đúng thứ tự vòng đời khi bật thêm: nháp đứng đầu, huỷ đứng cuối.
  const columns = showExtra ? ["draft", ...CORE_COLUMNS, "cancelled"] as ContractStatus[] : CORE_COLUMNS;
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

  return (
    <div className="page-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Kéo thẻ hợp đồng sang cột khác để đổi trạng thái.</p>
        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          className="rounded-[9px] px-3 py-1.5 text-[12px] font-semibold"
          style={{ background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}
        >
          {showExtra ? "Ẩn nháp & đã huỷ" : `Hiện nháp & đã huỷ${extraCount ? ` (${extraCount})` : ""}`}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => { e.preventDefault(); setOver(col); }}
              onDragLeave={() => setOver((o) => (o === col ? null : o))}
              onDrop={() => { if (dragId) moveTo(dragId, col); setDragId(null); setOver(null); }}
              className="w-[270px] shrink-0 rounded-[14px] p-3"
              style={{ background: over === col ? "var(--sf2)" : "var(--sf)", border: `1px solid ${over === col ? "var(--acM)" : "var(--bd)"}` }}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: CONTRACT_STATUS_TONE[col].fg }} />
                <span className="text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)" }}>
                  {CONTRACT_STATUS_LABEL[col]}
                </span>
                <span className="ml-auto rounded-[20px] px-2 py-0.5 text-[10.5px] font-bold" style={{ background: CONTRACT_STATUS_TONE[col].bg, color: CONTRACT_STATUS_TONE[col].fg }}>
                  {colCards.length}
                </span>
              </div>
              <div className="space-y-2">
                {colCards.map((c) => {
                  const total = contractTotal(c.contract_items || []);
                  const tasks = c.contract_tasks || [];
                  const doneN = tasks.filter((t) => t.done).length;
                  const late = c.delivery_due && c.delivery_due < today && c.status !== "completed" && c.status !== "cancelled";
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setOver(null); }}
                      className="cursor-grab rounded-[11px] p-3 active:cursor-grabbing"
                      style={{ background: "var(--sf2)", border: "1px solid var(--bd)", opacity: dragId === c.id ? 0.5 : 1 }}
                    >
                      <Link href={`/dashboard/studio/contracts/${c.id}`} className="block">
                        <div className="flex items-start gap-2">
                          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[9.5px] font-bold" style={avatarStyle(c.client_name || c.title)}>
                            {initials(c.client_name || c.title)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold leading-snug">{c.title}</p>
                            <p className="mt-px truncate text-[11px]" style={{ color: "var(--tx3)" }}>{c.client_name || "—"}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--tx3)" }}>
                          <span className="tnum font-semibold" style={{ color: "var(--tx2)" }}>{vnd(total)}</span>
                          {tasks.length > 0 && <span>{doneN}/{tasks.length} việc</span>}
                        </div>
                        {(c.event_date || late) && (
                          <p className="mt-1 text-[11px] font-semibold" style={{ color: late ? "var(--rd)" : "var(--tx3)" }}>
                            {late ? `Trễ giao · hạn ${fmtDate(c.delivery_due)}` : `Chụp ${fmtDate(c.event_date)}`}
                          </p>
                        )}
                      </Link>
                    </div>
                  );
                })}
                {colCards.length === 0 && (
                  <p className="px-1 py-5 text-center text-[11px]" style={{ color: "var(--tx3)" }}>Kéo thẻ vào đây</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
