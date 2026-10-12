import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDesktopOwner } from "@/lib/desktop/auth";
import { buildXlsx, type Sheet } from "@/lib/desktop/xlsx";
import { crewRoleLabel, loadCrewRoles } from "@/lib/crew-roles";

export const dynamic = "force-dynamic";

/**
 * Xuất dữ liệu cho MStudo Desktop (và nút "Xuất ngay" trên web):
 *   GET /api/desktop/export?type=customers|quotes|expenses|payroll|bookings|staff  → .xlsx
 *   GET /api/desktop/export?type=backup                                           → .json đầy đủ (khôi phục ngược)
 *   GET /api/desktop/export?type=backup&lite=1[&have=<hash>]                      → bản nhẹ cho cache offline của desktop
 *       (bỏ ảnh chữ ký data-URL; trùng hash máy đang giữ → 304 rỗng, không gửi lại cả cục JSON)
 * Mỗi mảng 1 file. Chỉ chủ studio (phiên web) hoặc thiết bị đã đăng ký.
 */

type Db = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const dmy = (s: unknown) => {
  if (!s || typeof s !== "string") return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const S = (v: unknown): string => (v == null ? "" : String(v));
const N = (v: unknown): number => Number(v) || 0;

// Phân trang đến hết thay vì cắt cứng ở 10.000 dòng — studio lớn mà bị cắt thì
// bản backup JSON thiếu dữ liệu và restore sẽ MẤT dữ liệu một cách im lặng.
const PAGE = 1000;

// Truy vấn lỗi mà nuốt đi thì bản backup thiếu dữ liệu một cách im lặng — đúng
// thứ đã khiến "web một đằng, app một nẻo" không ai truy được. Ném ra để route
// trả 500 thay vì trả một bản backup cụt.
function orThrow(table: string, error: { message: string } | null) {
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function all(db: Db, table: string, select: string, owner: string, ownerCol = "owner_id"): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(select).eq(ownerCol, owner).order("id").range(from, from + PAGE - 1);
    orThrow(table, error);
    const rows = (data as Row[] | null) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function byIds(db: Db, table: string, col: string, ids: string[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select("*").in(col, slice).order("id").range(from, from + PAGE - 1);
      orThrow(table, error);
      const rows = (data as Row[] | null) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

const QUOTE_STATUS: Record<string, string> = {
  draft: "Nháp", sent: "Đã gửi", viewed: "Khách đã xem", adjust_requested: "Khách xin điều chỉnh",
  accepted: "Đã chốt", converted: "Đã chuyển hợp đồng", expired: "Hết hạn", cancelled: "Đã hủy",
};
const BOOKING_STATUS: Record<string, string> = { new: "Mới", handled: "Đã xử lý", archived: "Lưu trữ" };
const CREW_STATUS: Record<string, string> = { pending: "Chờ nhận", accepted: "Đã nhận", declined: "Từ chối" };

function xlsxResponse(bytes: Uint8Array, name: string) {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const owner = auth.ownerId;
  const db = createAdminClient();
  const type = new URL(req.url).searchParams.get("type") || "";
  const today = new Date().toISOString().slice(0, 10);

  if (type === "customers") {
    // Danh bạ khách gộp từ hợp đồng (giống trang Khách hàng).
    const rows = await all(db, "studio_contracts", "client_name, client_phone, client_email, event_date, created_at", owner);
    const map = new Map<string, { name: string; phone: string; email: string; count: number; last: string }>();
    for (const r of rows) {
      const key = (S(r.client_phone).replace(/\D/g, "") || S(r.client_name)).toLowerCase() || "?";
      const cur = map.get(key) || { name: S(r.client_name), phone: S(r.client_phone), email: "", count: 0, last: "" };
      cur.count += 1;
      if (!cur.email && r.client_email) cur.email = S(r.client_email);
      const d = S(r.event_date) || S(r.created_at).slice(0, 10);
      if (d > cur.last) cur.last = d;
      map.set(key, cur);
    }
    const sheet: Sheet = {
      name: "Khách hàng",
      columns: ["Tên khách", "SĐT", "Email", "Số hợp đồng", "Lần gần nhất"],
      rows: [...map.values()]
        .sort((a, b) => (b.last > a.last ? 1 : -1))
        .map((c) => [c.name, c.phone, c.email, c.count, dmy(c.last)]),
    };
    return xlsxResponse(await buildXlsx([sheet]), `KhachHang_${today}.xlsx`);
  }

  if (type === "quotes") {
    const quotes = await all(db, "studio_quotes", "id, code, title, client_name, client_phone, event_date, status, created_at", owner);
    const items = await byIds(db, "quote_items", "quote_id", quotes.map((q) => S(q.id)));
    const totals = new Map<string, number>();
    for (const it of items) {
      if (it.is_optional && it.selected === false) continue;
      totals.set(S(it.quote_id), (totals.get(S(it.quote_id)) || 0) + N(it.qty) * N(it.unit_price));
    }
    const sheet: Sheet = {
      name: "Báo giá",
      columns: ["Mã", "Tiêu đề", "Khách", "SĐT", "Ngày sự kiện", "Trạng thái", "Tổng (VND)", "Ngày tạo"],
      rows: quotes.map((q) => [S(q.code), S(q.title), S(q.client_name), S(q.client_phone), dmy(q.event_date), QUOTE_STATUS[S(q.status)] || S(q.status), totals.get(S(q.id)) || 0, dmy(q.created_at)]),
    };
    return xlsxResponse(await buildXlsx([sheet]), `BaoGia_${today}.xlsx`);
  }

  if (type === "expenses") {
    const rows = await all(db, "studio_expenses", "title, amount, category, spent_at, contract_id", owner);
    const contracts = await all(db, "studio_contracts", "id, code", owner);
    const codeById = new Map(contracts.map((c) => [S(c.id), S(c.code)]));
    const sheet: Sheet = {
      name: "Chi tiêu",
      columns: ["Ngày chi", "Nội dung", "Danh mục", "Số tiền (VND)", "Mã HĐ"],
      rows: rows
        .sort((a, b) => (S(b.spent_at) > S(a.spent_at) ? 1 : -1))
        .map((r) => [dmy(r.spent_at), S(r.title), S(r.category), N(r.amount), codeById.get(S(r.contract_id)) || ""]),
    };
    return xlsxResponse(await buildXlsx([sheet]), `ChiTieu_${today}.xlsx`);
  }

  if (type === "payroll") {
    const contracts = await all(db, "studio_contracts", "id, code, title, event_date", owner);
    const byId = new Map(contracts.map((c) => [S(c.id), c]));
    const crew = await byIds(db, "contract_crew", "contract_id", contracts.map((c) => S(c.id)));
    // Tên vai trò (gồm vai trò studio tự đặt) — trước đây file xuất ra khoá thô "photographer".
    const roles = await loadCrewRoles(db, owner);
    const sheet: Sheet = {
      name: "Lương theo hợp đồng",
      columns: ["Tên", "SĐT", "Vai trò", "Mã HĐ", "Hợp đồng", "Ngày chụp", "Lương (VND)", "Đã trả", "Ngày trả", "Nhận việc"],
      rows: crew.map((cr) => {
        const c = byId.get(S(cr.contract_id));
        return [S(cr.name), S(cr.phone), crewRoleLabel(S(cr.role), roles), S(c?.code), S(c?.title), dmy(c?.event_date), N(cr.salary), cr.paid ? "Rồi" : "Chưa", dmy(cr.paid_at), CREW_STATUS[S(cr.status)] || S(cr.status)];
      }),
    };
    return xlsxResponse(await buildXlsx([sheet]), `Luong_${today}.xlsx`);
  }

  if (type === "bookings") {
    const bookings = await all(db, "studio_bookings", "created_at, name, phone, service, preferred_date, package_name, package_price, status, note", owner);
    const events = await all(db, "studio_events", "event_date, event_time, title, note, remind", owner);
    const s1: Sheet = {
      name: "Đặt lịch",
      columns: ["Ngày gửi", "Tên khách", "SĐT", "Dịch vụ", "Ngày muốn chụp", "Gói", "Giá gói (VND)", "Trạng thái", "Ghi chú"],
      rows: bookings.map((b) => [dmy(b.created_at), S(b.name), S(b.phone), S(b.service), dmy(b.preferred_date), S(b.package_name), N(b.package_price), BOOKING_STATUS[S(b.status)] || S(b.status), S(b.note)]),
    };
    const s2: Sheet = {
      name: "Lịch ghi chú",
      columns: ["Ngày", "Giờ", "Tiêu đề", "Ghi chú", "Nhắc hẹn"],
      rows: events.map((e) => [dmy(e.event_date), S(e.event_time), S(e.title), S(e.note), e.remind ? "Có" : "Không"]),
    };
    return xlsxResponse(await buildXlsx([s1, s2]), `LichHen_${today}.xlsx`);
  }

  if (type === "staff") {
    const staff = await all(db, "profiles", "full_name, email, studio_role, is_active, created_at", owner, "studio_owner_id");
    const crew = await all(db, "studio_crew", "name, phone, role, note, created_at", owner);
    const roles = await loadCrewRoles(db, owner);
    const s1: Sheet = {
      name: "Nhân viên",
      columns: ["Họ tên", "Email", "Vai trò", "Hoạt động", "Ngày tạo"],
      rows: staff.map((p) => [S(p.full_name), S(p.email), S(p.studio_role), p.is_active ? "Có" : "Khóa", dmy(p.created_at)]),
    };
    const s2: Sheet = {
      name: "Sổ thợ",
      columns: ["Tên", "SĐT", "Vai trò", "Ghi chú", "Ngày thêm"],
      rows: crew.map((c) => [S(c.name), S(c.phone), crewRoleLabel(S(c.role), roles), S(c.note), dmy(c.created_at)]),
    };
    return xlsxResponse(await buildXlsx([s1, s2]), `NhanVien_${today}.xlsx`);
  }

  if (type === "backup") {
    // Bản JSON ĐẦY ĐỦ mọi mảng — dùng cho khôi phục ngược (giai đoạn C).
    const params = new URL(req.url).searchParams;
    // lite=1: desktop chỉ cần dữ liệu để XEM offline (Tổng quan/Hợp đồng/Lịch),
    // không cần ảnh chữ ký (data-URL PNG, mỗi cái vài chục KB) → bỏ đi cho nhẹ.
    // Bản tải về để khôi phục (nút trên web, file SaoLuu hằng ngày) vẫn ĐẦY ĐỦ.
    const lite = params.get("lite") === "1";
    const contracts = (await all(db, "studio_contracts", "*", owner)).map((c) => {
      if (!lite) return c;
      const rest = { ...c };
      delete rest.client_signature;
      delete rest.studio_signature;
      return rest;
    });
    const cIds = contracts.map((c) => S(c.id));
    const quotes = await all(db, "studio_quotes", "*", owner);
    const tables: Record<string, Row[]> = {
      studio_contracts: contracts,
      contract_items: await byIds(db, "contract_items", "contract_id", cIds),
      contract_crew: await byIds(db, "contract_crew", "contract_id", cIds),
      contract_payments: await byIds(db, "contract_payments", "contract_id", cIds),
      contract_payment_plan: await byIds(db, "contract_payment_plan", "contract_id", cIds),
      contract_products: await byIds(db, "contract_products", "contract_id", cIds),
      contract_quote_options: await byIds(db, "contract_quote_options", "contract_id", cIds),
      contract_tasks: await byIds(db, "contract_tasks", "contract_id", cIds),
      // Cần cho màn Tổng quan của desktop tính GIỐNG HỆT web (thẻ "Yêu cầu sửa
      // đang chờ" và "Album đang được khách chọn"). Thiếu hai bảng này thì
      // desktop buộc phải bịa ra bộ chỉ số khác — và số liệu hai bên lệch nhau.
      contract_edit_requests: await byIds(db, "contract_edit_requests", "contract_id", cIds),
      albums: await all(db, "albums", "id, phase, status, is_gallery", owner),
      studio_quotes: quotes,
      quote_items: await byIds(db, "quote_items", "quote_id", quotes.map((q) => S(q.id))),
      studio_expenses: await all(db, "studio_expenses", "*", owner),
      studio_bookings: await all(db, "studio_bookings", "*", owner),
      studio_events: await all(db, "studio_events", "*", owner),
      studio_crew: await all(db, "studio_crew", "*", owner),
      studio_packages: await all(db, "studio_packages", "*", owner),
      studio_pricelist: await all(db, "studio_pricelist", "*", owner),
      studio_equipment: await all(db, "studio_equipment", "*", owner),
      studio_services: await all(db, "studio_services", "*", owner),
    };
    if (lite) {
      // Hash nội dung (không tính exported_at) → desktop gửi lại ?have=<hash>;
      // dữ liệu không đổi thì trả 304 rỗng thay vì cả trăm KB mỗi 5 phút.
      const tablesJson = JSON.stringify(tables);
      const hash = createHash("sha1").update(tablesJson).digest("hex");
      if (params.get("have") === hash) {
        return new NextResponse(null, { status: 304, headers: { "Cache-Control": "no-store" } });
      }
      const body = `{"format":"mstudo-backup","version":1,"exported_at":${JSON.stringify(new Date().toISOString())},"owner_id":${JSON.stringify(owner)},"hash":"${hash}","tables":${tablesJson}}`;
      return new NextResponse(body, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    const backup = { format: "mstudo-backup", version: 1, exported_at: new Date().toISOString(), owner_id: owner, tables };
    return new NextResponse(JSON.stringify(backup), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mstudo-backup-${today}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "unknown_type" }, { status: 400 });
}
