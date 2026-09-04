import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToOwner } from "@/lib/push";
import { sendZalo } from "@/lib/zalo/send";
import { sendEmail } from "@/lib/email";
import { mainUrl } from "@/lib/hosts";
import { todayVN } from "@/lib/date";
import {
  dueActions,
  deliveryFor,
  emailSubject,
  type AutomationConfig,
  type ContractSnapshot,
  type PendingAction,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

/** Thoát HTML cho thân thư — câu chữ do studio gõ, không được lọt thẻ vào. */
const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]!);

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
 *
 * NGOẠI LỆ DUY NHẤT của thứ tự đó: việc nhắn khách mà KHÔNG CÒN ĐƯỜNG NÀO ra
 * (studio chưa nối Zalo và khách không có email) thì bỏ qua mà không ghi dấu —
 * xem `deliveryFor`. Ghi dấu một việc chưa gửi được là cách làm mất hẳn nó, còn
 * để nguyên thì mai studio nối Zalo hoặc điền email khách là nó đi được. Vì vậy
 * khả năng gửi phải biết TRƯỚC khi ghi dấu, nên cấu hình Zalo được hỏi một lần
 * cho cả lượt chạy thay vì để `sendZalo` tự tra rồi báo hỏng lúc đã muộn.
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
      "id, owner_id, title, client_name, client_phone, client_email, client_token, status, client_signed_at, event_date, selection_album_id, gallery_album_id"
    )
    .in("status", ["sent", "approved", "in_progress", "completed"])
    .limit(2000);

  const list = (contracts ?? []) as {
    id: string; owner_id: string; title: string; client_name: string | null; client_phone: string | null;
    client_email: string | null; client_token: string | null;
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

  // Studio nào GỬI ZALO ĐƯỢC, hỏi MỘT lần cho cả lượt chạy. `sendZalo` tự tra
  // lại cấu hình mỗi lần gọi, nhưng ta cần biết TRƯỚC khi ghi dấu chống lặp:
  // một việc không có đường nào tới khách phải để nguyên cho ngày mai, chứ ghi
  // dấu rồi mới phát hiện là mất hẳn việc đó.
  const owners = [...new Set(list.map((c) => c.owner_id))];
  const [{ data: zaloRows }, { data: ownerRows }] = await Promise.all([
    db.from("studio_zalo").select("owner_id, status").in("owner_id", owners),
    db.from("profiles").select("id, full_name").in("id", owners),
  ]);
  const zaloReady = new Set(
    ((zaloRows ?? []) as { owner_id: string; status: string }[])
      .filter((r) => r.status === "connected")
      .map((r) => r.owner_id)
  );
  const studioName = new Map(
    ((ownerRows ?? []) as { id: string; full_name: string | null }[]).map((r) => [r.id, r.full_name || "Studio"])
  );
  // Máy chủ chưa có RESEND_API_KEY thì KHÔNG có kênh email — nói ra ở đây thay
  // vì để `sendEmail` trả "not_configured" sau khi đã ghi dấu.
  const mailReady = !!process.env.RESEND_API_KEY;
  // Thư nhắn khách kèm một đường dẫn về trang của chính họ — cùng chỗ mà nhịp
  // nhắc việc 7:00 đang dùng (/portal/<token>), không sinh đường dẫn thứ hai.
  const tokenOf = new Map(list.map((c) => [c.id, c.client_token]));

  /**
   * Gửi câu chữ của một luật qua email.
   *
   * Câu chữ ấy viết cho KHUNG CHAT: một đoạn, không tiêu đề. Nên chỉ bọc đúng
   * một lớp HTML tối giản chứ không dựng mẫu thư riêng — chữ studio đã đọc và
   * duyệt ở màn cấu hình phải tới khách y như thế.
   */
  const mail = (a: PendingAction & { ownerId: string }) => {
    const studio = studioName.get(a.ownerId) || "Studio";
    const tok = tokenOf.get(a.contractId);
    const link = tok ? mainUrl(`/portal/${tok}`) : "";
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222">
<p style="white-space:pre-wrap">${esc(a.message)}</p>
${link ? `<p><a href="${link}">Mở trang của bạn →</a></p>` : ""}
<p style="color:#888;font-size:12px">Email tự động từ ${esc(studio)}.</p></div>`;
    return sendEmail({ to: a.toEmail!, subject: emailSubject(a.rule, studio), html });
  };

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
      clientEmail: c.client_email,
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
  let unreachable = 0;
  for (const a of pending) {
    // Kênh nào? Với việc nhắn khách, `deliveryFor` trả null khi không còn đường
    // nào — bỏ qua mà KHÔNG ghi dấu, để mai studio nối Zalo hoặc điền email
    // khách là việc này đi được.
    const via = deliveryFor(a.action, a.fallback, {
      zalo: zaloReady.has(a.ownerId) && !!a.toPhone,
      email: mailReady && !!a.toEmail,
    });
    if (!via) {
      unreachable++;
      continue;
    }

    // LỚP 2: ghi dấu TRƯỚC. Trùng khoá (đã có lượt cron khác làm) → bỏ qua.
    const { error: logErr } = await db.from("studio_automation_log").insert({
      owner_id: a.ownerId,
      rule: a.rule,
      contract_id: a.contractId,
      dedupe_key: a.dedupeKey,
    });
    if (logErr) continue; // 23505 = trùng unique → việc này đã được làm rồi

    try {
      if (via === "task") {
        await db.from("contract_tasks").insert({ contract_id: a.contractId, label: a.message });
      } else if (via === "notify") {
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
      } else if (via === "zalo" && a.toPhone) {
        const z = await sendZalo({
          ownerId: a.ownerId,
          toPhone: a.toPhone,
          body: a.message,
          kind: `auto_${a.rule}`,
        });
        // Studio ĐÃ nối Zalo mà tin vẫn không đi (token hết hạn, khách chưa
        // từng nhắn OA nên không có uid) → rơi về email ngay trong lượt này.
        // Việc đã ghi dấu rồi, để dành cho mai là mất hẳn; và vì kênh chính
        // hỏng nên khách chỉ nhận MỘT tin, không phải hai.
        if (!z.ok && a.fallback === "email" && mailReady && a.toEmail) {
          const r = await mail(a);
          if (!r.ok) throw new Error(r.error || "email_failed");
        }
      } else if (via === "email" && a.toEmail) {
        const r = await mail(a);
        if (!r.ok) throw new Error(r.error || "email_failed");
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
    unreachable,
    done,
    ...(failed.length ? { failed } : {}),
  });
}
