"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FilePlus,
  Eye,
  ExternalLink,
  ReceiptText,
  Search,
  Clock,
  Wallet,
  CheckCircle2,
  MessageSquareWarning,
  Copy,
  FileText,
  ArrowRight,
  Phone,
  Repeat,
  Link2,
  FileStack,
} from "lucide-react";
import { vnd, vndShort, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/types";
import { daysFromToday, fmtDate, fmtDateTime, fmtDow } from "@/lib/date";
import { studioUrl } from "@/lib/hosts";
import { noAccent } from "@/lib/studio-nav";
import {
  Avatar,
  Badge,
  Callout,
  Empty,
  Field,
  GroupLabel,
  InfoList,
  PageHead,
  Stack,
  Stat,
  StatGrid,
  Toolbar,
  btn,
  iconBtn,
  inputCls,
  type Tone,
} from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import type { QuoteRow, QuotesListProps } from "./QuotesListView";
import { quotePipeline, quoteStillOpen, quoteTotal, quoteWaiting, useQuoteRows } from "./quotes-list-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   BÁO GIÁ — giao diện mới. Cùng dữ liệu, cùng thao tác với QuotesListView
   (bản cũ); khác ở cách sắp xếp:
     • 4 số liệu: đang chờ khách · giá trị đang chờ · khách đồng ý · tổng số.
     • Yêu cầu chỉnh của khách nổi lên đầu trang (thông báo + nhóm "Cần xử lý").
     • Một thanh lọc: tìm · nhóm · sắp xếp. Danh sách nhóm theo việc tiếp theo.
     • Bấm một dòng mở ngăn xem nhanh (giá trị, hiệu lực, đổi trạng thái) kèm
       nút "Mở báo giá"; menu ⋯ có trang khách, chép link, đổi trạng thái.
   ═══════════════════════════════════════════════════════════════════════════ */

type Bucket = "attention" | "waiting" | "draft" | "won" | "closed";
type View = "all" | Bucket;
type Sort = "group" | "created" | "value" | "event";

const STATUS_TONE: Record<QuoteStatus, Tone> = {
  draft: "gray",
  sent: "amber",
  viewed: "blue",
  adjust_requested: "amber",
  accepted: "green",
  converted: "green",
  expired: "gray",
  cancelled: "red",
};

const BUCKETS: { key: Bucket; label: string; view: string; dot: string }[] = [
  { key: "attention", label: "Cần xử lý", view: "Cần xử lý", dot: "var(--rd)" },
  { key: "waiting", label: "Đang chờ khách", view: "Chờ khách", dot: "var(--am)" },
  { key: "draft", label: "Nháp, chưa gửi", view: "Nháp", dot: "var(--tx3)" },
  { key: "won", label: "Khách đã đồng ý", view: "Đã chốt", dot: "var(--gn)" },
  { key: "closed", label: "Hết hạn hoặc đã huỷ", view: "Đã đóng", dot: "var(--rd)" },
];

const SORTS: [Sort, string][] = [
  ["group", "Theo việc cần làm"],
  ["created", "Mới tạo trước"],
  ["value", "Giá trị cao trước"],
  ["event", "Ngày chụp gần nhất"],
];

const pendingAdj = (q: QuoteRow) => (q.quote_adjustments || []).filter((a) => !a.resolved).length;

/** Mỗi báo giá vào đúng MỘT nhóm, theo việc studio cần làm tiếp. */
function bucketOf(q: QuoteRow, nowMs: number): Bucket {
  if (q.status === "accepted" || q.status === "converted") return "won";
  if (q.status === "draft") return "draft";
  if (q.status === "expired" || q.status === "cancelled" || !quoteStillOpen(q, nowMs)) return "closed";
  if (q.status === "adjust_requested" || pendingAdj(q) > 0) return "attention";
  return quoteWaiting(q, nowMs) ? "waiting" : "closed";
}

/** Hiệu lực: "Đến 01/09" · "Hết hạn hôm nay" · "Quá hạn 3 ngày" · "Không giới hạn". */
function validity(q: QuoteRow): { text: string; tone: Tone } {
  if (!q.expires_at) return { text: "Không giới hạn", tone: "gray" };
  const d = daysFromToday(q.expires_at);
  if (d === null) return { text: fmtDate(q.expires_at), tone: "gray" };
  if (d < 0) return { text: `Quá hạn ${-d} ngày`, tone: "red" };
  if (d === 0) return { text: "Hết hạn hôm nay", tone: "amber" };
  if (d <= 3) return { text: `Còn ${d} ngày`, tone: "amber" };
  return { text: `Đến ${fmtDate(q.expires_at)}`, tone: "gray" };
}

const toneVar = (t: Tone) => (({ red: "var(--rd)", amber: "var(--am)", green: "var(--gn)" }) as Record<string, string>)[t] ?? "var(--tx3)";

export default function QuotesListV2({ list: initialList, studioHost = null }: QuotesListProps) {
  const { rows, updating, changeStatus } = useQuoteRows(initialList);
  // Mốc "bây giờ" chốt một lần lúc mở màn — để nhóm không nhảy giữa các lần vẽ.
  const [nowMs] = useState(() => Date.now());
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("group");
  const [peekId, setPeekId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const pipe = useMemo(() => quotePipeline(rows, nowMs), [rows, nowMs]);
  const withBucket = useMemo(() => rows.map((r) => ({ r, b: bucketOf(r, nowMs) })), [rows, nowMs]);
  const attention = withBucket.filter((x) => x.b === "attention").length;
  const drafts = withBucket.filter((x) => x.b === "draft").length;

  const searched = useMemo(() => {
    const needle = noAccent(q.trim());
    if (!needle) return withBucket;
    return withBucket.filter(({ r }) =>
      noAccent([r.title, r.code, r.client_name, r.client_phone].filter(Boolean).join(" ")).includes(needle),
    );
  }, [withBucket, q]);

  const countOf = (v: View) => (v === "all" ? searched.length : searched.filter((x) => x.b === v).length);

  const groups = useMemo(() => {
    const list = searched.filter((x) => view === "all" || x.b === view);
    if (sort === "group") {
      return BUCKETS.map((b) => ({
        key: b.key,
        label: b.label,
        dot: b.dot,
        rows: list.filter((x) => x.b === b.key).map((x) => x.r),
      })).filter((g) => g.rows.length > 0);
    }
    const rs = list.map((x) => x.r);
    // Server đã trả "mới tạo trước" — giữ nguyên thứ tự đó cho kiểu mặc định.
    if (sort === "value") rs.sort((a, b) => quoteTotal(b) - quoteTotal(a));
    if (sort === "event") rs.sort((a, b) => (a.event_date || "9999").localeCompare(b.event_date || "9999"));
    return rs.length ? [{ key: sort, label: SORTS.find(([k]) => k === sort)?.[1] ?? "", dot: "var(--ac)", rows: rs }] : [];
  }, [searched, view, sort]);

  const viewOptions = [
    { value: "all" as View, label: "Tất cả", count: countOf("all") },
    ...BUCKETS.filter((b) => b.key !== "attention" || attention > 0 || view === "attention").map((b) => ({
      value: b.key as View,
      label: b.view,
      count: countOf(b.key),
    })),
  ];

  const peek = peekId ? (rows.find((r) => r.id === peekId) ?? null) : null;
  const publicUrl = (r: QuoteRow) => studioUrl(studioHost, `/q/${r.client_token}`);

  async function copyLink(r: QuoteRow) {
    try {
      await navigator.clipboard.writeText(publicUrl(r));
      setToast("Đã chép link báo giá cho khách");
    } catch {
      setToast("Không chép được, hãy mở trang khách rồi chép từ thanh địa chỉ");
    }
  }

  const rowMenu = (r: QuoteRow): MenuItem[] => [
    { label: "Xem nhanh", icon: Eye, onClick: () => setPeekId(r.id) },
    { label: "Mở báo giá", icon: FileText, href: `/dashboard/studio/quotes/${r.id}` },
    "divider",
    { label: "Mở trang khách", icon: ExternalLink, href: publicUrl(r), external: true },
    { label: "Chép link gửi khách", icon: Copy, onClick: () => copyLink(r) },
    "divider",
    { label: "Đổi trạng thái…", icon: Repeat, onClick: () => setPeekId(r.id) },
  ];

  const statBtn = "block w-full rounded-[16px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ac)]";

  return (
    <Stack>
      <PageHead
        desc="Gửi báo giá qua link riêng. Khách bấm đồng ý là hợp đồng tự sinh ra."
        actions={
          <Link href="/dashboard/studio/quotes/new" className={btn("primary")} data-testid="quote-new-btn">
            <FilePlus size={17} /> Báo giá mới
          </Link>
        }
      />

      {attention > 0 && view !== "attention" && (
        <Callout
          tone="amber"
          icon={MessageSquareWarning}
          title={`${attention} báo giá khách đang xin chỉnh`}
          action={
            <button type="button" className={btn("secondary", "sm")} onClick={() => setView("attention")}>
              Xem ngay
            </button>
          }
        >
          Khách đã gửi yêu cầu sửa và đang chờ studio trả lời.
        </Callout>
      )}

      <StatGrid>
        <button type="button" className={statBtn} onClick={() => setView("waiting")} aria-label="Xem báo giá đang chờ khách">
          <Stat
            icon={Clock}
            tone="amber"
            label="Đang chờ khách"
            value={pipe.waiting.length}
            valueTone={pipe.waiting.length ? "amber" : undefined}
            sub="Đã gửi, còn hạn"
          />
        </button>
        <Stat icon={Wallet} tone="brand" label="Giá trị đang chờ" value={vndShort(pipe.waitingValue)} sub="Nếu khách đồng ý hết" />
        <button type="button" className={statBtn} onClick={() => setView("won")} aria-label="Xem báo giá khách đã đồng ý">
          <Stat
            icon={CheckCircle2}
            tone="green"
            label="Khách đồng ý"
            value={pipe.won.length}
            valueTone={pipe.won.length ? "green" : undefined}
            sub={`Tỉ lệ ${pipe.rate}% trên báo giá đã gửi`}
          />
        </button>
        <Stat
          icon={FileStack}
          tone="blue"
          label="Báo giá đã tạo"
          value={rows.length}
          sub={drafts ? `${drafts} bản nháp chưa gửi` : "Không có bản nháp"}
        />
      </StatGrid>

      {rows.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={ReceiptText}
            title="Chưa có báo giá nào"
            hint="Ghép gói và hạng mục, gửi link cho khách. Khách đồng ý là hợp đồng tự sinh ra."
            action={
              <Link href="/dashboard/studio/quotes/new" className={btn("primary")}>
                <FilePlus size={17} /> Tạo báo giá
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="v2-card v2-card-pad flex flex-col gap-3">
            <Toolbar>
              <div className="min-w-[240px] flex-[1_1_240px]">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm tên báo giá, khách, mã, SĐT…" className="w-full" />
              </div>
              <select aria-label="Sắp xếp" className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {SORTS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              {/* Nhóm đứng riêng một hàng: là bộ lọc dùng nhiều nhất. */}
              <div className="w-full min-w-0">
                <Segmented label="Nhóm báo giá" value={view} onChange={setView} options={viewOptions} />
              </div>
            </Toolbar>
            {q || view !== "all" ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                {groups.reduce((n, g) => n + g.rows.length, 0)} / {rows.length} báo giá ·{" "}
                <button
                  type="button"
                  className="font-semibold"
                  style={{ color: "var(--ac)" }}
                  onClick={() => {
                    setQ("");
                    setView("all");
                  }}
                >
                  Xoá lọc
                </button>
              </p>
            ) : null}
          </div>

          {groups.length === 0 ? (
            <div className="v2-card">
              <Empty compact icon={Search} title="Không có báo giá nào khớp" hint="Thử tìm bằng từ khác hoặc chọn nhóm khác." />
            </div>
          ) : (
            <div className="v2-card overflow-hidden">
              <QuoteTable groups={groups} onPeek={setPeekId} menu={rowMenu} />
              <QuoteCards groups={groups} onPeek={setPeekId} menu={rowMenu} />
            </div>
          )}
        </>
      )}

      <QuotePeek
        r={peek}
        onClose={() => setPeekId(null)}
        publicUrl={peek ? publicUrl(peek) : ""}
        updating={!!peek && updating === peek.id}
        onStatus={(s) => peek && changeStatus(peek.id, s)}
        onCopy={() => peek && copyLink(peek)}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
          style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}
        >
          {toast}
        </div>
      )}
    </Stack>
  );
}

