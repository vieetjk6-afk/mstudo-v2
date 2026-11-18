"use client";

import PetView, { type PetState } from "@/app/dashboard/be-may-anh/PetView";
import { addDays, summarize, type Claim } from "@/lib/pet";

/* Bé Máy Ảnh với dữ liệu giả — dựng từ danh sách lượt nhận qua đúng hàm
   summarize() thật, nên số XP / chuỗi ngày trên màn khớp luật chơi. */

const TODAY = "2026-11-18";

function state(claims: Claim[], opts: { name?: string; outfit?: PetState["pet"]["outfit"]; ready?: boolean } = {}): PetState {
  const summary = summarize(claims, TODAY);
  const done = (k: string) => summary.doneToday.includes(k as never);
  return {
    setup: true,
    today: TODAY,
    pet: { name: opts.name ?? "Bé Chớp", outfit: opts.outfit ?? null, born: true },
    summary,
    tasks: [
      { key: "feed", title: "Điểm danh", desc: "Cho bé ăn một cuộn phim", href: null, xp: summary.feedXp, claimed: done("feed"), ready: true },
      { key: "album", title: "Tạo một album", desc: "Album chọn ảnh hoặc giao khách mới trong hôm nay", href: "/dashboard/albums/new", xp: 15, claimed: done("album"), ready: true },
      { key: "contract", title: "Tạo một hợp đồng", desc: "Hợp đồng mới của studio trong hôm nay", href: "/dashboard/studio/contracts/new", xp: 20, claimed: false, ready: !!opts.ready },
      { key: "payment", title: "Ghi một khoản thu", desc: "Cọc hoặc thanh toán của khách trong hôm nay", href: "/dashboard/studio/contracts", xp: 15, claimed: false, ready: false },
    ],
  };
}

/** n ngày điểm danh liên tiếp kết thúc ở `end`, mỗi ngày kèm vài nhiệm vụ. */
function days(n: number, end: string, extra = 25): Claim[] {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(end, -i);
    return [
      { day, task: "feed", xp: 10 + Math.min(n - 1 - i, 10) },
      { day, task: "album", xp: extra },
    ];
  }).flat();
}

/** Đang chăm: 12 ngày liền, hôm nay đã điểm danh + làm album, đeo nón lá. */
export function PetVuiDemo() {
  return <PetView initial={state(days(12, TODAY), { name: "Bé Chớp", outfit: "nonla", ready: true })} />;
}

/** Bỏ bê: lần cuối cho ăn cách đây 4 ngày — bé buồn, bám bụi. */
export function PetBuonDemo() {
  return <PetView initial={state(days(5, addDays(TODAY, -4), 0))} />;
}

/** Tài khoản mới: chưa điểm danh lần nào — trứng phim đang đói. */
export function PetMoiDemo() {
  return <PetView initial={state([])} />;
}
