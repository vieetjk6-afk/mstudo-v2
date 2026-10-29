"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { contractTotal, vnd, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, type ContractStatus } from "@/lib/types";
import { avatarStyle, initials } from "@/lib/avatar";
import { fmtDate, todayVN } from "@/lib/date";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useBoard } from "./useBoard";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const BoardV2 = dynamic(() => import("./BoardV2"));

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

/** Giao diện mới → BoardV2; bản cũ giữ nguyên bên dưới. Logic chung (cột, kéo thả, đổi trạng thái) ở ./useBoard. */
export default function BoardView(props: { initial: BoardCard[] }) {
  return useUiV2() ? <BoardV2 {...props} /> : <BoardViewV1 {...props} />;
}

function BoardViewV1({ initial }: { initial: BoardCard[] }) {
  const { cards, dragId, over, showExtra, setShowExtra, columns, extraCount, columnDnd, cardDnd } = useBoard(initial);
  const today = todayVN();

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
              {...columnDnd(col)}
              /* Co giãn thay vì rộng cứng 270px. Từ khi có cột thứ 5 ("Đang hậu
               kỳ"), 5×270 + khoảng hở đã vượt màn laptop 1280px — cả bảng
               phải cuộn ngang mới thấy cột cuối. basis 228px cho 5 cột vừa
               một màn, max 320px để màn rộng cột khỏi giãn quá thưa, và khi
               hẹp hơn sàn 228px thì khung cha vẫn cuộn ngang như cũ. */
            className="min-w-[228px] max-w-[320px] flex-1 basis-[228px] rounded-[14px] p-3"
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
                      {...cardDnd(c.id)}
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