function StatusCell({ r }: { r: QuoteRow }) {
  const n = pendingAdj(r);
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={STATUS_TONE[r.status]} dot>
        {QUOTE_STATUS_LABEL[r.status]}
      </Badge>
      {n > 0 && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--am)" }}>
          {n} yêu cầu chỉnh chưa xử lý
        </span>
      )}
    </div>
  );
}

/* ── Bảng (máy tính) ────────────────────────────────────────────────────── */
type Group = { key: string; label: string; dot: string; rows: QuoteRow[] };

/** Nhãn nhóm nằm TRONG danh sách: chấm màu + tên nhóm + số dòng. */
function GroupHead({ g }: { g: Group }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: g.dot }} />
      <GroupLabel count={`${g.rows.length} báo giá`}>{g.label}</GroupLabel>
    </div>
  );
}

/** Tên cho avatar chữ cái — bỏ ngoặc, dấu câu để không ra "P(". */
const avatarName = (r: QuoteRow) => (r.client_name || r.title).replace(/[^\p{L}\p{N}\s]/gu, " ");

function QuoteTable({ groups, onPeek, menu }: { groups: Group[]; onPeek: (id: string) => void; menu: (r: QuoteRow) => MenuItem[] }) {
  return (
    <div className="v2-table-wrap hidden lg:block">
      <table className="v2-table" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th>Khách · báo giá</th>
            <th className="num" style={{ width: 150 }}>
              Giá trị
            </th>
            <th className="hidden xl:table-cell" style={{ width: 150 }}>
              Ngày chụp
            </th>
            <th style={{ width: 150 }}>Hiệu lực</th>
            <th style={{ width: 200 }}>Trạng thái</th>
            <th style={{ width: 56 }} aria-label="Thao tác" />
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            <tr>
              <td colSpan={6} style={{ background: "var(--sf2)", padding: "8px 16px" }}>
                <GroupHead g={g} />
              </td>
            </tr>
            {g.rows.map((r) => {
              const v = validity(r);
              const closed = r.status === "accepted" || r.status === "converted" || r.status === "cancelled" || r.status === "expired";
              return (
                <tr key={r.id} className="cursor-pointer" onClick={() => onPeek(r.id)}>
                  <td>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={avatarName(r)} size={36} />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="block max-w-full truncate text-left text-[14px] font-semibold"
                          title={r.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPeek(r.id);
                          }}
                        >
                          {r.title}
                        </button>
                        <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {[r.code, r.client_name, r.client_phone].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <p className="text-[14px] font-semibold">{vnd(quoteTotal(r))}</p>
                    <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                      {(r.quote_items || []).length} hạng mục
                    </p>
                  </td>
                  <td className="hidden xl:table-cell">
                    {r.event_date ? (
                      <span className="whitespace-nowrap text-[13.5px]">
                        {fmtDow(r.event_date)} · {fmtDate(r.event_date)}
                      </span>
                    ) : (
                      <span className="text-[13px]" style={{ color: "var(--tx3)" }}>
                        Chưa có ngày
                      </span>
                    )}
                  </td>
                  <td>
                    <p
                      className="whitespace-nowrap text-[13px] font-medium"
                      style={{ color: closed ? "var(--tx3)" : v.tone === "gray" ? "var(--tx)" : toneVar(v.tone) }}
                    >
                      {closed && r.expires_at ? `Đến ${fmtDate(r.expires_at)}` : v.text}
                    </p>
                    <p className="whitespace-nowrap text-[12px]" style={{ color: "var(--tx3)" }}>
                      Tạo {fmtDate(r.created_at)}
                    </p>
                  </td>
                  <td>
                    <StatusCell r={r} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="text-right">
                    <Menu items={menu(r)} label={`Thao tác cho ${r.title}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* ── Thẻ gọn (điện thoại, máy tính bảng) ────────────────────────────────── */
function QuoteCards({ groups, onPeek, menu }: { groups: Group[]; onPeek: (id: string) => void; menu: (r: QuoteRow) => MenuItem[] }) {
  return (
    <div className="lg:hidden">
      {groups.map((g) => (
        <ul key={g.key}>
          <li className="px-4 py-2" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
            <GroupHead g={g} />
          </li>
          {g.rows.map((r) => {
            const v = validity(r);
            const n = pendingAdj(r);
            const open = !(r.status === "accepted" || r.status === "converted" || r.status === "cancelled" || r.status === "expired");
            return (
              <li key={r.id} className="relative flex gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <button type="button" className="absolute inset-0" aria-label={`Xem nhanh ${r.title}`} onClick={() => onPeek(r.id)} />
                <Avatar name={avatarName(r)} size={40} />
                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">{r.title}</p>
                  <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    {[r.code, r.client_name].filter(Boolean).join(" · ") || "Chưa có thông tin khách"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
                    <Badge tone={STATUS_TONE[r.status]} dot>
                      {QUOTE_STATUS_LABEL[r.status]}
                    </Badge>
                    <span className="v2-num whitespace-nowrap font-semibold">{vnd(quoteTotal(r))}</span>
                    {open && r.status !== "draft" && (
                      <span className="whitespace-nowrap font-medium" style={{ color: v.tone === "gray" ? "var(--tx3)" : toneVar(v.tone) }}>
                        {v.text}
                      </span>
                    )}
                  </div>
                  {n > 0 && (
                    <p className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--am)" }}>
                      {n} yêu cầu chỉnh chưa xử lý
                    </p>
                  )}
                </div>
                <div className="relative -mr-1.5 -mt-1 flex-none self-start">
                  <Menu items={menu(r)} label={`Thao tác cho ${r.title}`} />
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

/* ── Ngăn xem nhanh + đổi trạng thái ────────────────────────────────────── */
function QuotePeek({
  r,
  onClose,
  publicUrl,
  updating,
  onStatus,
  onCopy,
}: {
  r: QuoteRow | null;
  onClose: () => void;
  publicUrl: string;
  updating: boolean;
  onStatus: (s: QuoteStatus) => void;
  onCopy: () => void;
}) {
  if (!r)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );
  const v = validity(r);
  const n = pendingAdj(r);
  const items = r.quote_items || [];
  return (
    <Drawer
      open
      onClose={onClose}
      title={r.title}
      desc={[r.code ? `Mã ${r.code}` : "Chưa có mã", `tạo ${fmtDate(r.created_at)}`].join(" · ")}
      width={460}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <a href={publicUrl} target="_blank" rel="noreferrer" className={btn("secondary")}>
            <Eye size={16} /> Trang khách <ExternalLink size={13} />
          </a>
          <Link href={`/dashboard/studio/quotes/${r.id}`} className={btn("primary", "md", "ml-auto")}>
            Mở báo giá <ArrowRight size={16} />
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Avatar name={avatarName(r)} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{r.client_name || "Chưa có tên khách"}</p>
            <p className="truncate text-[13px]" style={{ color: "var(--tx3)" }}>
              {r.client_phone || "Chưa có số điện thoại"}
            </p>
          </div>
          {r.client_phone ? (
            <a href={`tel:${r.client_phone}`} className={iconBtn()} aria-label="Gọi khách" title="Gọi khách">
              <Phone size={17} />
            </a>
          ) : null}
        </div>

        {n > 0 && (
          <Callout
            tone="amber"
            icon={MessageSquareWarning}
            title={`${n} yêu cầu chỉnh chưa xử lý`}
            action={
              <Link href={`/dashboard/studio/quotes/${r.id}`} className={btn("secondary", "sm")}>
                Xử lý
              </Link>
            }
          />
        )}

        <div className="v2-card v2-card-pad flex items-end justify-between gap-3" style={{ boxShadow: "none", background: "var(--sf2)" }}>
          <div>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--tx2)" }}>
              Giá trị khách đang chọn
            </p>
            <p className="v2-num text-[22px] font-bold" style={{ letterSpacing: "-.5px" }}>
              {vnd(quoteTotal(r))}
            </p>
          </div>
          <p className="pb-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {items.length} hạng mục
          </p>
        </div>

        <Field label="Trạng thái" htmlFor="qp-status" hint="“Đã tạo hợp đồng” do hệ thống tự đặt khi tạo hợp đồng từ báo giá.">
          <select
            id="qp-status"
            className={inputCls}
            value={r.status}
            disabled={updating}
            style={{ opacity: updating ? 0.6 : 1 }}
            onChange={(e) => onStatus(e.target.value as QuoteStatus)}
          >
            {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((k) => (
              <option key={k} value={k} disabled={k === "converted"}>
                {QUOTE_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>

        <InfoList
          items={[
            { label: "Ngày chụp", value: r.event_date ? `${fmtDow(r.event_date)} · ${fmtDate(r.event_date)}` : "Chưa có ngày" },
            ...(r.location ? [{ label: "Địa điểm", value: r.location }] : []),
            { label: "Hiệu lực", value: <span style={{ color: v.tone === "gray" ? undefined : toneVar(v.tone) }}>{v.text}</span> },
            ...(r.viewed_at ? [{ label: "Khách xem lúc", value: fmtDateTime(r.viewed_at) }] : []),
            ...(r.accepted_at ? [{ label: "Khách đồng ý lúc", value: fmtDateTime(r.accepted_at) }] : []),
            ...(r.contract_id
              ? [
                  {
                    label: "Hợp đồng",
                    value: (
                      <Link href={`/dashboard/studio/contracts/${r.contract_id}`} className="font-semibold" style={{ color: "var(--ac)" }}>
                        Mở hợp đồng
                      </Link>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <button type="button" onClick={onCopy} className={btn("soft", "md", "self-start")}>
          <Copy size={15} /> Chép link gửi khách
        </button>
        <p className="-mt-3 flex items-center gap-1.5 truncate text-[12px]" style={{ color: "var(--tx3)" }}>
          <Link2 size={13} className="flex-none" /> {publicUrl}
        </p>
      </div>
    </Drawer>
  );
}
