"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Gift, X } from "lucide-react";
import { Avatar, Badge, Callout, Empty, Toolbar, btn, iconBtn, type Tone } from "@/components/v2/kit";
import { Menu, Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { vnd, type StudioReferral } from "@/lib/types";
import { REFERRAL_STATUS_LABEL } from "@/lib/referral";
import { useReferrals } from "./useReferrals";

/* ═══════════════════════════════════════════════════════════════════════════
   SỔ GIỚI THIỆU — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ReferralsPanel (bản cũ, logic chung ở ./useReferrals). Khác ở cách sắp xếp:
     • Một dòng nhắc "cần tặng thưởng" nổi lên đầu khi có tiền thưởng chờ trao.
     • Lọc theo bước: chờ chốt · cần tặng · đã xong.
     • Mỗi dòng: người giới thiệu → khách mới, MỘT nút cho bước tiếp theo,
       nút chép link và menu ⋯ (đánh dấu không thành).
   ═══════════════════════════════════════════════════════════════════════════ */

const TONE: Record<StudioReferral["status"], Tone> = {
  pending: "amber",
  earned: "green",
  granted: "gray",
  cancelled: "red",
};

type Filter = "all" | "pending" | "earned" | "done";

export default function ReferralsV2({ rows, bookingUrl }: { rows: StudioReferral[]; bookingUrl: string | null }) {
  const { list, busy, copied, setStatus, copyLink, owed } = useReferrals(rows, bookingUrl);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: list.length,
      pending: list.filter((r) => r.status === "pending").length,
      earned: list.filter((r) => r.status === "earned").length,
      done: list.filter((r) => r.status === "granted" || r.status === "cancelled").length,
    }),
    [list],
  );
  const visible = list.filter((r) =>
    filter === "all" ? true : filter === "done" ? r.status === "granted" || r.status === "cancelled" : r.status === filter,
  );

  const footNote = (
    <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
      Mức thưởng và ưu đãi đặt trong{" "}
      <Link href="/dashboard/studio/services" className="font-semibold hover:underline" style={{ color: "var(--ac)" }}>
        Dịch vụ &amp; điều khoản → Chính sách studio
      </Link>
      .
    </p>
  );

  if (list.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="v2-card">
          <Empty
            icon={Gift}
            title="Chưa có lượt giới thiệu nào"
            hint={
              bookingUrl
                ? "Gửi link đặt lịch kèm SĐT của khách cũ để ghi nhận lượt giới thiệu. Bật mức thưởng trong Dịch vụ & điều khoản → Chính sách studio."
                : "Bật link đặt lịch ở mục Đặt lịch khách trước, rồi gửi kèm SĐT khách cũ."
            }
          />
        </div>
        {footNote}
      </div>
    );
  }

  /** Nút cho bước tiếp theo của một lượt giới thiệu (tối đa một nút chữ). */
  const nextStep = (r: StudioReferral) =>
    r.status === "pending" ? (
      <button type="button" onClick={() => setStatus(r.id, "earned")} disabled={busy === r.id} className={btn("soft", "sm")}>
        <Check size={14} /> Đã chốt
      </button>
    ) : r.status === "earned" ? (
      <button type="button" onClick={() => setStatus(r.id, "granted")} disabled={busy === r.id} className={btn("soft", "sm")}>
        <Gift size={14} /> Đã tặng
      </button>
    ) : null;

  const tools = (r: StudioReferral) => (
    <>
      {bookingUrl && (
        <button
          type="button"
          onClick={() => copyLink(r.referrer_phone)}
          className={iconBtn()}
          aria-label="Chép link đặt lịch có sẵn mã giới thiệu của khách này"
          title="Chép link đặt lịch có sẵn mã giới thiệu của khách này"
        >
          {copied === r.referrer_phone ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />}
        </button>
      )}
      {r.status === "pending" || r.status === "earned" ? (
        <Menu
          label="Thêm thao tác"
          items={[{ label: "Không thành", hint: "Khách mới không chốt hợp đồng", icon: X, danger: true, disabled: busy === r.id, onClick: () => setStatus(r.id, "cancelled") }]}
        />
      ) : (
        <span className="inline-block w-9 flex-none" aria-hidden />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {owed > 0 && (
        <Callout tone="green" icon={Gift} title={`Cần tặng thưởng: ${vnd(owed)}`}>
          {counts.earned} khách cũ đã giới thiệu thành công. Trao thưởng xong thì bấm “Đã tặng”.
        </Callout>
      )}

      <div className="v2-card overflow-hidden">
        <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Toolbar>
            <Segmented
              label="Lọc lượt giới thiệu"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Tất cả", count: counts.all },
                { value: "pending", label: "Chờ chốt", count: counts.pending },
                { value: "earned", label: "Cần tặng", count: counts.earned },
                { value: "done", label: "Đã xong", count: counts.done },
              ]}
            />
          </Toolbar>
        </div>

        {visible.length === 0 ? (
          <Empty compact icon={Gift} title="Không có lượt nào ở nhóm này" hint="Chọn nhóm khác để xem." />
        ) : (
          <>
            {/* Máy tính: bảng */}
            <div className="v2-table-wrap hidden md:block">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Người giới thiệu</th>
                    <th>Khách mới</th>
                    <th style={{ width: 110 }}>Ngày</th>
                    <th className="num" style={{ width: 130 }}>Thưởng</th>
                    <th style={{ width: 140 }}>Trạng thái</th>
                    <th style={{ width: 210 }} aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={r.referrer_name || r.referrer_phone} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{r.referrer_name || r.referrer_phone}</p>
                            {r.referrer_name ? <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{r.referrer_phone}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex min-w-0 items-center gap-2">
                          <ArrowRight size={14} className="flex-none" style={{ color: "var(--tx3)" }} />
                          <div className="min-w-0">
                            <p className="truncate">{r.referred_name || r.referred_phone}</p>
                            {r.referred_name ? <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{r.referred_phone}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="v2-num" style={{ color: "var(--tx2)" }}>{fmtDate(r.created_at.slice(0, 10))}</td>
                      <td className="num">{r.reward_amount > 0 ? vnd(r.reward_amount) : <span style={{ color: "var(--tx3)" }}>—</span>}</td>
                      <td>
                        <Badge tone={TONE[r.status]} dot>{REFERRAL_STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {nextStep(r)}
                          {tools(r)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Điện thoại: thẻ gọn */}
            <div className="md:hidden">
              {visible.map((r) => (
                <div key={r.id} className="flex flex-col gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <div className="flex items-start gap-3">
                    <Avatar name={r.referrer_name || r.referrer_phone} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{r.referrer_name || r.referrer_phone}</p>
                      <p className="flex min-w-0 items-center gap-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                        <ArrowRight size={13} className="flex-none" />
                        <span className="truncate">{r.referred_name || r.referred_phone}</span>
                      </p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                        {fmtDate(r.created_at.slice(0, 10))}
                        {r.reward_amount > 0 ? ` · thưởng ${vnd(r.reward_amount)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pl-12">
                    <div className="min-w-0 flex-1">
                      <Badge tone={TONE[r.status]} dot>{REFERRAL_STATUS_LABEL[r.status]}</Badge>
                    </div>
                    {nextStep(r)}
                    {tools(r)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {footNote}
    </div>
  );
}
