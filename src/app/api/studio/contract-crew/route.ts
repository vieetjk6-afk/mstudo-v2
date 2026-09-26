import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoNotify } from "@/lib/zalo/notify";
import { showLabel, crewPortalUrl } from "@/lib/crew-show";
import { fmtDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

function normTime(v: string | null | undefined): string | null {
  // Chấp nhận cả GIÂY: <input type="time"> ở Safari/một số trình duyệt di động
  // trả "08:00:00" chứ không phải "08:00". Regex cũ loại thẳng giá trị đó và trả
  // null, nên giờ biến mất im lặng trong khi task/side (kiểu text) vẫn lưu được.
  const m = (v ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23 || Number(m[2]) > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

type CrewInput = {
  id?: string;
  name?: string;
  phone?: string;
  role?: string;
  salary?: number;
  note?: string;
  task?: string;
  side?: string;
  start?: string;
  end?: string;
  /** Mốc thời gian (studio_events.id) của hợp đồng; trống = buổi chính. */
  eventId?: string;
};

/** Hợp đồng này có thuộc studio đang đăng nhập không. */
async function loadContract(contractId: string) {
  const profile = await requireStudio();
  if (!profile) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  const db = createAdminClient();
  const { data: contract } = await db
    .from("studio_contracts")
    .select("id, owner_id, assigned_to, title, event_date, event_time, location")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract || contract.owner_id !== profile.id) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  // Nhân viên thường CHỈ sửa nhân sự/lương của hợp đồng ĐƯỢC GIAO cho mình —
  // giống cách contracts-list lọc theo assigned_to. Trước đây route chỉ kiểm
  // "thuộc studio", nên một nhân viên gọi thẳng API có thể sửa đội ngũ và LƯƠNG
  // của bất kỳ hợp đồng nào trong studio. Quản lý/kế toán/chủ không bị giới hạn.
  if (profile.actingRole === "staff" && contract.assigned_to !== profile.actingUserId) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { db, contract, ownerId: profile.id };
}

/**
 * GET ?date=YYYY-MM-DD[&exclude=<contractId>]
 *
 * Ai trong sổ thợ đã bận ngày đó — dùng để cảnh báo NGAY LÚC CHỌN thợ, trước khi
 * studio lỡ gán trùng. Gộp cả hai nguồn bận: mốc lịch thợ tự báo/studio xếp, và
 * phân công ở hợp đồng khác.
 */
export async function GET(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ busy: {} });
  const exclude = url.searchParams.get("exclude");

  const db = createAdminClient();
  const { data: roster } = await db.from("studio_crew").select("phone").eq("owner_id", profile.id);
  const phones = (roster ?? []).map((r) => digits(r.phone as string)).filter(Boolean);
  if (!phones.length) return NextResponse.json({ busy: {} });

  const [{ data: marks }, { data: assigns }] = await Promise.all([
    // Cách ly: chỉ mốc thuộc studio này. Thợ bận vì studio khác là việc của họ,
    // không lộ sang đây — đổi lại studio này chỉ được cảnh báo dựa trên những
    // gì thợ đã báo RIÊNG cho mình.
    db
      .from("crew_unavailable")
      .select("phone, start_time, end_time, title, note")
      .eq("date", date)
      .in("phone", phones)
      .eq("owner_id", profile.id),
    (async () => {
      // Thợ gán theo MỐC (event_id) không làm ở ngày buổi chính — mốc lịch của
      // họ đã nằm trong crew_unavailable ở trên. Chưa có cột thì lùi lối cũ.
      const q = (cols: string) =>
        db
          .from("contract_crew")
          .select(cols)
          .eq("contract.owner_id", profile.id)
          .eq("contract.event_date", date);
      const r = await q("phone, event_id, contract:studio_contracts!inner(id, owner_id, title, event_date, status)");
      return r.error ? q("phone, contract:studio_contracts!inner(id, owner_id, title, event_date, status)") : r;
    })(),
  ]);

  const busy: Record<string, string[]> = {};
  for (const m of (marks ?? []) as Array<{ phone: string; start_time: string | null; end_time: string | null; title: string | null; note: string | null }>) {
    const p = digits(m.phone);
    const when = m.start_time && m.end_time ? `${m.start_time.slice(0, 5)}–${m.end_time.slice(0, 5)}` : "cả ngày";
    (busy[p] ||= []).push(`${when}${m.title ? ` · ${m.title}` : m.note ? ` · ${m.note}` : ""}`);
  }
  type A = { phone: string | null; event_id?: string | null; contract: { id: string; title: string; status: string } | null };
  for (const a of (assigns ?? []) as unknown as A[]) {
    if (!a.contract || a.contract.status === "cancelled" || a.event_id) continue;
    if (exclude && a.contract.id === exclude) continue; // hợp đồng đang mở thì không tự báo trùng chính nó
    const p = digits(a.phone);
    if (p) (busy[p] ||= []).push(`Hợp đồng “${a.contract.title}”`);
  }

  return NextResponse.json({ busy });
}

