"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Eye, EyeOff, FilePlus, FileText, KanbanSquare, ListChecks, MoreHorizontal, Search } from "lucide-react";
import { Avatar, Badge, Empty, PageHead, Stack, Toolbar, btn, iconBtn, type Tone } from "@/components/v2/kit";
import { Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, contractTotal, vndShort, type ContractStatus } from "@/lib/types";
import { fmtDate, fmtDayMonth, todayVN } from "@/lib/date";
import { daysToDue } from "@/lib/vendors";
import type { BoardCard } from "./BoardView";
import { useBoard } from "./useBoard";

/* ═══════════════════════════════════════════════════════════════════════════
   BẢNG CÔNG VIỆC — giao diện mới. Cùng dữ liệu, cùng kéo thả và cùng route
   đổi trạng thái với BoardView (bản cũ, logic chung ở ./useBoard); khác ở
   cách bày:
     • Một thanh: tìm khách/hợp đồng · nhóm (tất cả / trễ giao / sắp chụp) ·
       bật cột Nháp & Đã huỷ.
     • Cột gọn: chấm màu + tên + số thẻ + tổng giá trị cột; ô thả sáng lên khi
       kéo qua.
     • Thẻ gọn: tên hợp đồng (2 dòng), khách kèm avatar, một nhãn hạn (trễ giao
       / sắp giao / ngày chụp), số việc đã xong và giá trị.
     • Menu ⋯ trên thẻ: mở hợp đồng hoặc CHUYỂN CỘT không cần kéo — điện thoại
       không kéo thả được, nên đây là đường chuyển trạng thái trên máy nhỏ.
     • Điện thoại: các cột trượt ngang, mỗi lần một cột (snap).
   ═══════════════════════════════════════════════════════════════════════════ */

type Focus = "all" | "late" | "soon";

/** Sắp chụp = trong bao nhiêu ngày tới. */
const SOON_DAYS = 7;

const closed = (c: BoardCard) => c.status === "completed" || c.status === "cancelled";
/** Trễ giao — cùng luật với bản cũ. */
const isLate = (c: BoardCard, today: string) => !!c.delivery_due && c.delivery_due < today && !closed(c);
const isSoon = (c: BoardCard, today: string) => {
  const d = daysToDue(c.event_date, today);
  return !closed(c) && d !== null && d >= 0 && d <= SOON_DAYS;
};

/** Một nhãn hạn cho mỗi thẻ — chọn cái đáng chú ý nhất. */
function dueOf(c: BoardCard, today: string): { text: string; tone: Tone; title: string } | null {
  if (!closed(c) && c.delivery_due) {
    const d = daysToDue(c.delivery_due, today);
    if (d !== null && d < 0) return { text: `Trễ giao ${-d} ngày`, tone: "red", title: `Hạn giao ${fmtDate(c.delivery_due)}` };
    if (d !== null && d <= 3)
      return { text: d === 0 ? "Giao hôm nay" : `Giao trong ${d} ngày`, tone: "amber", title: `Hạn giao ${fmtDate(c.delivery_due)}` };
  }
  if (c.event_date) {
    const d = daysToDue(c.event_date, today);
    if (!closed(c) && d !== null && d >= 0) {
      const text = d === 0 ? "Chụp hôm nay" : d === 1 ? "Chụp ngày mai" : `Chụp ${fmtDayMonth(c.event_date)}`;
      return { text, tone: d <= 1 ? "amber" : "blue", title: `Ngày chụp ${fmtDate(c.event_date)}` };
    }
    if (!closed(c) && c.delivery_due)
      return { text: `Hạn giao ${fmtDayMonth(c.delivery_due)}`, tone: "gray", title: `Hạn giao ${fmtDate(c.delivery_due)}` };
    return { text: `Chụp ${fmtDayMonth(c.event_date)}`, tone: "gray", title: `Ngày chụp ${fmtDate(c.event_date)}` };
  }
  if (!closed(c) && c.delivery_due)
    return { text: `Hạn giao ${fmtDayMonth(c.delivery_due)}`, tone: "gray", title: `Hạn giao ${fmtDate(c.delivery_due)}` };
  return null;
}

const href = (id: string) => `/dashboard/studio/contracts/${id}`;
/** Tên cho avatar chữ cái — bỏ ngoặc, dấu câu. */
const avatarName = (c: BoardCard) => (c.client_name || c.title).replace(/[^\p{L}\p{N}\s]/gu, " ");

