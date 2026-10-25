"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive, Bot, Check, Clock, FilePlus, Inbox, MessageCircle, MessagesSquare, Phone, PhoneCall, ReceiptText, RotateCcw,
  Search, Sparkles,
} from "lucide-react";
import { Avatar, Badge, Empty, GroupLabel, PageHead, Stack, Stat, StatGrid, Toolbar, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { noAccent } from "@/lib/studio-nav";
import type { Lead } from "./LeadsView";
import { useLeads, fmtLeadTime, zaloUrl } from "./useLeads";

/* ═══════════════════════════════════════════════════════════════════════════
   YÊU CẦU MỚI — giao diện mới. Cùng dữ liệu, cùng thao tác với LeadsView
   (bản cũ, logic chung ở ./useLeads); khác ở cách sắp xếp:
     • 4 số liệu: chờ gọi lại · đã liên hệ · 7 ngày qua · tỉ lệ đã liên hệ.
     • Thanh lọc: tìm (tên, số, nhu cầu) · trạng thái · sắp xếp. Mặc định mở
       nhóm "Chờ gọi lại" khi còn yêu cầu mới.
     • Danh sách nhóm theo thời gian (hôm nay / 7 ngày qua / cũ hơn). Bấm một
       dòng mở NGĂN KÉO: hội thoại chatbox, gọi, Zalo, tạo báo giá/hợp đồng,
       đánh dấu đã liên hệ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filter = "new" | "contacted" | "closed" | "all";

const STATUS: Record<Lead["status"], { label: string; tone: Tone }> = {
  new: { label: "Chờ gọi lại", tone: "amber" },
  contacted: { label: "Đã liên hệ", tone: "green" },
  closed: { label: "Đã đóng", tone: "gray" },
};

const DAY = 86_400_000;

export default function LeadsV2({ leads }: { leads: Lead[] }) {
  const { rows, setStatus, newCount } = useLeads(leads);
  const [filter, setFilter] = useState<Filter>(() => (leads.some((l) => l.status === "new") ? "new" : "all"));
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId ? rows.find((r) => r.id === peekId) ?? null : null;
  const [now] = useState(() => Date.now());

  const counts = useMemo(
    () => ({
      new: newCount,
      contacted: rows.filter((r) => r.status === "contacted").length,
      closed: rows.filter((r) => r.status === "closed").length,
      all: rows.length,
      week: rows.filter((r) => now - new Date(r.created_at).getTime() < 7 * DAY).length,
    }),
    [rows, newCount, now],
  );
  const handledPct = rows.length ? Math.round(((rows.length - newCount) / rows.length) * 100) : 0;

  const groups = useMemo(() => {
    const needle = noAccent(q.trim());
    const list = rows
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !needle || noAccent(`${r.name ?? ""} ${r.phone ?? ""} ${r.interest ?? ""}`).includes(needle))
      .sort((a, b) => (sort === "newest" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)));
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const t0 = startToday.getTime();
    const buckets: { key: string; label: string; rows: Lead[] }[] = [
      { key: "today", label: "Hôm nay", rows: [] },
      { key: "week", label: "7 ngày qua", rows: [] },
      { key: "older", label: "Cũ hơn", rows: [] },
    ];
    for (const r of list) {
      const t = new Date(r.created_at).getTime();
      buckets[t >= t0 ? 0 : t >= t0 - 6 * DAY ? 1 : 2].rows.push(r);
    }
    const out = buckets.filter((b) => b.rows.length);
    return sort === "newest" ? out : out.reverse();
  }, [rows, filter, q, sort, now]);
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);

  const menuFor = (r: Lead): MenuItem[] => [
    { label: "Xem hội thoại", icon: MessagesSquare, onClick: () => setPeekId(r.id) },
    r.status === "new"
      ? { label: "Đánh dấu đã liên hệ", icon: Check, onClick: () => void setStatus(r.id, "contacted") }
      : { label: "Đánh dấu lại là mới", icon: RotateCcw, onClick: () => void setStatus(r.id, "new") },
    "divider",
    { label: "Tạo báo giá", icon: ReceiptText, href: "/dashboard/studio/quotes/new" },
    { label: "Tạo hợp đồng", icon: FilePlus, href: "/dashboard/studio/contracts/new" },
    ...(r.status !== "closed"
      ? (["divider", { label: "Đóng yêu cầu", hint: "Không cần theo dõi nữa", icon: Archive, onClick: () => void setStatus(r.id, "closed") }] as MenuItem[])
      : []),
  ];

  const contactBtns = (r: Lead) =>
    r.phone ? (
      <>
        <a href={`tel:${r.phone}`} className={iconBtn()} aria-label={`Gọi ${r.phone}`} title={`Gọi ${r.phone}`} onClick={(e) => e.stopPropagation()}>
          <Phone size={16} />
        </a>
        <a
          href={zaloUrl(r.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn()}
          aria-label="Nhắn Zalo"
          title="Nhắn Zalo"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle size={16} />
        </a>
      </>
    ) : null;

  const displayName = (r: Lead) => r.name || "Khách (chưa cho tên)";

  return (
    <Stack>
      <PageHead desc="Khách để lại số qua chatbox và website. Gọi hoặc nhắn Zalo lại rồi đánh dấu đã liên hệ, để không ai bị bỏ quên." />

      <StatGrid>
        <Stat icon={PhoneCall} tone="amber" label="Chờ gọi lại" value={counts.new} valueTone={counts.new ? "amber" : undefined} sub={counts.new ? "Khách đang đợi phản hồi" : "Đã gọi hết"} />
        <Stat icon={Check} tone="green" label="Đã liên hệ" value={counts.contacted} />
        <Stat icon={Clock} tone="blue" label="7 ngày qua" value={counts.week} sub="Yêu cầu mới gửi tới" />
        <Stat icon={Sparkles} tone="brand" label="Tỉ lệ đã xử lý" value={`${handledPct}%`} sub={`${rows.length} yêu cầu`} />
      </StatGrid>

      {rows.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Inbox}
            title="Chưa có yêu cầu nào"
            hint="Khách để lại số điện thoại qua chatbox trên website sẽ hiện ở đây, kèm báo Zalo cho bạn."
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              {/* .v2-search tự đặt min-width: 0, nên giữ bề rộng tối thiểu ở lớp bọc. */}
              <div className="min-w-[220px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, số điện thoại, nhu cầu…" className="w-full" />
              </div>
              <Segmented<Filter>
                label="Trạng thái"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "new", label: "Chờ gọi lại", count: counts.new },
                  { value: "contacted", label: "Đã liên hệ", count: counts.contacted },
                  ...(counts.closed ? [{ value: "closed" as const, label: "Đã đóng", count: counts.closed }] : []),
                  { value: "all", label: "Tất cả", count: counts.all },
                ]}
              />
              <select aria-label="Sắp xếp" className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")}>
                <option value="newest">Mới nhất trước</option>
                <option value="oldest">Cũ nhất trước</option>
              </select>
            </Toolbar>
          </div>

          {shown === 0 ? (
            <Empty
              compact
              icon={filter === "new" && !q ? Check : Search}
              title={filter === "new" && !q ? "Đã gọi lại hết khách" : "Không có yêu cầu nào khớp"}
              hint={filter === "new" && !q ? "Yêu cầu mới từ chatbox sẽ hiện ở đây." : "Chọn nhóm khác hoặc gõ ít chữ hơn."}
            />
          ) : (
            <>
              {/* Máy tính: bảng */}
              <div className="v2-table-wrap hidden md:block">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>Khách</th>
                      <th>Quan tâm</th>
                      <th style={{ width: 150 }}>Gửi lúc</th>
                      <th style={{ width: 140 }}>Trạng thái</th>
                      <th style={{ width: 210 }} aria-label="Thao tác" />
                    </tr>
                  </thead>
                  {groups.map((g) => (
                    <tbody key={g.key}>
                      <tr className="pointer-events-none">
                        <td colSpan={5} style={{ background: "var(--sf2)", paddingTop: 8, paddingBottom: 8 }}>
                          <GroupLabel count={`${g.rows.length} yêu cầu`}>{g.label}</GroupLabel>
                        </td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.id} className="cursor-pointer" onClick={() => setPeekId(r.id)}>
                          <td>
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={r.name || r.phone || "?"} size={36} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold" style={r.name ? undefined : { color: "var(--tx2)" }}>{displayName(r)}</p>
                                <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{r.phone || "Không có số"}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <p className="line-clamp-2 text-[13px]" style={{ color: r.interest ? "var(--tx2)" : "var(--tx3)" }}>
                              {r.interest || "Chưa nói nhu cầu"}
                            </p>
                          </td>
                          <td className="v2-num whitespace-nowrap text-[13px]" style={{ color: "var(--tx2)" }}>{fmtLeadTime(r.created_at)}</td>
                          <td>
                            <Badge tone={STATUS[r.status].tone} dot>{STATUS[r.status].label}</Badge>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {r.status === "new" ? (
                                <button type="button" onClick={() => setStatus(r.id, "contacted")} className={btn("soft", "sm", "mr-1")}>
                                  <Check size={14} /> Đã liên hệ
                                </button>
                              ) : null}
                              {contactBtns(r)}
                              <Menu label="Thêm thao tác" width={230} items={menuFor(r)} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>

              {/* Điện thoại: dòng gọn, chạm để mở */}
              <div className="md:hidden">
                {groups.map((g) => (
                  <div key={g.key}>
                    <div className="px-4 py-2" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                      <GroupLabel count={g.rows.length}>{g.label}</GroupLabel>
                    </div>
                    {g.rows.map((r) => (
                      <div key={r.id} className="flex items-center gap-1 pr-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                        <button type="button" onClick={() => setPeekId(r.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
                          <Avatar name={r.name || r.phone || "?"} size={38} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5">
                              {r.status === "new" ? <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} aria-label="Chờ gọi lại" /> : null}
                              <span className="truncate text-[14px] font-semibold">{displayName(r)}</span>
                            </p>
                            <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                              {r.interest || r.phone || "Chưa nói nhu cầu"}
                            </p>
                            <p className="text-[12px]" style={{ color: "var(--tx3)" }}>{fmtLeadTime(r.created_at)}</p>
                          </div>
                        </button>
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className={iconBtn()} aria-label={`Gọi ${r.phone}`}>
                            <Phone size={16} />
                          </a>
                        ) : null}
                        <Menu label="Thêm thao tác" width={230} items={menuFor(r)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <Drawer
        open={!!peek}
        onClose={() => setPeekId(null)}
        title={peek ? displayName(peek) : ""}
        desc={peek ? `Gửi lúc ${fmtLeadTime(peek.created_at)}` : undefined}
        footer={
          peek ? (
            <>
              {peek.status === "new" ? (
                <button type="button" onClick={() => setStatus(peek.id, "contacted")} className={btn("primary", "md", "ml-auto")}>
                  <Check size={16} /> Đã liên hệ
                </button>
              ) : (
                <button type="button" onClick={() => setStatus(peek.id, "new")} className={btn("ghost", "md", "ml-auto")}>
                  <RotateCcw size={16} /> Đánh dấu lại là mới
                </button>
              )}
            </>
          ) : null
        }
      >
        {peek ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar name={peek.name || peek.phone || "?"} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{peek.phone || "Không có số điện thoại"}</p>
                <div className="mt-1">
                  <Badge tone={STATUS[peek.status].tone} dot>{STATUS[peek.status].label}</Badge>
                </div>
              </div>
            </div>

            {peek.phone ? (
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${peek.phone}`} className={btn("secondary", "md", "w-full")}>
                  <Phone size={16} /> Gọi
                </a>
                <a href={zaloUrl(peek.phone)} target="_blank" rel="noopener noreferrer" className={btn("secondary", "md", "w-full")}>
                  <MessageCircle size={16} /> Nhắn Zalo
                </a>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Khách quan tâm</p>
              <p className="rounded-[10px] px-3 py-2.5 text-[13.5px]" style={{ background: "var(--sf2)", color: peek.interest ? "var(--tx)" : "var(--tx3)" }}>
                {peek.interest || "Khách chưa nói nhu cầu."}
              </p>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
                <Bot size={14} /> Hội thoại chatbox
              </p>
              {(peek.transcript ?? []).length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Không có nội dung hội thoại.</p>
              ) : (
                <div className="flex flex-col gap-2 rounded-[12px] p-3" style={{ background: "var(--sf2)" }}>
                  {(peek.transcript ?? []).map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] leading-relaxed"
                        style={
                          m.role === "user"
                            ? { background: "var(--ac)", color: "#fff", borderBottomRightRadius: 4 }
                            : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx2)", borderBottomLeftRadius: 4 }
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Bước tiếp theo</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/studio/quotes/new" className={btn("secondary", "sm")}>
                  <ReceiptText size={14} /> Tạo báo giá
                </Link>
                <Link href="/dashboard/studio/contracts/new" className={btn("secondary", "sm")}>
                  <FilePlus size={14} /> Tạo hợp đồng
                </Link>
                {peek.status !== "closed" ? (
                  <button type="button" onClick={() => setStatus(peek.id, "closed")} className={btn("ghost", "sm")}>
                    <Archive size={14} /> Đóng yêu cầu
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </Stack>
  );
}
