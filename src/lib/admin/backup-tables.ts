/**
 * Bảng nào nằm trong bản sao lưu toàn hệ thống, theo thứ tự nào, và cột nào bị
 * gạt ra — dùng chung cho máy chủ (xuất / khôi phục) và trình duyệt (chia lô
 * khi khôi phục). KHÔNG import gì phía máy chủ ở đây.
 *
 * QUY TẮC: mọi bảng tạo trong supabase/setup-all.sql phải nằm ở MỘT trong hai
 * danh sách — BACKUP_TABLES hoặc BACKUP_EXCLUDED (kèm lý do). Bài kiểm thử
 * `npm run test:system-backup` đỏ khi có bảng mới chưa được xếp chỗ. Trước đây
 * không có luật này nên danh sách đứng yên ở 52 bảng trong khi hệ thống đã lên
 * 104 bảng: lịch hẹn, phụ lục hợp đồng, voucher, chi nhánh, chấm công, kế hoạch
 * cưới, sao kê ngân hàng… KHÔNG hề có trong file sao lưu.
 *
 * THỨ TỰ: bảng cha đứng trước bảng con (theo khoá ngoại) để khi khôi phục bằng
 * upsert lần lượt, bản ghi được tham chiếu luôn có trước. Vòng duy nhất là
 * profiles ↔ studio_branches (profiles.branch_id) — profiles đứng trước; lô nào
 * lỗi vì khoá ngoại sẽ được thử lại ở lượt thứ hai, khi bảng kia đã vào.
 */
export const BACKUP_TABLES = [
  "profiles",
  "site_settings",
  "sites",
  "site_blocks",
  "albums",
  "album_sources",
  "photos",
  "selections",
  "album_shares",
  "album_creations",
  "feedback",
  "bookings",
  "upgrade_requests",
  "filter_usages",
  "compress_usages",
  "discount_codes",
  "discount_redemptions",
  "affiliate_codes",
  "affiliate_commissions",
  "message_templates",
  "studio_services",
  "studio_branches",
  "studio_bookings",
  "studio_contracts",
  "contract_addenda",
  "studio_events",
  "contract_items",
  "contract_crew",
  "studio_equipment",
  "contract_equipment",
  "contract_products",
  "contract_quote_options",
  "contract_payments",
  "contract_payment_plan",
  "contract_tasks",
  "contract_edit_requests",
  "contract_client_proofs",
  "contract_templates",
  "contract_template_items",
  "studio_crew",
  "crew_unavailable",
  "studio_packages",
  "studio_pricelist",
  "studio_vendors",
  "vendor_orders",
  "studio_expenses",
  "studio_quotes",
  "quote_items",
  "quote_adjustments",
  "studio_notifications",
  "desktop_devices",
  "wedding_invitations",
  "wedding_rsvps",
  "story_pages",
  "story_wishes",
  "story_uploads",
  "dislikes",
  "crew_shift_plan",
  "album_designs",
  "studio_drive",
  "studio_zalo",
  "zalo_messages",
  "crew_account",
  "rental_items",
  "rental_orders",
  "rental_order_items",
  "site_views",
  "website_chat_config",
  "website_leads",
  "studio_referrals",
  "studio_appointments",
  "studio_rooms",
  "inbox_channels",
  "inbox_contacts",
  "inbox_conversations",
  "inbox_messages",
  "studio_automations",
  "studio_automation_log",
  "crew_timesheet",
  "crew_available",
  "studio_receipt_seq",
  "album_people",
  "album_photo_people",
  "studio_bank_transactions",
  "contract_reschedules",
  "studio_vouchers",
  "studio_voucher_program",
  "studio_saved_signature",
  "studio_audit_log",
  "studio_crew_roles",
  "print_picks",
  "wedding_plans",
  "system_polls",
  "system_poll_votes",
  "album_collage_events",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Bảng CỐ Ý không sao lưu — và vì sao. */
export const BACKUP_EXCLUDED: Record<string, string> = {
  admin_drive: "bí mật: refresh token Drive của admin (chính nơi cất bản sao lưu)",
  admin_ai_providers: "bí mật: API key AI chung (đã mã hoá) — nhập lại khi cần",
  studio_ai_providers: "bí mật: API key AI riêng của studio — studio nhập lại khi cần",
  studio_bank_hooks: "bí mật: khoá webhook SePay — studio tạo lại khi cần",
  push_subscriptions: "thiết bị nhận thông báo đẩy — tự đăng ký lại khi mở app",
  album_faces: "vector khuôn mặt (nặng nhất DB) — quét lại được từ ảnh",
  album_photo_counts: "bảng đếm suy ra từ photos — hàm SQL tự đếm lại",
  album_collages: "nháp ghép ảnh của khách, chỉ giữ 1 ngày",
};

/**
 * Cột BÍ MẬT gạt khỏi bản sao lưu (không ghi vào file). File sao lưu nằm trên
 * Drive / máy admin — lộ file thì không được kéo theo quyền vào Drive, Zalo,
 * Facebook của mọi studio. Khôi phục bằng upsert chỉ ghi các cột CÓ trong file
 * nên token đang sống không bị xoá; bản ghi phải tạo lại thì studio kết nối lại.
 */
export const BACKUP_OMIT_COLUMNS: Partial<Record<BackupTable, readonly string[]>> = {
  profiles: ["google_refresh_token"],
  studio_drive: ["refresh_token", "filter_refresh_token"],
  studio_zalo: ["oa_access_token", "oa_refresh_token", "personal_session"],
  inbox_channels: ["secret"],
  story_pages: ["drive_refresh_token"],
};

/**
 * Bảng có trong file nhưng KHÔNG khôi phục tự động: khoá chính là
 * `generated always as identity` — Postgres cấm ghi giá trị id, mà bỏ id đi thì
 * mỗi lần khôi phục lại nhân đôi toàn bộ nhật ký. Giữ trong file để tra cứu.
 */
export const RESTORE_SKIP_TABLES: ReadonlySet<string> = new Set(["studio_audit_log", "album_collage_events"]);

/**
 * Cột KHÔNG được ghi khi khôi phục:
 *   · cột sinh tự động (`generated always … stored`) — ghi vào là Postgres báo
 *     lỗi cả lô ("cannot insert a non-DEFAULT value"), cả bảng thợ không vào;
 *   · profiles: cột quyền / gói / chủ sở hữu (H6) — một file sao lưu bị sửa tay
 *     không được nâng ai lên admin hay đổi gói. Admin chỉnh các cột này ở trang
 *     Quản trị;
 *   · mọi cột bí mật ở BACKUP_OMIT_COLUMNS (file cũ v1 vẫn còn chúng).
 */
const PROFILE_PRIVILEGED = [
  "role", "is_active", "plan", "plan_cycle", "plan_expires_at", "trial_used_at",
  "studio_owner_id", "studio_role", "max_albums", "monthly_album_limit",
  "can_zip", "can_notes", "can_galleries", "can_watermark_pro",
  "compress_daily_limit", "compress_picker_limit",
];
export const GENERATED_COLUMNS: Partial<Record<BackupTable, readonly string[]>> = {
  contract_crew: ["phone_digits"],
  studio_crew: ["phone_digits"],
};

function restoreStripSet(table: string): Set<string> {
  const t = table as BackupTable;
  return new Set([
    ...(BACKUP_OMIT_COLUMNS[t] ?? []),
    ...(GENERATED_COLUMNS[t] ?? []),
    ...(t === "profiles" ? PROFILE_PRIVILEGED : []),
  ]);
}

function dropKeys(row: Record<string, unknown>, drop: Set<string>): Record<string, unknown> {
  if (drop.size === 0) return row;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) if (!drop.has(k)) out[k] = row[k];
  return out;
}

