"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Star, Check, EyeOff, Eye, Trash2, MessageSquareQuote, Send, Images, Clock, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ShareButton from "@/components/ShareButton";
import { Panel, PanelHead, Pill, StatCard, EmptyState, type ToneKey } from "@/components/studio/ui";
import { studioUrl } from "@/lib/hosts";
import { fmtDate } from "@/lib/date";
import { reviewScore, type AwaitingReviewAlbum, type ReviewRow } from "@/lib/types";

type Tab = "pending" | "live" | "hidden" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Chờ duyệt" },
  { key: "live", label: "Đang hiện" },
  { key: "hidden", label: "Đã ẩn" },
  { key: "all", label: "Tất cả" },
];

/** Nhãn & màu của từng trạng thái — dùng chung cho tab và cho viên trên mỗi
 *  dòng, để hai chỗ không bao giờ nói hai điều khác nhau về cùng một hàng. */
const BUCKET_LABEL: Record<Exclude<Tab, "all">, string> = {
  pending: "Chờ duyệt",
  live: "Đang hiện",
  hidden: "Đã ẩn",
};
const BUCKET_TONE: Record<Exclude<Tab, "all">, ToneKey> = {
  pending: "amber",
  live: "green",
  hidden: "gray",
};

/** Ba trạng thái nằm trên HAI cột: "chờ duyệt" và "đã ẩn" trong DB đều là
 *  approved=false, nên `moderated_at` (studio đã quyết chưa) mới là thứ tách
 *  được. Cố ý KHÔNG dùng ké `replied_at`: studio soạn lời đáp cho một đánh giá
 *  xấu rồi vẫn chưa quyết cho hiện là chuyện bình thường. */
const bucketOf = (r: { approved: boolean; moderated_at: string | null }): Exclude<Tab, "all"> =>
  r.approved ? "live" : r.moderated_at ? "hidden" : "pending";

/** Dải sao. `size` nhỏ cho dòng danh sách, to hơn cho ô điểm trung bình. */
function Stars({ n, size = 13 }: { n: number | null; size?: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex flex-none items-center gap-0.5" style={{ color: "var(--am)" }} aria-label={`${n} trên 5 sao`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} fill={i < n ? "currentColor" : "none"} strokeWidth={i < n ? 0 : 1.6} style={{ opacity: i < n ? 1 : 0.35 }} />
      ))}
    </span>
  );
}

/**
 * Đánh giá khách: xem, DUYỆT, trả lời, và đi xin ở những album đã giao mà chưa
 * ai viết gì.
 *
 * Vì sao phải duyệt: đánh giá lên thẳng website studio. Một câu 1 sao viết lúc
 * nóng giận, hay một tin rác, mà tự động nằm ở trang chủ thì studio mất khách
 * trước khi kịp biết có chuyện. Nên đánh giá mới vào ở trạng thái CHỜ DUYỆT
 * (mặc định của cột `approved` trong DB), studio bật lên mới hiện.
 */
