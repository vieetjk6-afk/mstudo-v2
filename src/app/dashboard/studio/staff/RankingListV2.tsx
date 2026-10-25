"use client";

import { Trophy } from "lucide-react";
import { Avatar, Empty, Progress } from "@/components/v2/kit";
import { vnd, vndShort } from "@/lib/types";
import { crewRoleLabel, type CrewRoleRow } from "@/lib/crew-roles";
import type { RankRow } from "./RankingList";

/* ═══════════════════════════════════════════════════════════════════════════
   XẾP HẠNG THỢ — giao diện mới (tab 3 của StaffAndCrewV2). Cùng dữ liệu với
   RankingList: xếp theo số buổi ĐÃ NHẬN rồi tới thu nhập từ studio, tính trên
   toàn bộ hợp đồng (cả phần đã trả lẫn chưa trả — đây là khối lượng việc, không
   phải công nợ). Bảng gọn trên máy tính, dòng gọn trên điện thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Ba hạng đầu: vàng · bạc · đồng — chỉ dùng token màu. */
const MEDAL = [
  { bg: "var(--amS)", fg: "var(--am)" },
  { bg: "var(--nuS)", fg: "var(--tx2)" },
  { bg: "color-mix(in srgb, var(--am) 12%, var(--sf))", fg: "color-mix(in srgb, var(--am) 70%, var(--rd))" },
];

function RankDot({ i }: { i: number }) {
  const m = MEDAL[i];
  return (
    <span
      className="v2-num flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] font-bold"
      style={m ? { background: m.bg, color: m.fg } : { background: "var(--sf2)", color: "var(--tx3)" }}
      aria-label={`Hạng ${i + 1}`}
    >
      {i < 3 ? <Trophy size={15} strokeWidth={2.4} /> : i + 1}
    </span>
  );
}

export default function RankingListV2({ ranked, crewRoles = [] }: { ranked: RankRow[]; crewRoles?: CrewRoleRow[] }) {
  const topEarn = Math.max(1, ...ranked.map((r) => r.earned));

  if (ranked.length === 0) {
    return (
      <div className="v2-card">
        <Empty icon={Trophy} title="Chưa có dữ liệu xếp hạng" hint="Phân công nhân sự cho hợp đồng, bảng xếp hạng sẽ tự hiện." />
      </div>
    );
  }

  return (
    <div className="v2-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
        <div className="min-w-0 flex-1">
          <p className="v2-section-title">Bảng xếp hạng</p>
          <p className="v2-section-desc">Xếp theo số buổi đã nhận, rồi tới thu nhập từ studio — tính trên toàn bộ hợp đồng.</p>
        </div>
      </div>

      <div className="v2-table-wrap hidden md:block">
        <table className="v2-table">
          <thead>
            <tr>
              <th style={{ width: 64 }}>Hạng</th>
              <th>Thợ</th>
              <th style={{ width: 170 }}>Buổi đã nhận</th>
              <th style={{ width: 240 }}>Thu nhập từ studio</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => (
              <tr key={r.key}>
                <td><RankDot i={i} /></td>
                <td>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{crewRoleLabel(r.role, crewRoles)}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p className="v2-num font-semibold">
                    {r.accepted} <span className="font-normal" style={{ color: "var(--tx3)" }}>/ {r.jobs} buổi</span>
                  </p>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Progress value={(r.earned / topEarn) * 100} tone={i === 0 ? "amber" : "brand"} />
                    </div>
                    <span className="v2-num w-[112px] flex-none text-right font-semibold">{vnd(r.earned)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {ranked.map((r, i) => (
          <div key={r.key} className="v2-row">
            <RankDot i={i} />
            <div className="min-w-0 flex-1">
              <p className="v2-row-title">{r.name}</p>
              <p className="v2-row-sub">
                {crewRoleLabel(r.role, crewRoles)} · nhận {r.accepted}/{r.jobs} buổi
              </p>
              <div className="mt-1.5">
                <Progress value={(r.earned / topEarn) * 100} tone={i === 0 ? "amber" : "brand"} />
              </div>
            </div>
            <p className="v2-num flex-none text-[14px] font-semibold">{vndShort(r.earned)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