export default function BoardV2({ initial }: { initial: BoardCard[] }) {
  const { cards, dragId, over, showExtra, setShowExtra, columns, extraCount, moveTo, columnDnd, cardDnd } = useBoard(initial);
  const today = todayVN();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState<Focus>("all");

  const lateCount = useMemo(() => cards.filter((c) => isLate(c, today)).length, [cards, today]);
  const soonCount = useMemo(() => cards.filter((c) => isSoon(c, today)).length, [cards, today]);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (focus === "late" && !isLate(c, today)) return false;
      if (focus === "soon" && !isSoon(c, today)) return false;
      if (!n) return true;
      return c.title.toLowerCase().includes(n) || (c.client_name || "").toLowerCase().includes(n);
    });
  }, [cards, q, focus, today]);

  const filtering = !!q.trim() || focus !== "all";

  const cardMenu = (c: BoardCard): MenuItem[] => [
    { label: "Mở hợp đồng", icon: FileText, href: href(c.id) },
    "divider",
    ...columns
      .filter((s) => s !== c.status)
      .map((s) => ({
        label: `Chuyển sang “${CONTRACT_STATUS_LABEL[s]}”`,
        icon: ArrowRight,
        onClick: () => void moveTo(c.id, s),
      })),
  ];

  return (
    <Stack>
      <PageHead
        desc="Mỗi thẻ là một hợp đồng, mỗi cột là một trạng thái. Trên điện thoại, bấm ⋯ trên thẻ để chuyển cột."
        actions={
          <button type="button" className={btn("secondary")} onClick={() => setShowExtra((v) => !v)} aria-pressed={showExtra}>
            {showExtra ? <EyeOff size={16} /> : <Eye size={16} />}
            {showExtra ? "Ẩn nháp & đã huỷ" : "Hiện nháp & đã huỷ"}
            {!showExtra && extraCount ? (
              <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                {extraCount}
              </span>
            ) : null}
          </button>
        }
      />

      {cards.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={KanbanSquare}
            title="Chưa có hợp đồng nào trên bảng"
            hint="Mỗi hợp đồng là một thẻ. Tạo hợp đồng đầu tiên rồi kéo thẻ qua các cột theo tiến độ."
            action={
              <Link href="/dashboard/studio/contracts/new" className={btn("secondary")}>
                <FilePlus size={16} /> Tạo hợp đồng
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <Toolbar>
            <div className="min-w-[220px] flex-[1_1_260px]">
              <SearchInput value={q} onChange={setQ} placeholder="Tìm hợp đồng hoặc khách…" className="w-full" />
            </div>
            <Segmented<Focus>
              label="Lọc thẻ"
              value={focus}
              onChange={setFocus}
              options={[
                { value: "all", label: "Tất cả", count: cards.length },
                { value: "late", label: "Trễ giao", count: lateCount },
                { value: "soon", label: `Chụp ${SOON_DAYS} ngày tới`, count: soonCount },
              ]}
            />
          </Toolbar>

          {/* Điện thoại: dải nhảy nhanh tới từng cột (cột trượt ngang nên không thấy hết một lúc). */}
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:hidden" style={{ scrollbarWidth: "none" }}>
            {columns.map((col) => (
              <button
                key={col}
                type="button"
                className={btn("secondary", "sm", "gap-1.5")}
                onClick={() => document.getElementById(`bv-col-${col}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: CONTRACT_STATUS_TONE[col].fg }} />
                {CONTRACT_STATUS_LABEL[col]}
                <span className="v2-num text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {visible.filter((c) => c.status === col).length}
                </span>
              </button>
            ))}
          </div>

          {/* Máy tính: các cột chia đều bề ngang; bật thêm cột thì cuộn ngang trong khung.
              Điện thoại: mỗi cột ~84% bề ngang, trượt ngang từng cột một. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 lg:snap-none" style={{ scrollPaddingInline: 16 }}>
            {columns.map((col) => {
              const all = cards.filter((c) => c.status === col);
              const colCards = visible.filter((c) => c.status === col);
              const total = colCards.reduce((s, c) => s + contractTotal(c.contract_items || []), 0);
              const tone = CONTRACT_STATUS_TONE[col];
              const isOver = over === col;
              return (
                <section
                  key={col}
                  id={`bv-col-${col}`}
                  aria-label={`Cột ${CONTRACT_STATUS_LABEL[col]}`}
                  {...columnDnd(col)}
                  className="flex w-[84vw] max-w-[340px] flex-none snap-start flex-col rounded-[16px] sm:w-[300px] lg:w-auto lg:min-w-[208px] lg:max-w-none lg:flex-1 lg:basis-0"
                  style={{
                    background: isOver ? "color-mix(in srgb, var(--ac) 7%, var(--sf2))" : "var(--sf2)",
                    border: `1px solid ${isOver ? "var(--ac)" : "var(--bd)"}`,
                    transition: "background-color .12s ease, border-color .12s ease",
                  }}
                >
                  <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: tone.fg }} />
                    <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{CONTRACT_STATUS_LABEL[col]}</h3>
                    <span
                      className="v2-num flex-none rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                      title={filtering ? `${colCards.length} / ${all.length} thẻ khớp bộ lọc` : `${all.length} thẻ`}
                    >
                      {filtering ? `${colCards.length}/${all.length}` : all.length}
                    </span>
                  </header>
                  <p className="v2-num px-3.5 pb-2.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                    {total > 0 ? `Tổng ${vndShort(total)}` : "Chưa có giá trị"}
                  </p>
                  <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                    {colCards.map((c) => (
                      <BoardCardV2 key={c.id} c={c} today={today} dragging={dragId === c.id} dnd={cardDnd(c.id)} menu={cardMenu(c)} />
                    ))}
                    {colCards.length === 0 && (
                      <div
                        className="flex min-h-[88px] flex-1 items-center justify-center rounded-[12px] px-3 text-center text-[12.5px]"
                        style={{ border: "1.5px dashed var(--bd)", color: "var(--tx3)" }}
                      >
                        {filtering && all.length ? "Không có thẻ khớp lọc" : "Kéo thẻ vào đây"}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {filtering && visible.length === 0 ? (
            <div className="v2-card">
              <Empty
                compact
                icon={Search}
                title="Không có thẻ nào khớp"
                hint="Thử gõ ít chữ hơn hoặc chọn “Tất cả”."
                action={
                  <button type="button" className={btn("ghost")} onClick={() => { setQ(""); setFocus("all"); }}>
                    Xoá lọc
                  </button>
                }
              />
            </div>
          ) : null}
        </>
      )}
    </Stack>
  );
}

/* ── Một thẻ hợp đồng ──────────────────────────────────────────────────── */
function BoardCardV2({
  c,
  today,
  dragging,
  dnd,
  menu,
}: {
  c: BoardCard;
  today: string;
  dragging: boolean;
  dnd: ReturnType<ReturnType<typeof useBoard>["cardDnd"]>;
  menu: MenuItem[];
}) {
  const total = contractTotal(c.contract_items || []);
  const tasks = c.contract_tasks || [];
  const doneN = tasks.filter((t) => t.done).length;
  const due = dueOf(c, today);
  return (
    <article
      {...dnd}
      className="group relative cursor-grab rounded-[12px] p-3 active:cursor-grabbing"
      style={{
        background: "var(--sf)",
        border: "1px solid var(--bd)",
        boxShadow: "var(--v2-shadow)",
        opacity: dragging ? 0.5 : 1,
      }}
    >
      {/* Lớp bấm phủ cả thẻ → mở hợp đồng; menu ⋯ nằm trên lớp này. */}
      <Link href={href(c.id)} className="absolute inset-0 rounded-[12px]" aria-label={`Mở hợp đồng ${c.title}`} />
      <div className="pointer-events-none flex items-start gap-2">
        <p className="line-clamp-2 min-w-0 flex-1 text-[13.5px] font-semibold leading-snug" title={c.title}>
          {c.title}
        </p>
        <div className="pointer-events-auto relative -mr-1.5 -mt-1.5">
          <Menu
            items={menu}
            label={`Thao tác cho ${c.title}`}
            width={240}
            trigger={({ open, toggle }) => (
              <button type="button" onClick={toggle} aria-label={`Thao tác cho ${c.title}`} aria-expanded={open} className={iconBtn("!h-8 !w-8")}>
                <MoreHorizontal size={16} />
              </button>
            )}
          />
        </div>
      </div>
      <div className="pointer-events-none mt-1.5 flex min-w-0 items-center gap-2">
        <Avatar name={avatarName(c)} size={22} />
        <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: c.client_name ? "var(--tx2)" : "var(--tx3)" }}>
          {c.client_name || "Chưa có tên khách"}
        </span>
        {total > 0 ? (
          <span className="v2-num flex-none text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
            {vndShort(total)}
          </span>
        ) : null}
      </div>
      {(due || tasks.length > 0) && (
        <div className="pointer-events-none mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {due ? (
            <span title={due.title}>
              <Badge tone={due.tone} dot={due.tone === "red" || due.tone === "amber"} icon={due.tone === "blue" || due.tone === "gray" ? CalendarDays : undefined}>
                {due.text}
              </Badge>
            </span>
          ) : null}
          {tasks.length > 0 ? (
            <span
              className="v2-num flex items-center gap-1 text-[12px] font-medium"
              style={{ color: doneN === tasks.length ? "var(--gn)" : "var(--tx3)" }}
              title={`${doneN}/${tasks.length} việc đã xong`}
            >
              <ListChecks size={13} /> {doneN}/{tasks.length}
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}