export default function ReviewsView({
  reviews,
  awaiting,
  studioHost,
}: {
  reviews: ReviewRow[];
  awaiting: AwaitingReviewAlbum[];
  studioHost: string | null;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<ReviewRow[]>(reviews);
  const [tab, setTab] = useState<Tab>(() => (reviews.some((r) => !r.approved) ? "pending" : "all"));
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const score = useMemo(() => reviewScore(rows), [rows]);

  const counts = useMemo(() => {
    const c = { pending: 0, live: 0, hidden: 0, all: rows.length };
    for (const r of rows) c[bucketOf(r)] += 1;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => bucketOf(r) === tab)),
    [rows, tab],
  );

  /** Duyệt hoặc ẩn. Cả hai đều là một QUYẾT ĐỊNH, nên cùng đóng `moderated_at`
   *  — nếu không, đánh giá bị ẩn sẽ quay lại tab "Chờ duyệt" mãi và studio phải
   *  ẩn đi ẩn lại. Ghi một patch, cập nhật state một lần. */
  async function setApproved(id: string, approved: boolean) {
    setBusy(id);
    const patch = { approved, moderated_at: new Date().toISOString() };
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await supabase.from("feedback").update(patch).eq("id", id);
    setBusy(null);
  }

  /** Trả lời KHÔNG đổi trạng thái duyệt: studio được phép soạn lời đáp cho một
   *  đánh giá xấu rồi mới cân nhắc có cho hiện hay không. */
  async function saveReply(id: string) {
    const text = replyText.trim();
    setBusy(id);
    const patch = { reply: text || null, replied_at: text ? new Date().toISOString() : null };
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await supabase.from("feedback").update(patch).eq("id", id);
    setReplyOpen(null);
    setReplyText("");
    setBusy(null);
  }

  async function remove(id: string) {
    if (!window.confirm("Xoá hẳn đánh giá này? Không lấy lại được.")) return;
    setBusy(id);
    setRows((cur) => cur.filter((r) => r.id !== id));
    await supabase.from("feedback").delete().eq("id", id);
    setBusy(null);
  }

  return (
    <div className="page-in">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Star}
          tone="amber"
          label="Điểm trung bình"
          value={score.avg === null ? "—" : score.avg.toFixed(1)}
          sub={score.avg === null ? "chưa có đánh giá đã duyệt" : `trên ${score.rated} đánh giá đã hiện`}
        />
        <StatCard
          icon={Clock}
          tone={counts.pending > 0 ? "amber" : "gray"}
          label="Chờ bạn duyệt"
          value={String(counts.pending)}
          delta={counts.pending > 0 ? "khách chưa thấy" : undefined}
          deltaTone="amber"
        />
        <StatCard icon={MessageSquareQuote} tone="green" label="Đang hiện trên web" value={String(counts.live)} />
        <StatCard
          icon={Images}
          tone={awaiting.length > 0 ? "brand" : "gray"}
          label="Album chưa ai đánh giá"
          value={String(awaiting.length)}
          sub={awaiting.length > 0 ? "đi xin một câu" : "đã xin hết"}
        />
      </div>

      <Panel className="mb-5">
        <PanelHead
          icon={MessageSquareQuote}
          tone="amber"
          title="Đánh giá của khách"
          count={String(counts.all)}
          note="Chỉ bản đã duyệt mới lên website studio"
        />

        <div className="hscroll gap-1.5 px-4 py-3">
          {TABS.map((t) => {
            const on = tab === t.key;
            const n = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={on}
                className="rounded-[20px] px-3 py-1.5 text-[12.5px]"
                style={
                  on
                    ? { background: "var(--acS)", color: "var(--ac)", fontWeight: 700 }
                    : { color: "var(--tx2)", fontWeight: 600 }
                }
              >
                {t.label} {n > 0 ? <span className="tnum">({n})</span> : null}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={tab === "pending" ? "Không có đánh giá nào chờ duyệt" : "Chưa có đánh giá nào ở đây"}
            hint="Khách viết cảm nhận ở cuối trang album giao khách. Gửi link album kèm một câu nhờ đánh giá là cách nhanh nhất."
          />
        ) : (
          <div>
            {visible.map((r) => {
              const editing = replyOpen === r.id;
              return (
                <div key={r.id} className="px-4 py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="font-semibold">{r.client_name?.trim() || "Khách (không để tên)"}</span>
                    <Stars n={r.rating} />
                    {/* Nhãn phải đi qua ĐÚNG hàm phân loại của tab, không tự
                        viết lại điều kiện: nếu không, một đánh giá đã được trả
                        lời mà chưa quyết sẽ nằm ở tab "Chờ duyệt" nhưng lại đeo
                        nhãn "Đã ẩn". */}
                    <Pill tone={BUCKET_TONE[bucketOf(r)]} dot>{BUCKET_LABEL[bucketOf(r)]}</Pill>
                    <span className="ml-auto text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {fmtDate(r.created_at)}
                    </span>
                  </div>

                  {r.album ? (
                    <Link
                      href={`/dashboard/albums/${r.album.id}`}
                      className="mt-1 inline-flex items-center gap-1.5 text-[11.5px]"
                      style={{ color: "var(--tx3)" }}
                    >
                      <Images size={12} /> {r.album.title || r.album.client_name || "Album"}
                    </Link>
                  ) : null}

                  <p className="mt-1.5 whitespace-pre-wrap text-[13.5px]" style={{ color: "var(--tx2)" }}>
                    {r.content}
                  </p>

                  {r.reply && !editing ? (
                    <div className="mt-2.5 rounded-[10px] px-3 py-2.5" style={{ background: "var(--sf2)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
                        Studio trả lời
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px]">{r.reply}</p>
                    </div>
                  ) : null}

                  {editing ? (
                    <div className="mt-2.5">
                      <textarea
                        autoFocus
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Cảm ơn anh chị đã tin tưởng studio…"
                        className="input min-h-[80px] resize-y"
                      />
                      <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                        Lời trả lời hiện công khai ngay dưới đánh giá, khách sau đọc được.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => saveReply(r.id)} disabled={busy === r.id} className="btn-primary px-3 py-1.5 text-[13px]">
                          <Send size={14} /> Lưu trả lời
                        </button>
                        <button onClick={() => { setReplyOpen(null); setReplyText(""); }} className="btn-ghost px-3 py-1.5 text-[13px]">
                          Thôi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {r.approved ? (
                        <button onClick={() => setApproved(r.id, false)} disabled={busy === r.id} className="btn-ghost px-3 py-1.5 text-[13px]">
                          <EyeOff size={14} /> Ẩn khỏi website
                        </button>
                      ) : (
                        <button onClick={() => setApproved(r.id, true)} disabled={busy === r.id} className="btn-primary px-3 py-1.5 text-[13px]">
                          <Check size={14} /> Duyệt & hiện
                        </button>
                      )}
                      <button
                        onClick={() => { setReplyOpen(r.id); setReplyText(r.reply ?? ""); }}
                        className="btn-ghost px-3 py-1.5 text-[13px]"
                      >
                        <MessageSquareQuote size={14} /> {r.reply ? "Sửa trả lời" : "Trả lời"}
                      </button>
                      {r.album ? (
                        <a
                          href={studioUrl(studioHost, `/album/${r.album.slug}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost px-3 py-1.5 text-[13px]"
                        >
                          <Eye size={14} /> Xem trang khách
                        </a>
                      ) : null}
                      <button onClick={() => remove(r.id)} disabled={busy === r.id} className="btn-danger ml-auto px-3 py-1.5 text-[13px]">
                        <Trash2 size={14} /> Xoá
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {awaiting.length > 0 && (
        <Panel>
          <PanelHead
            icon={Sparkles}
            tone="brand"
            title="Album đã giao, chưa ai đánh giá"
            count={String(awaiting.length)}
            note="Gửi link kèm một câu nhờ khách viết cảm nhận"
          />
          {awaiting.map((a) => {
            const url = studioUrl(studioHost, `/album/${a.slug}`);
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                style={{ borderTop: "1px solid var(--bd2)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{a.title || a.client_name || "Album"}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    Tạo ngày {fmtDate(a.created_at)}
                  </p>
                </div>
                <ShareButton
                  path={url}
                  title={a.title || "Album ảnh"}
                  label="Xin đánh giá"
                  className="btn-ghost px-3 py-1.5 text-[13px]"
                />
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
