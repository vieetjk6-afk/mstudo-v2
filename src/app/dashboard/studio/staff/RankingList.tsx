"use client";

import { Trophy } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { vnd, CREW_ROLE_LABEL, type CrewRole } from "@/lib/types";

export type RankRow = { key: string; name: string; role: CrewRole; jobs: number; accepted: number; earned: number };

/**
 * Xếp hạng thợ theo số buổi ĐÃ NHẬN và thu nhập từ studio.
 *
 * Trước là một màn riêng chiếm một dòng sidebar, nhưng nó trả lời cùng câu hỏi
 * "ai làm cho studio này" với hai tab kia — và chỉ mở vài lần một tháng. Gộp
 * thành tab thứ ba, đúng tiền lệ của Sổ thợ.
 *
 * KHÁC với Đối soát tiền công: bảng này đo KHỐI LƯỢNG VIỆC (ai nhận nhiều nhất,
 * kiếm được bao nhiêu), không phải công nợ — nên nó tính cả phần đã trả lẫn
 * chưa trả, và ở đúng nhóm quyền của quản lý (Đối soát tiền công cần quyền tiền).
 */
export default function RankingList({ ranked }: { ranked: RankRow[] }) {
  const medal = ["#C9A227", "#8E9099", "#B4703A"];
  const topEarn = Math.max(1, ...ranked.map((r) => r.earned));

  if (ranked.length === 0) {
    return (
      <Panel>
        <EmptyState icon={Trophy} title="Chưa có dữ liệu xếp hạng" hint="Phân công nhân sự cho hợp đồng, bảng xếp hạng sẽ tự hiện." />
      </Panel>
    );
  }

  return (
    <div className="max-w-[820px]">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Xếp theo số buổi đã nhận và thu nhập từ studio — tính trên toàn bộ hợp đồng.
      </p>
      <div className="flex flex-col gap-2">
        {ranked.map((r, i) => (
          <Panel key={r.key} className="flex items-center gap-3 px-4 py-3.5">
            <span
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] font-extrabold"
              style={i < 3
                ? { background: `color-mix(in srgb, ${medal[i]} 18%, #fff)`, color: medal[i] }
                : { background: "var(--sf2)", color: "var(--tx3)" }}
            >
              {i + 1}
            </span>
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: avatarColor(r.name) }}>
              {initials(r.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">{r.name}</p>
              <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                {CREW_ROLE_LABEL[r.role] ?? r.role} · nhận {r.accepted}/{r.jobs} buổi
              </p>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-[3px]" style={{ background: "var(--bd2)" }}>
                <div className="h-full rounded-[3px]" style={{ width: `${(r.earned / topEarn) * 100}%`, background: "var(--ac)" }} />
              </div>
            </div>
            <p className="tnum flex-none text-[15px] font-bold">{vnd(r.earned)}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
