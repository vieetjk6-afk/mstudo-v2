"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Star, Check, EyeOff, Eye, Trash2, MessageSquareQuote, Send, Images, Clock, Sparkles,
} from "lucide-react";
import ShareButton from "@/components/ShareButton";
import { Panel, PanelHead, Pill, StatCard, EmptyState } from "@/components/studio/ui";
import { studioUrl } from "@/lib/hosts";
import { reviewRequestMessage } from "@/lib/share-messages";
import { fmtDate } from "@/lib/date";
import type { AwaitingReviewAlbum, ReviewRow } from "@/lib/types";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { TABS, BUCKET_LABEL, BUCKET_TONE, bucketOf, Stars, useReviews } from "./reviews-shared";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const ReviewsV2 = dynamic(() => import("./ReviewsV2"));

/**
 * Đánh giá khách: xem, DUYỆT, trả lời, và đi xin ở những album đã giao mà chưa
 * ai viết gì.
 *
 * Vì sao phải duyệt: đánh giá lên thẳng website studio. Một câu 1 sao viết lúc
 * nóng giận, hay một tin rác, mà tự động nằm ở trang chủ thì studio mất khách
 * trước khi kịp biết có chuyện. Nên đánh giá mới vào ở trạng thái CHỜ DUYỆT
 * (mặc định của cột `approved` trong DB), studio bật lên mới hiện.
 */
type ReviewsProps = {
  reviews: ReviewRow[];
  awaiting: AwaitingReviewAlbum[];
  studioHost: string | null;
};

export default function ReviewsView(props: ReviewsProps) {
  return useUiV2() ? <ReviewsV2 {...props} /> : <ReviewsViewV1 {...props} />;
}

function ReviewsViewV1({ reviews, awaiting, studioHost }: ReviewsProps) {
  const {
    tab, setTab, replyOpen, setReplyOpen, replyText, setReplyText, busy, score, counts, visible,
    setApproved, saveReply, remove,
  } = useReviews(reviews);

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
                  message={reviewRequestMessage(a.client_name, url)}
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