/** Dòng đem GHI VÀO FILE sao lưu (đã gạt cột bí mật). */
export function rowForBackup(table: string, row: Record<string, unknown>): Record<string, unknown> {
  return dropKeys(row, new Set(BACKUP_OMIT_COLUMNS[table as BackupTable] ?? []));
}

/** Dòng đem GHI VÀO DB khi khôi phục (đã gạt cột sinh tự động / đặc quyền / bí mật). */
export function rowForRestore(table: string, row: Record<string, unknown>): Record<string, unknown> {
  return dropKeys(row, restoreStripSet(table));
}

export function isRestorableTable(table: string): table is BackupTable {
  return (BACKUP_TABLES as readonly string[]).includes(table) && !RESTORE_SKIP_TABLES.has(table);
}

/**
 * Khoá chính để phân trang ổn định khi xuất (mặc định "id"). Đọc theo khoá chính
 * thay cho `.range()` trần: không có ORDER BY thì Postgres không hứa thứ tự giữa
 * hai lượt đọc, trang sau có thể lặp / sót dòng của trang trước.
 */
export const TABLE_ORDER_KEYS: Partial<Record<BackupTable, readonly string[]>> = {
  album_shares: ["token"],
  crew_shift_plan: ["phone"],
  crew_account: ["phone"],
  studio_drive: ["owner_id"],
  studio_zalo: ["owner_id"],
  website_chat_config: ["owner_id"],
  studio_voucher_program: ["owner_id"],
  studio_saved_signature: ["owner_id"],
  site_views: ["site_id", "day"],
  studio_receipt_seq: ["owner_id", "year"],
  album_photo_people: ["person_id", "photo_id"],
  system_poll_votes: ["poll_id", "user_id"],
};

export function orderKeysFor(table: string): readonly string[] {
  return TABLE_ORDER_KEYS[table as BackupTable] ?? ["id"];
}

/**
 * Chia các dòng thành lô để gửi lên máy chủ khi khôi phục. Vercel từ chối thân
 * request > 4,5 MB (FUNCTION_PAYLOAD_TOO_LARGE) — trước đây trình duyệt gửi CẢ
 * file sao lưu trong một request nên khôi phục hỏng ngay khi dữ liệu vượt vài MB.
 */
export function chunkRows<T>(rows: readonly T[], maxRows = 500, maxBytes = 1_500_000): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const r of rows) {
    const n = JSON.stringify(r)?.length ?? 4;
    if (cur.length > 0 && (cur.length >= maxRows || size + n > maxBytes)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(r);
    size += n + 1;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/** Tên file sao lưu: mstudo-backup-2026-11-12_03h15.json.gz (giờ VN). */
export function backupFileName(at: Date, gz = true): string {
  const vn = new Date(at.getTime() + 7 * 3600 * 1000).toISOString();
  const stamp = `${vn.slice(0, 10)}_${vn.slice(11, 16).replace(":", "h")}`;
  return `mstudo-backup-${stamp}.json${gz ? ".gz" : ""}`;
}