/**
 * POST { contractId, crew: [...] } — lưu danh sách nhân sự của hợp đồng.
 *
 * Chạy phía SERVER thay vì ghi thẳng từ client vì mỗi lần lưu còn kéo theo hai
 * việc client không làm được: ghi mốc lịch của thợ (bảng crew_unavailable chỉ
 * mở policy đọc, ghi phải qua service role) và gửi Zalo (cần bí mật của studio).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { contractId?: string; crew?: CrewInput[] } | null;
  if (!body?.contractId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const g = await loadContract(body.contractId);
  if (g.error) return g.error;
  const { db, contract, ownerId } = g as { db: ReturnType<typeof createAdminClient>; contract: { id: string; title: string; event_date: string | null; event_time: string | null; location: string | null }; ownerId: string };

  // Link cổng thợ RIÊNG của studio này để thợ bấm vào xem luôn các lịch khác.
  // Không có token thì dùng cổng chung — vẫn tra được bằng SĐT.
  const { data: me } = await db.from("profiles").select("crew_token").eq("id", ownerId).maybeSingle();
  const portal = crewPortalUrl(me?.crew_token as string | null);

  // Các mốc thời gian của CHÍNH hợp đồng này — chỉ nhận eventId nằm trong đây,
  // để không ai gán thợ vào mốc của hợp đồng khác bằng cách sửa request.
  const { data: evRows } = await db
    .from("studio_events")
    .select("id, title, event_date, event_time")
    .eq("contract_id", contract.id);
  const events = new Map(
    ((evRows ?? []) as { id: string; title: string; event_date: string; event_time: string | null }[]).map((e) => [e.id, e]),
  );

  const { error: colErr } = await db.from("contract_crew").select("event_id").limit(1);
  const hasEventCol = !colErr;
  if (!hasEventCol && (body.crew ?? []).some((c) => c.eventId)) {
    return NextResponse.json(
      { error: "Chưa gán được mốc thời gian: chạy supabase/migrations/contract_crew_milestone.sql rồi Reload schema cache." },
      { status: 500 },
    );
  }

  const notified: string[] = [];
  // Chẩn đoán giờ: ghi lại giá trị THÔ client gửi, giá trị sau chuẩn hoá, và giá
  // trị ĐỌC LẠI từ DB. Ba con số đó chỉ đúng một thủ phạm, khỏi đoán tiếp.
  const timeTrace: { name: string; sent: string; norm: string; db: string }[] = [];

  for (const [idx, c] of (body.crew ?? []).entries()) {
    const name = (c.name ?? "").trim();
    const phone = (c.phone ?? "").trim();
    if (!name && !phone) continue;

    // Gửi giờ lên mà chuẩn hoá ra null nghĩa là định dạng lạ — báo ngay thay vì
    // lưu null rồi để studio tưởng đã lưu.
    for (const [field, raw] of [["Từ giờ", c.start], ["Đến giờ", c.end]] as const) {
      if ((raw ?? "").trim() && !normTime(raw)) {
        return NextResponse.json({ error: `${field} không hợp lệ: "${raw}"` }, { status: 400 });
      }
    }

    const ev = c.eventId ? events.get(c.eventId) ?? null : null;

    const row = {
      name,
      phone: phone || null,
      role: c.role || "photographer",
      salary: Math.max(0, Math.round(Number(c.salary) || 0)),
      note: (c.note ?? "").trim() || null,
      task: c.task || null,
      side: c.side || null,
      start_time: normTime(c.start),
      end_time: normTime(c.end),
      position: idx,
      // Chưa chạy migration contract_crew_milestone.sql thì bỏ cột này đi —
      // vẫn lưu buổi chính như cũ thay vì hỏng cả lần lưu.
      ...(hasEventCol ? { event_id: ev?.id ?? null } : {}),
    };

    // Trước đây chỗ này âm thầm lùi về bộ cột cũ khi ghi hỏng, nên thiếu cột
    // task/side lại báo "đã lưu" và studio không hiểu vì sao mất dữ liệu. Nay
    // lỗi được trả thẳng ra: thà báo hỏng còn hơn nuốt mất thông tin.
    let assignId = c.id ?? null;
    const isNew = !assignId;
    if (assignId) {
      const { error } = await db.from("contract_crew").update(row).eq("id", assignId).eq("contract_id", contract.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { data, error } = await db
        .from("contract_crew")
        .insert({ ...row, contract_id: contract.id })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      assignId = (data?.id as string) ?? null;
    }
    if (!assignId) continue;

    // Tự kiểm chứng: đọc lại đúng dòng vừa ghi. PostgREST giữ một bản cache lược
    // đồ; cột mới thêm mà cache chưa nạp lại thì có trường hợp giá trị bị BỎ QUA
    // lặng lẽ thay vì báo lỗi — nhìn ra ngoài y hệt "bấm lưu không ăn". Thà báo
    // rõ còn hơn để studio nhập lại lần thứ ba.
    // Đọc lại dòng vừa ghi cho MỌI người: có vết đầy-đủ mới truy được lỗi, chứ
    // chỉ ghi vết khi đã nghi ngờ thì đúng ca khó lại không có dữ liệu.
    const { data: check, error: checkErr } = await db
      .from("contract_crew")
      .select("task, side, start_time, end_time")
      .eq("id", assignId)
      .maybeSingle();
    timeTrace.push({
      name: name || phone,
      sent: (c.start ?? "") as string,
      norm: row.start_time ?? "",
      db: checkErr ? `LỖI ĐỌC: ${checkErr.message}` : ((check?.start_time as string | null)?.slice(0, 5) ?? ""),
    });

    if (row.start_time || row.task || row.side) {
      const missing: string[] = [];
      if (row.task && !check?.task) missing.push("task");
      if (row.side && !check?.side) missing.push("side");
      if (row.start_time && !check?.start_time) missing.push("start_time");
      if (row.end_time && !check?.end_time) missing.push("end_time");
      if (missing.length) {
        return NextResponse.json(
          {
            error: `Cột ${missing.join(", ")} không nhận được giá trị. Chạy supabase/migrations/crew_profile_show.sql, rồi vào Supabase → Settings → API → Reload schema cache.`,
          },
          { status: 500 },
        );
      }
    }

    // ── Ghi mốc vào lịch của thợ ─────────────────────────────────────────
    // Nối bằng contract_crew_id: mỗi phân công đúng MỘT mốc, sửa thì cập nhật
    // tại chỗ chứ không đẻ thêm; gỡ thợ khỏi hợp đồng thì cascade tự xoá.
    // Gán vào một mốc thì lịch thợ lấy NGÀY/GIỜ của mốc, và tên mốc đứng trước
    // tên hợp đồng: "Đãi trước · HĐ PSC 20/10 · Chụp".
    const date = ev?.event_date ?? contract.event_date;
    if (phone && date) {
      const label = showLabel({ title: ev ? `${ev.title} · ${contract.title}` : contract.title, task: c.task, side: c.side });
      const start = row.start_time ?? normTime(ev ? ev.event_time : contract.event_time);
      const end = row.end_time;
      const entry = {
        phone: digits(phone),
        date,
        start_time: start,
        end_time: end,
        overnight: !!(start && end && end <= start),
        title: label,
        owner_id: ownerId,
        created_by: "studio",
        contract_crew_id: assignId,
      };
      const { data: existing, error: findErr } = await db
        .from("crew_unavailable")
        .select("id")
        .eq("contract_crew_id", assignId)
        .maybeSingle();
      if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
      const { error: wErr } = existing?.id
        ? await db.from("crew_unavailable").update(entry).eq("id", existing.id)
        : await db.from("crew_unavailable").insert(entry);
      if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

      // ── Báo Zalo cho thợ (chỉ lần gán ĐẦU) ─────────────────────────────
      // autoNotify tự bỏ qua nếu studio chưa kết nối Zalo hoặc chưa bật mốc
      // này, nên ở đây không cần kiểm tra gì thêm.
      if (isNew) {
        const when = `${fmtDate(date)}${start ? ` lúc ${start}` : ""}`;
        const r = await autoNotify({
          ownerId,
          event: "crew_assigned",
          audience: "crew",
          toPhone: phone,
          toName: name || null,
          body: `Bạn được xếp lịch: ${label} — ${when}${contract.location ? ` tại ${contract.location}` : ""}.\nXác nhận và xem các lịch khác của bạn: ${portal}`,
          templateData: {
            name: name || "",
            show: label,
            date: fmtDate(date),
            time: start ?? "",
            location: contract.location ?? "",
            link: portal,
          },
          contractId: contract.id,
        });
        if (r.ok) notified.push(phone);
      }
    }
  }

  return NextResponse.json({ ok: true, notified: notified.length, timeTrace });
}
