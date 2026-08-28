import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import { guardCaptcha } from "@/lib/captcha-guard";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Các trường thợ được tự khai. SĐT không nằm ở đây — nó là DANH TÍNH của thợ
 * (khoá tra cứu mọi bảng), sửa được thì thành mạo danh người khác.
 */
const SELF_FIELDS = ["name", "email", "address", "bank_name", "bank_account", "skills", "equipment"] as const;
type SelfField = (typeof SELF_FIELDS)[number];

function clean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

/**
 * Hồ sơ thợ ở cổng /crew.
 *
 *   POST { phone }                          -> hồ sơ ở từng studio đã nhận mình
 *   POST { action: "save", phone, studioId, profile } -> thợ tự điền
 *   POST { action: "register", phone, crewToken, profile } -> xin vào sổ 1 studio
 *
 * Đăng ký PHẢI kèm crewToken: /crew trần không biết thợ thuộc studio nào (nó cố
 * ý gom việc của mọi studio theo SĐT), nên studio phải chia sẻ link riêng
 * /crew/<crew_token> thì mới quy được về đúng sổ thợ.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    action?: string;
    studioId?: string;
    crewToken?: string;
    captcha?: string;
    profile?: Record<string, unknown>;
  };
  const phone = digits(body.phone);
  if (!phone) return NextResponse.json({ error: "no_phone" }, { status: 400 });

  const rl = await limitByIpDurable(req, `crewprof:${phone}`, 20, 60_000);
  if (rl) return rl;

  const db = createAdminClient();

  // ── Thợ tự khai hồ sơ ở một studio đã nhận mình ───────────────────────
  if (body.action === "save") {
    if (!body.studioId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    // Đối chiếu theo SĐT: chỉ sửa được dòng của CHÍNH mình trong sổ studio đó.
    // So sánh ở đây chứ không .eq("phone") vì SĐT trong sổ có thể lưu kèm dấu
    // cách / +84, phải chuẩn hoá về dạng số mới khớp.
    const { data: mine } = await db.from("studio_crew").select("id, phone").eq("owner_id", body.studioId);
    const target = (mine ?? []).find((r) => digits(r.phone as string) === phone);
    if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const patch: Record<string, string | null> = { self_filled_at: new Date().toISOString() };
    for (const k of SELF_FIELDS) patch[k] = clean(body.profile?.[k as SelfField]);
    // Tên rỗng thì giữ tên studio đã đặt, đừng xoá mất.
    if (!patch.name) delete patch.name;
    await db.from("studio_crew").update(patch).eq("id", target.id);
    return NextResponse.json({ ok: true });
  }

  // ── Thợ xin vào sổ của một studio (qua link riêng của studio) ─────────
  if (body.action === "register") {
    const captcha = await guardCaptcha(req, "crew-register", body.captcha);
    if (captcha) return captcha;
    const token = (body.crewToken || "").trim();
    if (!token) return NextResponse.json({ error: "no_studio" }, { status: 400 });
    const { data: studio } = await db.from("profiles").select("id").eq("crew_token", token).maybeSingle();
    if (!studio) return NextResponse.json({ error: "bad_studio" }, { status: 404 });

    const { data: existing } = await db.from("studio_crew").select("id, phone").eq("owner_id", studio.id);
    if ((existing ?? []).some((r) => digits(r.phone as string) === phone)) {
      return NextResponse.json({ ok: true, already: true });
    }

    const patch: Record<string, string | null> = {
      owner_id: studio.id,
      phone,
      role: "photographer",
      // Chờ studio duyệt — thợ tự đăng ký không tự vào sổ chính thức được.
      status: "pending",
      self_filled_at: new Date().toISOString(),
    };
    for (const k of SELF_FIELDS) patch[k] = clean(body.profile?.[k as SelfField]);
    // Sổ thợ hiển thị theo tên; thợ chưa khai thì tạm lấy SĐT, studio sửa sau.
    patch.name = patch.name || phone;
    const { error } = await db.from("studio_crew").insert(patch);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

    await db.from("studio_notifications").insert({
      owner_id: studio.id,
      contract_id: null,
      kind: "info",
      message: `${patch.name} (${phone}) xin vào sổ thợ — vào Sổ thợ để duyệt.`,
    });
    return NextResponse.json({ ok: true });
  }

  // ── Mặc định: hồ sơ của tôi ở từng studio đã nhận mình ────────────────
  // Lọc trong SQL theo cột sinh `phone_digits` (có chỉ mục) thay vì tải cả sổ
  // thợ của MỌI studio về rồi lọc bằng JS — xem migration crew_phone_digits.sql.
  const byDigits = await db.from("studio_crew").select("*").eq("phone_digits", phone);
  let mine = byDigits.data ?? [];
  if (byDigits.error) {
    const { data: all } = await db.from("studio_crew").select("*");
    mine = (all ?? []).filter((r) => digits(r.phone as string) === phone);
  }
  const ownerIds = mine.map((r) => r.owner_id as string);
  const { data: studios } = ownerIds.length
    ? await db.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] };
  const nameById: Record<string, string> = {};
  for (const s of (studios ?? []) as Array<{ id: string; full_name: string | null }>) {
    nameById[s.id] = s.full_name || "Studio";
  }

  return NextResponse.json({
    profiles: mine.map((r) => ({ ...r, studio_name: nameById[r.owner_id as string] || "Studio" })),
  });
}
