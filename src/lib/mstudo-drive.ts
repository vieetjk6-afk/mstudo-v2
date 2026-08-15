import "server-only";
import { Readable } from "stream";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";

// Lưu NỘI DUNG NGƯỜI DÙNG (logo, ảnh…) vào Google Drive của ADMIN mstudo, trong
// một thư mục riêng — không dùng dung lượng Supabase. Tái dụng OAuth client của
// tính năng Story (scope drive.file → không cần Google review).

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
// Redirect riêng cho luồng kết nối Drive của admin (đăng ký trong Google Cloud).
const REDIRECT = process.env.GOOGLE_ADMIN_DRIVE_REDIRECT_URI || "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "mstudo · Nội dung người dùng";

export function adminDriveConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT);
}

function oauth() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
}

/** URL đưa admin sang Google để cấp quyền Drive. */
export function adminDriveAuthUrl(adminId: string): string {
  return oauth().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
    // State phải ĐƯỢC KÝ và gắn với chính admin đang bấm kết nối. Trước đây state
    // là hằng "admin", nên kẻ tấn công tự lấy `code` từ Google rồi dụ admin mở
    // link callback là gắn được Drive CỦA MÌNH vào ô lưu trữ dùng chung (id=1) —
    // account-linking CSRF, mọi nội dung người dùng đổ sang Drive của kẻ tấn công.
    state: signOAuthState(`admindrive:${adminId}`),
  });
}

/** Trả về id admin nếu state hợp lệ (đúng chữ ký, chưa hết hạn), ngược lại null. */
export function verifyAdminDriveState(state: string | null | undefined): string | null {
  const payload = verifyOAuthState(state);
  if (!payload?.startsWith("admindrive:")) return null;
  return payload.slice("admindrive:".length) || null;
}

// refresh_token là BÍ MẬT → ở bảng riêng admin_drive (chỉ service-role), KHÔNG ở
// site_settings (bảng có policy đọc công khai).
type Row = { refresh_token: string | null; folder_id: string | null };

async function loadSettings(): Promise<Row | null> {
  const db = createAdminClient();
  const { data } = await db.from("admin_drive").select("refresh_token, folder_id").eq("id", 1).maybeSingle();
  return (data as Row) ?? null;
}

