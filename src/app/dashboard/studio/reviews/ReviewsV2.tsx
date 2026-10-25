"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check, Clock, Eye, EyeOff, Images, MessageSquareQuote, MessageSquareReply, Search, Send, Sparkles, Star, Trash2,
} from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { studioUrl } from "@/lib/hosts";
import { reviewRequestMessage } from "@/lib/share-messages";
import { fmtDate } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import type { AwaitingReviewAlbum, ReviewRow } from "@/lib/types";
import { Avatar, Badge, Empty, PageHead, Section, Stack, Stat, StatGrid, Toolbar, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { TABS, BUCKET_LABEL, BUCKET_TONE, bucketOf, Stars, useReviews, type Tab } from "./reviews-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐÁNH GIÁ KHÁCH — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ReviewsView (bản cũ, logic chung ở ./reviews-shared); khác ở cách sắp xếp:
     • 4 số liệu: điểm TB · chờ duyệt · đang hiện · album chưa ai đánh giá.
     • Hai cột (máy tính): bên trái danh sách đánh giá có thanh lọc (trạng
       thái · tìm · sắp xếp); bên phải "Xin thêm đánh giá" từ album đã giao.
     • Mỗi dòng: avatar, sao, nhãn trạng thái, hai dòng nội dung; MỘT nút
       "Duyệt" cho bản đang chờ, còn lại trong ⋯. Bấm dòng mở NGĂN KÉO đọc
       trọn, trả lời, duyệt/ẩn, xoá.
   ═══════════════════════════════════════════════════════════════════════════ */

type Sort = "newest" | "low" | "high";

export default function ReviewsV2({
  reviews,
  awaiting,
  studioHost,
}: {
  reviews: ReviewRow[];
  awaiting: AwaitingReviewAlbum[];
  studioHost: string | null;
}) {
  const r = useReviews(reviews);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId ? r.rows.find((x) => x.id === peekId) ?? null : null;

  const list = useMemo(() => {
    const needle = noAccent(q.trim());
    const out = r.visible.filter(
      (x) => !needle || noAccent(`${x.client_name ?? ""} ${x.content} ${x.album?.title ?? ""} ${x.album?.client_name ?? ""}`).includes(needle),
    );
    if (sort === "low") return [...out].sort((a, b) => (a.rating ?? 6) - (b.rating ?? 6));
    if (sort === "high") return [...out].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return out;
  }, [r.visible, q, sort]);

  const nameOf = (x: ReviewRow) => x.client_name?.trim() || "Khách (không để tên)";
  const albumTitle = (x: ReviewRow) => x.album?.title || x.album?.client_name || "Album";

  function openPeek(id: string, reply = false) {
    setPeekId(id);
    if (reply) {
      const row = r.rows.find((x) => x.id === id);
      r.setReplyOpen(id);
      r.setReplyText(row?.reply ?? "");
    } else {
      r.setReplyOpen(null);
    }
  }
  function closePeek() {
    setPeekId(null);
    r.setReplyOpen(null);
    r.setReplyText("");
  }

  const menuFor = (x: ReviewRow): MenuItem[] => [
    x.approved
      ? { label: "Ẩn khỏi website", icon: EyeOff, disabled: r.busy === x.id, onClick: () => void r.setApproved(x.id, false) }
      : { label: "Duyệt & hiện", icon: Check, disabled: r.busy === x.id, onClick: () => void r.setApproved(x.id, true) },
    { label: x.reply ? "Sửa trả lời" : "Trả lời", icon: MessageSquareReply, onClick: () => openPeek(x.id, true) },
    ...(x.album
      ? ([
          { label: "Xem trang khách", icon: Eye, href: studioUrl(studioHost, `/album/${x.album.slug}`), external: true },
          { label: "Mở album", icon: Images, href: `/dashboard/albums/${x.album.id}` },
        ] as MenuItem[])
      : []),
    "divider",
    { label: "Xoá", icon: Trash2, danger: true, disabled: r.busy === x.id, onClick: () => void r.remove(x.id) },
  ];

  const editing = peek ? r.replyOpen === peek.id : false;

  return (
    <Stack>
      <PageHead desc="Đánh giá mới phải được bạn duyệt rồi mới lên website studio. Trả lời công khai để khách sau đọc được." />

      <StatGrid>
        <Stat
          icon={Star}
          tone="amber"
          label="Điểm trung bình"
          value={r.score.avg === null ? "—" : r.score.avg.toFixed(1)}
          sub={r.score.avg === null ? "Chưa có đánh giá đã duyệt" : `Trên ${r.score.rated} đánh giá đã hiện`}
        />
        <Stat
          icon={Clock}
          tone="amber"
          label="Chờ bạn duyệt"
          value={r.counts.pending}
          valueTone={r.counts.pending ? "amber" : undefined}
          sub={r.counts.pending ? "Khách chưa thấy" : "Đã duyệt hết"}
        />
        <Stat icon={MessageSquareQuote} tone="green" label="Đang hiện trên web" value={r.counts.live} />
        <Stat
          icon={Images}
          tone="brand"
          label="Album chưa ai đánh giá"
          value={awaiting.length}
          sub={awaiting.length ? "Đi xin một câu" : "Đã xin hết"}
        />
      </StatGrid>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Danh sách đánh giá ─────────────────────────────────────── */}
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              {/* Ô tìm một hàng riêng: cạnh nhóm trạng thái thì cột trái quá hẹp. */}
              <div className="w-full">
                <SearchInput value={q} onChange={setQ} placeholder="Tìm tên khách, nội dung, album…" className="w-full" />
              </div>
              <Segmented<Tab>
                label="Trạng thái đánh giá"
                value={r.tab}
                onChange={r.setTab}
                options={TABS.map((t) => ({ value: t.key, label: t.label, count: r.counts[t.key] }))}
              />
              <select aria-label="Sắp xếp" className={`${inputCls} sm:ml-auto`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="newest">Mới nhất</option>
                <option value="low">Ít sao trước</option>
                <option value="high">Nhiều sao trước</option>
              </select>
            </Toolbar>
          </div>

          {list.length === 0 ? (
            <Empty
              compact
              icon={q ? Search : MessageSquareQuote}
              title={q ? "Không tìm thấy đánh giá phù hợp" : r.tab === "pending" ? "Không có đánh giá nào chờ duyệt" : "Chưa có đánh giá nào ở đây"}
              hint={q ? "Thử gõ ít chữ hơn." : "Khách viết cảm nhận ở cuối trang album giao khách. Gửi link album kèm một câu nhờ đánh giá là cách nhanh nhất."}
            />
          ) : (
            list.map((x) => {
              const b = bucketOf(x);
              return (
                <div key={x.id} className="flex items-start gap-3 px-4 py-3.5 md:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <button type="button" onClick={() => openPeek(x.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <Avatar name={nameOf(x)} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-[14px] font-semibold" style={x.client_name?.trim() ? undefined : { color: "var(--tx2)" }}>
                          {nameOf(x)}
                        </span>
                        <Stars n={x.rating} />
                        <Badge tone={BUCKET_TONE[b]} dot>{BUCKET_LABEL[b]}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                        {x.album ? `${albumTitle(x)} · ` : ""}
                        {fmtDate(x.created_at)}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-[13.5px]" style={{ color: "var(--tx2)" }}>{x.content}</p>
                      {x.reply ? (
                        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          <MessageSquareReply size={13} className="flex-none" style={{ color: "var(--gn)" }} />
                          <span className="truncate">Đã trả lời: {x.reply}</span>
                        </p>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex flex-none items-center gap-1.5">
                    {!x.approved ? (
                      <span className="hidden sm:inline-flex">
                        <button type="button" onClick={() => r.setApproved(x.id, true)} disabled={r.busy === x.id} className={btn("soft", "sm")}>
                          <Check size={14} /> Duyệt
                        </button>
                      </span>
                    ) : null}
                    <Menu label="Thêm thao tác" width={220} items={menuFor(x)} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Xin thêm đánh giá ──────────────────────────────────────── */}
        <Section
          title="Xin thêm đánh giá"
          icon={Sparkles}
          desc={awaiting.length ? "Album đã giao, chưa ai viết cảm nhận" : undefined}
          flush
        >
          {awaiting.length === 0 ? (
            <Empty compact icon={Check} title="Đã xin hết" hint="Album giao khách mới sẽ hiện ở đây để bạn gửi lời nhờ đánh giá." />
          ) : (
            awaiting.map((a) => {
              const url = studioUrl(studioHost, `/album/${a.slug}`);
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 md:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
                  <span className="v2-section-icon flex-none" style={{ width: 34, height: 34 }}>
                    <Images size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{a.title || a.client_name || "Album"}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                      {a.client_name && a.title ? `${a.client_name} · ` : ""}Tạo {fmtDate(a.created_at)}
                    </p>
                  </div>
                  <ShareButton
                    path={url}
                    title={a.title || "Album ảnh"}
                    label="Xin"
                    message={reviewRequestMessage(a.client_name, url)}
                    className={btn("soft", "sm")}
                  />
                </div>
              );
            })
          )}
        </Section>
      </div>

      {/* ── Ngăn kéo đọc trọn + trả lời ───────────────────────────────── */}
      <Drawer
        open={!!peek}
        onClose={closePeek}
        title={peek ? nameOf(peek) : ""}
        desc={peek ? `Gửi ngày ${fmtDate(peek.created_at)}` : undefined}
        footer={
          peek ? (
            <>
              <button type="button" onClick={async () => { await r.remove(peek.id); }} disabled={r.busy === peek.id} className={btn("ghost", "md", "mr-auto")} style={{ color: "var(--rd)" }}>
                <Trash2 size={16} /> Xoá
              </button>
              {peek.approved ? (
                <button type="button" onClick={() => r.setApproved(peek.id, false)} disabled={r.busy === peek.id} className={btn("secondary")}>
                  <EyeOff size={16} /> Ẩn khỏi website
                </button>
              ) : (
                <button type="button" onClick={() => r.setApproved(peek.id, true)} disabled={r.busy === peek.id} className={btn("primary")}>
                  <Check size={16} /> Duyệt &amp; hiện
                </button>
              )}
            </>
          ) : null
        }
      >
        {peek ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar name={nameOf(peek)} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {peek.rating ? <Stars n={peek.rating} size={16} /> : <span className="text-[13px]" style={{ color: "var(--tx3)" }}>Không chấm sao</span>}
                  <Badge tone={BUCKET_TONE[bucketOf(peek)]} dot>{BUCKET_LABEL[bucketOf(peek)]}</Badge>
                </div>
                {peek.album ? (
                  <Link href={`/dashboard/albums/${peek.album.id}`} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[12.5px] hover:underline" style={{ color: "var(--tx3)" }}>
                    <Images size={13} className="flex-none" /> <span className="truncate">{albumTitle(peek)}</span>
                  </Link>
                ) : null}
              </div>
            </div>

            <blockquote className="whitespace-pre-wrap rounded-[12px] px-4 py-3 text-[14px] leading-relaxed" style={{ background: "var(--sf2)", borderLeft: "3px solid var(--am)" }}>
              {peek.content}
            </blockquote>

            {peek.album ? (
              <a href={studioUrl(studioHost, `/album/${peek.album.slug}`)} target="_blank" rel="noreferrer" className={btn("ghost", "sm", "w-fit")}>
                <Eye size={14} /> Xem trang khách
              </a>
            ) : null}

            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Studio trả lời</p>
              {editing ? (
                <>
                  <textarea
                    autoFocus
                    value={r.replyText}
                    onChange={(e) => r.setReplyText(e.target.value)}
                    placeholder="Cảm ơn anh chị đã tin tưởng studio…"
                    className={inputCls}
                    style={{ height: "auto", minHeight: 110, padding: "10px 12px", resize: "vertical" }}
                  />
                  <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                    Lời trả lời hiện công khai ngay dưới đánh giá, khách sau đọc được.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => r.saveReply(peek.id)} disabled={r.busy === peek.id} className={btn("soft", "sm")}>
                      <Send size={14} /> Lưu trả lời
                    </button>
                    <button type="button" onClick={() => { r.setReplyOpen(null); r.setReplyText(""); }} className={btn("ghost", "sm")}>
                      Thôi
                    </button>
                  </div>
                </>
              ) : peek.reply ? (
                <div className="rounded-[12px] px-4 py-3" style={{ border: "1px solid var(--bd)" }}>
                  <p className="whitespace-pre-wrap text-[13.5px]">{peek.reply}</p>
                  <button type="button" onClick={() => openPeek(peek.id, true)} className={btn("ghost", "sm", "mt-2 -ml-2")}>
                    <MessageSquareReply size={14} /> Sửa trả lời
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => openPeek(peek.id, true)} className={btn("secondary", "md", "w-fit")}>
                  <MessageSquareReply size={16} /> Viết trả lời
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </Stack>
  );
}
