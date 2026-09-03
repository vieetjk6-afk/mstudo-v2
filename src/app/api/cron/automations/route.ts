import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { sendZalo } from "@/lib/zalo/send";
import { todayVN } from "@/lib/date";
import {
  dueActions,
  type AutomationConfig,
  type ContractSnapshot,
  type PendingAction,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

/**
 * THI HÀNH VIỆC TỰ ĐỘNG — chạy mỗi ngày (vercel.json).
 *
 * Bộ LUẬT nằm ở @/lib/automations (hàm thuần, kiểm thử bằng node). Route này chỉ
 * làm ba việc: đọc dữ liệu, gọi `dueActions()`, rồi thi hành.
 *
 * CHỐNG LẶP là điều quan trọng nhất ở đây, và nó có HAI lớp:
 *   1. Đọc trước: nạp các khoá đã chạy rồi truyền vào `dueActions` để không sinh
 *      lại việc cũ.
 *   2. Hàng rào DB: `studio_automation_log.dedupe_key` là UNIQUE. Ghi log TRƯỚC
 *      khi làm việc; ghi trùng thì bỏ qua luôn việc đó. Nhờ vậy hai lượt cron
 *      chạy chồng nhau (Vercel gọi lại vì timeout) không thể gửi hai lần.
 *
 * Thứ tự "ghi log trước, làm sau" là CỐ Ý và lệch với trực giác. Nếu làm trước
 * rồi ghi log sau, một lỗi giữa hai bước sẽ khiến việc đã làm mà không có dấu →
 * ngày mai làm lại. Với một tin Zalo gửi cho khách thì gửi hai lần tệ hơn hẳn
 * không gửi lần nào.
 */
export async function GET(req: NextRequest) {
  // Fail-closed: thiếu CRON_SECRET thì KHOÁ, không mở. Nếu không, ai cũng gọi
  // được endpoint gửi Zalo hàng loạt này.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = todayVN();

  // Chỉ những studio ĐÃ CÓ dòng cấu hình nào bật. Studio chưa bao giờ mở màn
  // cấu hình vẫn được chạy các luật `onByDefault` — nhưng để làm được điều đó
  // mà không quét toàn bộ tài khoản mstudo mỗi ngày, ta chỉ xét studio có hợp
  // đồng đang chạy (truy vấn dưới đây đã lọc theo trạng thái).
  const { data: cfgRows } = await db
    .from("studio_automations")
    .select("owner_id, rule, enabled, offset_days, message");

  const cfgByOwner = new Map<string, Record<string, AutomationConfig>>();
  for (const r of (cfgRows ?? []) as {
    owner_id: string; rule: string; enabled: boolean; offset_days: number | null; message: string | null;
  }[]) {
    if (!cfgByOwner.has(r.owner_id)) cfgByOwner.set(r.owner_id, {});
    cfgByOwner.get(r.owner_id)![r.rule] = {
      rule: r.rule,
      enabled: r.enabled,
      days: r.offset_days,
      message: r.message,
    };
  }

  // Hợp đồng còn "sống": đã gửi / đã duyệt / đang chạy / vừa hoàn thành. Hợp
  // đồng huỷ và hợp đồng nháp không sinh việc gì (bộ luật cũng tự chặn 'cancelled').
  const { data: contracts } = await db
    .from("studio_contracts")
    .select(
      "id, owner_id, title, client_name, client_phone, status, client_signed_at, event_date, selection_album_id, gallery_album_id"
    )
    .in("status", ["sent", "approved", "in_progress", "completed"])
    .limit(2000);

  const list = (contracts ?? []) as {
    id: string; owner_id: string; title: string; client_name: string | null; client_phone: string | null;
    status: string; client_signed_at: string | null; event_date: string | null;
    selection_album_id: string | null; gallery_album_id: string | null;
  }[];
  if (list.length === 0) return NextResponse.json({ ok: true, contracts: 0, done: 0 });

  const ids = list.map((c) => c.id);
  const albumIds = [
    ...new Set(list.flatMap((c) => [c.selection_album_id, c.gallery_album_id]).filter(Boolean) as string[]),
  ];

  const [{ data: plans }, { data: albums }, { data: log }] = await Promise.all([
    db
      .from("contract_payment_plan")
      .select("id, contract_id, label, amount, due_date, paid")
      .in("contract_id", ids),
    albumIds.length
      ? db.from("albums").select("id, selection_done_at, delivered_at").in("id", albumIds)
      : Promise.resolve({ data: [] as { id: string; selection_done_at: string | null; delivered_at: string | null }[] }),
    db.from("studio_automation_log").select("dedupe_key").in("contract_id", ids),
  ]);

  const duesBy = new Map<string, ContractSnapshot["dues"]>();
  for (const p of (plans ?? []) as {
    id: string; contract_id: string; label: string; amount: number; due_date: string | null; paid: boolean;
  }[]) {
    if (!duesBy.has(p.contract_id)) duesBy.set(p.contract_id, []);
    duesBy.get(p.contract_id)!.push({
      id: p.id, label: p.label, amount: p.amount, dueDate: p.due_date, paid: p.paid,
    });
  }

  const albumBy = new Map(
    ((albums ?? []) as { id: string; selection_done_at: string | null; delivered_at: string | null }[]).map((a) => [a.id, a])
  );
  const fired = new Set(((log ?? []) as { dedupe_key: string }[]).map((r) => r.dedupe_key));

  // ── Tính việc phải làm ───────────────────────────────────────────────────
  const pending: (PendingAction & { ownerId: string })[] = [];
  for (const c of list) {
    const sel = c.selection_album_id ? albumBy.get(c.selection_album_id) : null;
    const gal = c.gallery_album_id ? albumBy.get(c.gallery_album_id) : null;
    const snap: ContractSnapshot = {
      id: c.id,
      title: c.title,
      clientName: c.client_name,
      clientPhone: c.client_phone,
      status: c.status,
      signedAt: c.client_signed_at,
      eventDate: c.event_date,
      selectionDoneAt: sel?.selection_done_at ?? null,
      // Album giao khách là nơi có mốc giao thật; nếu studio chỉ có một album
      // (dự án hợp nhất) thì mốc nằm trên chính album chọn ảnh.
      deliveredAt: gal?.delivered_at ?? sel?.delivered_at ?? null,
      dues: duesBy.get(c.id) ?? [],
    };
    for (const a of dueActions(snap, cfgByOwner.get(c.owner_id) ?? {}, fired, today)) {
      pending.push({ ...a, ownerId: c.owner_id });
    }
  }

  // ── Thi hành ─────────────────────────────────────────────────────────────
  let done = 0;
  const failed: string[] = [];
  for (const a of pending) {
    // LỚP 2: ghi dấu TRƯỚC. Trùng khoá (đã có lượt cron khác làm) → bỏ qua.
    const { error: logErr } = await db.from("studio_automation_log").insert({
      owner_id: a.ownerId,
      rule: a.rule,
      contract_id: a.contractId,
      dedupe_key: a.dedupeKey,
    });
    if (logErr) continue; // 23505 = trùng unique → việc này đã được làm rồi

    try {
      if (a.action === "task") {
        await db.from("contract_tasks").insert({ contract_id: a.contractId, label: a.message });
      } else if (a.action === "notify") {
        await db.from("studio_notifications").insert({
          owner_id: a.ownerId,
          contract_id: a.contractId,
          kind: "info",
          message: a.message,
        });
        await sendPushToOwner(a.ownerId, {
          title: "mstudo",
          body: a.message,
          url: `/dashboard/studio/contracts/${a.contractId}`,
          tag: `auto-${a.rule}-${a.contractId}`,
        }).catch(() => {});
      } else if (a.action === "zalo" && a.toPhone) {
        await sendZalo({
          ownerId: a.ownerId,
          toPhone: a.toPhone,
          body: a.message,
          kind: `auto_${a.rule}`,
        });
      }
      done++;
    } catch (e) {
      // Việc đã có dấu nên KHÔNG chạy lại ngày mai — đó là đánh đổi đã chọn ở
      // đầu file (gửi hai lần tệ hơn không gửi). Ghi lại để còn lần được.
      failed.push(`${a.dedupeKey}: ${e instanceof Error ? e.message : "lỗi"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    contracts: list.length,
    pending: pending.length,
    done,
    ...(failed.length ? { failed } : {}),
  });
}