/** Đổi code lấy refresh_token và lưu vào admin_drive (id=1). */
export async function connectAdminDrive(code: string): Promise<void> {
  const o = oauth();
  const { tokens } = await o.getToken(code);
  if (!tokens.refresh_token) throw new Error("no_refresh_token");
  const db = createAdminClient();
  await db.from("admin_drive").upsert({ id: 1, refresh_token: tokens.refresh_token, folder_id: null, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

/** Đã kết nối Drive admin chưa? */
export async function adminDriveConnected(): Promise<boolean> {
  const s = await loadSettings();
  return !!s?.refresh_token;
}

/** Ngắt kết nối (xoá token). */
export async function disconnectAdminDrive(): Promise<void> {
  const db = createAdminClient();
  await db.from("admin_drive").upsert({ id: 1, refresh_token: null, folder_id: null, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

type Drive = ReturnType<typeof google.drive>;

/** Tạo thư mục lưu trữ và ghi nhớ id. */
async function createFolder(drive: Drive): Promise<string | null> {
  const res = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  const id = res.data.id || null;
  if (id) {
    await createAdminClient()
      .from("admin_drive")
      .upsert({ id: 1, folder_id: id, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }
  return id;
}

/** Client Drive đã xác thực + thư mục lưu (tạo 1 lần). */
async function driveCtx() {
  const s = await loadSettings();
  if (!s?.refresh_token) return null;
  const o = oauth();
  o.setCredentials({ refresh_token: s.refresh_token });
  const drive = google.drive({ version: "v3", auth: o });
  let folderId = s.folder_id;
  if (folderId) {
    // Thư mục có thể đã bị xoá/đổi chủ trong Drive. Nếu vậy mọi upload sẽ hỏng
    // vĩnh viễn vì folder_id cũ được lưu lại mãi — kiểm tra rồi tạo lại.
    const alive = await drive.files
      .get({ fileId: folderId, fields: "id, trashed" })
      .then((r) => !!r.data.id && !r.data.trashed)
      .catch(() => false);
    if (!alive) folderId = null;
  }
  if (!folderId) folderId = await createFolder(drive);
  return folderId ? { drive, folderId } : null;
}

/** Lý do lần upload gần nhất không vào được Drive (đọc ở trang trạng thái admin). */
let lastDriveError: string | null = null;
export function lastAdminDriveError(): string | null {
  return lastDriveError;
}

/**
 * Upload file vào Drive admin, đặt công khai (anyone reader) để /api/img và
 * /api/file phục vụ. Trả về file id, hoặc null nếu chưa kết nối / lỗi.
 *
 * Lỗi được GHI LẠI chứ không nuốt im lặng: trước đây một kết nối Drive hỏng
 * (token bị thu hồi, thư mục bị xoá, thiếu biến môi trường) khiến mọi upload âm
 * thầm rơi về Supabase mà không ai biết — đúng cách dung lượng Supabase phình
 * lên trong khi trang admin vẫn báo "đã kết nối".
 */
export async function uploadToAdminDrive(buf: Buffer, name: string, mime: string): Promise<string | null> {
  try {
    const ctx = await driveCtx();
    if (!ctx) {
      lastDriveError = adminDriveConfigured() ? "chưa kết nối Drive admin" : "thiếu biến môi trường Google OAuth";
      return null;
    }
    const res = await ctx.drive.files.create({
      requestBody: { name: name || "upload", parents: [ctx.folderId] },
      media: { mimeType: mime || "application/octet-stream", body: Readable.from(buf) },
      fields: "id",
    });
    const id = res.data.id;
    if (!id) {
      lastDriveError = "Drive không trả về file id";
      return null;
    }
    await ctx.drive.permissions.create({ fileId: id, requestBody: { role: "reader", type: "anyone" } }).catch(() => {});
    lastDriveError = null;
    return id;
  } catch (e) {
    lastDriveError = (e as Error)?.message || String(e);
    console.error("[admin-drive] upload failed, rơi về Supabase Storage:", lastDriveError);
    return null;
  }
}

/**
 * Rút file id Drive ra khỏi một URL do chính mình sinh (/api/img?id=… hoặc
 * /api/file?id=…). Trả null nếu là URL khác (vd public URL của Supabase).
 */
export function driveIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^\/api\/(?:img|file)\?id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Xoá một file khỏi Drive admin. true nếu đã xoá (hoặc vốn không còn). */
export async function deleteFromAdminDrive(fileId: string): Promise<boolean> {
  try {
    const ctx = await driveCtx();
    if (!ctx) return false;
    await ctx.drive.files.delete({ fileId });
    return true;
  } catch (e) {
    // 404 = đã bị xoá từ trước → coi như xong, đừng thử lại mãi.
    const status = (e as { code?: number })?.code;
    if (status === 404) return true;
    console.error("[admin-drive] delete failed:", (e as Error)?.message || e);
    return false;
  }
}

/**
 * Thử lưu file BẤT KỲ (nhạc nền…) vào Drive admin → trả URL phục vụ qua
 * /api/file, hoặc null để caller fallback Supabase.
 */
export async function driveFileUrlOrNull(buf: Buffer, name: string, mime: string): Promise<string | null> {
  const id = await uploadToAdminDrive(buf, name, mime);
  return id ? `/api/file?id=${id}` : null;
}

/**
 * Kiểm tra THẬT xem Drive admin còn dùng được không (gọi API, không chỉ xem có
 * token trong DB). Trang trạng thái dùng cái này để không báo "đã kết nối" khi
 * thực tế mọi upload đang rơi về Supabase.
 */
export async function adminDriveHealth(): Promise<{ configured: boolean; connected: boolean; ok: boolean; error: string | null }> {
  const configured = adminDriveConfigured();
  const connected = await adminDriveConnected();
  if (!configured || !connected) return { configured, connected, ok: false, error: null };
  try {
    const ctx = await driveCtx();
    if (!ctx) return { configured, connected, ok: false, error: "không tạo được thư mục lưu trữ trên Drive" };
    return { configured, connected, ok: true, error: null };
  } catch (e) {
    return { configured, connected, ok: false, error: (e as Error)?.message || String(e) };
  }
}

/**
 * Thử lưu ẢNH vào Drive admin → trả URL phục vụ qua /api/img, hoặc null nếu Drive
 * chưa kết nối / lỗi (để caller fallback Supabase). Chỉ dùng cho ảnh (image/*).
 */
export async function driveImageUrlOrNull(buf: Buffer, name: string, mime: string, original = false): Promise<string | null> {
  try {
    const id = await uploadToAdminDrive(buf, name, mime);
    return id ? `/api/img?id=${id}${original ? "&orig=1" : "&w=1600"}` : null;
  } catch {
    return null;
  }
}
