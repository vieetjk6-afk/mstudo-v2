import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDesktopOwner } from "@/lib/desktop/auth";
import { autoCreateContractSelectionOnProduction } from "@/lib/studio-drive";
import { deliverContractIfReady } from "@/lib/contract-delivery";
import { syncContractCalendar } from "@/lib/gcal-sync";

export const dynamic = "force-dynamic";

/**
 * Ghi dữ liệu cho MStudo Desktop (các module chạy cục bộ trong client).
 * Client tạo/sửa NGAY trên máy (tức thì), rồi gửi thao tác lên đây để đồng bộ.
 *   POST { table, op: "insert"|"update"|"delete", row }
 * An toàn: chỉ bảng trong whitelist, chỉ cột cho phép, owner_id LUÔN ép về tài
 * khoản hiện tại; update/delete phải đúng bản ghi thuộc tài khoản.
 * Client tự sinh `id` (uuid) khi insert → id cục bộ trùng id server, không cần
 * ánh xạ lại. Bảng con (contract_*) kiểm tra hợp đồng cha thuộc tài khoản.
 */

type TableCfg = { owner?: true; parent?: { col: string; table: string }; cols: string[] };

const TABLES: Record<string, TableCfg> = {
  studio_expenses: { owner: true, cols: ["title", "amount", "category", "spent_at", "note", "contract_id", "client_visible"] },
  studio_bookings: { owner: true, cols: ["name", "phone", "service", "preferred_date", "note", "status", "package_name", "package_price", "facebook"] },
  studio_crew: { owner: true, cols: ["name", "phone", "role", "note"] },
  studio_events: { owner: true, cols: ["contract_id", "title", "event_date", "event_time", "note", "remind"] },
  studio_contracts: { owner: true, cols: ["code", "title", "client_name", "client_phone", "client_email", "shoot_type", "event_date", "event_time", "location", "status", "deposit", "note", "client_token"] },
  studio_quotes: { owner: true, cols: ["code", "title", "client_name", "client_phone", "client_email", "event_date", "location", "intro", "note", "deposit_percent", "status", "client_token"] },
  quote_items: { parent: { col: "quote_id", table: "studio_quotes" }, cols: ["quote_id", "name", "description", "qty", "unit_price", "is_optional", "selected", "position"] },
  studio_pricelist: { owner: true, cols: ["list_key", "name", "price", "unit", "category", "description", "active", "position"] },
  studio_equipment: { owner: true, cols: ["name", "category", "note", "active"] },
  studio_services: { owner: true, cols: ["name", "clauses", "position", "active"] },
  // Bảng con: sửa hạng mục / thanh toán / lương của hợp đồng thuộc tài khoản.
  contract_items: { parent: { col: "contract_id", table: "studio_contracts" }, cols: ["contract_id", "name", "qty", "unit_price", "position"] },
  contract_payments: { parent: { col: "contract_id", table: "studio_contracts" }, cols: ["contract_id", "amount", "method", "kind", "note", "paid_at"] },
  contract_crew: { parent: { col: "contract_id", table: "studio_contracts" }, cols: ["contract_id", "name", "phone", "role", "salary", "status", "note", "paid", "paid_at", "position"] },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Row = Record<string, unknown>;
const pick = (row: Row, cols: string[]): Row => {
  const out: Row = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
};

export async function POST(req: Request) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const owner = auth.ownerId;
  const db = createAdminClient();

  const body = (await req.json().catch(() => null)) as { table?: string; op?: string; row?: Row } | null;
  const cfg = body?.table ? TABLES[body.table] : undefined;
  const table = (body?.table ?? "") as string;
  const op = body?.op;
  const row = (body?.row || {}) as Row;
  if (!cfg || !["insert", "update", "delete"].includes(op || "")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const id = typeof row.id === "string" ? row.id : "";
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  // Kiểm tra quyền sở hữu cho update/delete (và parent cho bảng con).
  async function ownsParent(parentId: unknown): Promise<boolean> {
    if (!cfg!.parent || typeof parentId !== "string") return false;
    const { data } = await db.from(cfg!.parent.table).select("owner_id").eq("id", parentId).maybeSingle();
    return (data as { owner_id?: string } | null)?.owner_id === owner;
  }
  async function ownsExisting(): Promise<boolean> {
    if (cfg!.owner) {
      const { data: o } = await db.from(table).select("owner_id").eq("id", id).maybeSingle();
      return (o as { owner_id?: string } | null)?.owner_id === owner;
    }
    // Bảng con: xác minh HỢP ĐỒNG/BÁO GIÁ CHA CỦA BẢN GHI HIỆN CÓ thuộc owner.
    // KHÔNG tin parent_id do client gửi — nếu không, kẻ tấn công gửi id của
    // studio khác kèm parent_id của chính mình để xóa/cướp bản ghi chéo tenant.
    if (cfg!.parent) {
      const { data: existing } = await db.from(table).select(cfg!.parent.col).eq("id", id).maybeSingle();
      if (!existing) return false;
      return ownsParent((existing as unknown as Record<string, unknown>)[cfg!.parent.col]);
    }
    return false;
  }

  try {
    if (op === "delete") {
      if (cfg.owner) {
        const { error } = await db.from(table).delete().eq("id", id).eq("owner_id", owner);
        if (error) throw error;
      } else {
        if (!(await ownsExisting())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
        const { error } = await db.from(table).delete().eq("id", id);
        if (error) throw error;
      }
      return NextResponse.json({ ok: true, id });
    }

    const payload = pick(row, cfg.cols);
    if (cfg.owner) payload.owner_id = owner;
    if (cfg.parent) {
      const pid = payload[cfg.parent.col] ?? row[cfg.parent.col];
      if (!(await ownsParent(pid))) return NextResponse.json({ error: "forbidden_parent" }, { status: 403 });
    }

    if (op === "insert") {
      payload.id = id;
      const { data, error } = await db.from(table).insert(payload).select("*").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, row: data });
    }
    // update
    if (cfg.owner) {
      const { data, error } = await db.from(table).update(payload).eq("id", id).eq("owner_id", owner).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
      // Hợp đồng chuyển trạng thái từ desktop:
      //  - sang "đang thực hiện"/"hoàn thành" → giờ mới tạo album CHỌN ẢNH.
      //  - sang "hoàn thành" → tạo thêm album GIAO KHÁCH, nhưng chỉ khi thư mục
      //    ảnh chỉnh sửa đã có ảnh (hoàn thành = thu đủ tiền, không có nghĩa hậu
      //    kỳ đã xong) — xem @/lib/contract-delivery.
      if (table === "studio_contracts" && (payload.status === "in_progress" || payload.status === "completed")) {
        try {
          await autoCreateContractSelectionOnProduction(owner, id);
        } catch {
          /* studio chưa nối Drive / lỗi tạm — lần đồng bộ sau tạo bù */
        }
      }
      if (table === "studio_contracts" && payload.status === "completed") {
        await deliverContractIfReady(owner, id, { notifyExisting: true });
      }
      // App máy tính sửa hợp đồng (ngày, giờ, nơi chụp, trạng thái) thì Google
      // Lịch phải đổi theo. Máy tính không chạy trong trình duyệt đã đăng nhập
      // web, nên đây là chỗ DUY NHẤT bắt được thay đổi đó.
      if (table === "studio_contracts") {
        await syncContractCalendar(owner, id);
      }
      return NextResponse.json({ ok: true, row: data });
    } else {
      if (!(await ownsExisting())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const { data, error } = await db.from(table).update(payload).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return NextResponse.json({ ok: true, row: data });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || String(e) }, { status: 500 });
  }
}
