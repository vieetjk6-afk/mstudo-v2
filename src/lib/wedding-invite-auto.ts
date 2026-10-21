/**
 * TẠO THIỆP CƯỚI ONLINE TỪ HỢP ĐỒNG — phía máy chủ.
 *
 * Dùng cho luật tự động "Trước ngày cưới → tặng thiệp cưới online"
 * (src/lib/automations.ts, `gift_invitation`): cron tạo thiệp điền sẵn tên cô dâu
 * chú rể, ngày cưới, địa điểm từ hợp đồng, rồi gửi khách link sửa.
 *
 * Phần dựng dữ liệu (`invitationSlug`, `invitationConfigFromContract`) là hàm
 * thuần — không đọc DB, không gọi mạng — để kiểm thử bằng node. Phần ghi DB nhận
 * client từ ngoài vào (cron dùng admin client).
 */
import type { WeddingConfig } from "./types";

/** Bỏ dấu + gạch nối, thêm đuôi ngẫu nhiên để không trùng: "Thu Hà & Minh Tuấn" → "thu-ha-minh-tuan-x8k2p". */
export function invitationSlug(name: string, rand: () => string = () => Math.random().toString(36).slice(2, 7)): string {
  const base = (name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
  return `${base || "le-cuoi"}-${rand()}`;
}

/** Mã bí mật của link sửa thiệp — 32 ký tự hex, như thiệp tạo tay trong trang hợp đồng. */
export function newEditToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Những gì của hợp đồng đáng điền sẵn vào thiệp. */
export type InviteSource = {
  id: string;
  owner_id: string;
  title: string | null;
  client_name: string | null;
  event_date: string | null;
  event_time?: string | null;
  location?: string | null;
  /** Tên cô dâu / chú rể khách điền ở form thông tin (`intake`). */
  bride?: string | null;
  groom?: string | null;
};

const clean = (s?: string | null) => (s ?? "").trim() || undefined;

/**
 * Nội dung thiệp nháp: tên đôi (nếu khách đã điền form thông tin), ngày cưới, một
 * sự kiện "Tiệc cưới" với giờ và địa điểm của hợp đồng. Bật sẵn xác nhận tham dự
 * như thiệp tạo tay. Thiếu gì thì để trống — trình sửa thiệp nhắc khách điền.
 */
export function invitationConfigFromContract(c: InviteSource): WeddingConfig {
  const date = clean(c.event_date);
  const time = clean(c.event_time);
  const venue = clean(c.location);
  return {
    ...(clean(c.groom) ? { groom_name: clean(c.groom) } : {}),
    ...(clean(c.bride) ? { bride_name: clean(c.bride) } : {}),
    ...(date ? { wedding_date: date } : {}),
    rsvp_enabled: true,
    events: date || venue ? [{ label: "Tiệc cưới", date, time, venue }] : [],
  };
}

/** Tên dùng làm slug: tên đôi nếu có, không thì tên khách, không thì tên hợp đồng. */
export function invitationSlugName(c: InviteSource): string {
  const pair = [clean(c.bride), clean(c.groom)].filter(Boolean).join(" ");
  return pair || clean(c.client_name) || clean(c.title) || "le-cuoi";
}

type Db = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type InviteResult =
  | { ok: true; created: boolean; slug: string; edit_token: string }
  | { ok: false; error: string };

/**
 * Tạo thiệp cho hợp đồng — hoặc trả thiệp đã có. Mỗi hợp đồng MỘT thiệp: trang
 * hợp đồng đọc thiệp bằng `.maybeSingle()`, hai dòng là trang đó hỏng.
 * Trùng slug (hiếm, đuôi ngẫu nhiên 5 ký tự) thì thử lại với đuôi khác.
 */
export async function createInvitationForContract(db: Db, c: InviteSource): Promise<InviteResult> {
  const { data: had } = await db
    .from("wedding_invitations")
    .select("slug, edit_token")
    .eq("contract_id", c.id)
    .limit(1);
  if (had?.[0]) return { ok: true, created: false, slug: had[0].slug, edit_token: had[0].edit_token };

  const config = invitationConfigFromContract(c);
  let lastErr = "insert_failed";
  for (let i = 0; i < 3; i++) {
    const row = {
      owner_id: c.owner_id,
      contract_id: c.id,
      slug: invitationSlug(invitationSlugName(c)),
      edit_token: newEditToken(),
      config,
    };
    const { data, error } = await db.from("wedding_invitations").insert(row).select("slug, edit_token").single();
    if (!error && data) return { ok: true, created: true, slug: data.slug, edit_token: data.edit_token };
    lastErr = error?.message || lastErr;
    if (error?.code !== "23505") break; // chỉ thử lại khi trùng khoá (slug)
  }
  return { ok: false, error: lastErr };
}
