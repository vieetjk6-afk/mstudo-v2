import "server-only";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { extractFolderId } from "@/lib/drive";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Kết nối Google Drive TOÀN QUYỀN cho công cụ Lọc ảnh (per-owner OAuth offline,
 * scope `drive`). Studio kết nối MỘT LẦN → lưu refresh token; sau đó máy chủ tự
 * tạo thư mục + chép ảnh vào BẤT KỲ link Drive studio có quyền chỉnh sửa, KHÔNG
 * cần đăng nhập lại lần nào.
 *
 * Tách RIÊNG khỏi kết nối đồng bộ hợp đồng (studio_drive.refresh_token, scope
 * drive.file) để không mở rộng quyền của luồng đó. Token này lưu ở cột riêng
 * `studio_drive.filter_refresh_token`.
 *
 * Vì `drive` là scope "hạn chế" của Google → màn đồng ý hiện cảnh báo "app chưa
 * xác minh" cho tới khi app được Google kiểm duyệt (studio bấm Nâng cao → Tiếp
 * tục để cấp quyền).
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
// Redirect riêng cho luồng kết nối Drive của công cụ Lọc ảnh (đăng ký trong Google Cloud).
const REDIRECT = process.env.GOOGLE_FILTER_DRIVE_REDIRECT_URI || "";
const SCOPE = "https://www.googleapis.com/auth/drive";

export function filterDriveConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT);
}

function oauth() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
}

/** URL đưa chủ studio sang Google cấp quyền Drive toàn quyền (offline). */
export function filterDriveAuthUrl(ownerId: string): string {
  return oauth().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
    state: signOAuthState(`filterdrive:${ownerId}`),
  });
}

/** Lấy ownerId từ state đã ký ở callback (chống account-linking CSRF). */
export function ownerFromFilterState(state: string | null | undefined): string | null {
  const payload = verifyOAuthState(state);
  if (!payload || !payload.startsWith("filterdrive:")) return null;
  return payload.slice("filterdrive:".length) || null;
}

/** Đổi code lấy refresh token & lưu (upsert vào cột filter_refresh_token). */
export async function connectFilterDrive(ownerId: string, code: string): Promise<void> {
  const o = oauth();
  const { tokens } = await o.getToken(code);
  if (!tokens.refresh_token) throw new Error("no_refresh_token");
  const db = createAdminClient();
  await db.from("studio_drive").upsert(
    { owner_id: ownerId, filter_refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() },
    { onConflict: "owner_id" }
  );
}

/** Studio đã kết nối Drive toàn quyền cho công cụ Lọc ảnh chưa? */
export async function filterDriveConnected(ownerId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db.from("studio_drive").select("filter_refresh_token").eq("owner_id", ownerId).maybeSingle();
  return !!(data as { filter_refresh_token?: string | null } | null)?.filter_refresh_token;
}

/** Ngắt kết nối Drive toàn quyền của công cụ Lọc ảnh. */
export async function disconnectFilterDrive(ownerId: string): Promise<void> {
  const db = createAdminClient();
  await db.from("studio_drive").update({ filter_refresh_token: null, updated_at: new Date().toISOString() }).eq("owner_id", ownerId);
}

export type FilterCopyOutcome =
  | {
      ok: true;
      folderId: string;
      folderUrl: string;
      folderName: string;
      copied: number;
      failed: { name: string; error: string }[];
    }
  | { ok: false; error: string };

/**
 * Chép các file ảnh (theo fileId) sang một thư mục trên Drive của studio bằng
 * refresh token đã lưu — KHÔNG cần đăng nhập lại. Tạo thư mục con trong link ảnh
 * gốc (mặc định "Anh Chon"), hoặc chép vào thư mục đích có sẵn.
 */
export async function copyFilesToFilterDrive(
  ownerId: string,
  opts: {
    files: { id: string; name: string }[];
    sourceFolderUrl?: string;
    targetFolderUrl?: string;
    newFolderName?: string;
  }
): Promise<FilterCopyOutcome> {
  const db = createAdminClient();
  const { data } = await db.from("studio_drive").select("filter_refresh_token").eq("owner_id", ownerId).maybeSingle();
  const refreshToken = (data as { filter_refresh_token?: string | null } | null)?.filter_refresh_token;
  if (!refreshToken) return { ok: false, error: "not_connected" };
  if (!opts.files.length) return { ok: false, error: "no_files" };

  const o = oauth();
  o.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: o });

  // Thư mục đích: dùng thư mục có sẵn, hoặc tạo mới trong link ảnh gốc.
  let folderId = opts.targetFolderUrl ? extractFolderId(opts.targetFolderUrl) || "" : "";
  let folderName = "";
  if (folderId) {
    try {
      const meta = await drive.files.get({ fileId: folderId, fields: "id, name, mimeType" });
      if (meta.data.mimeType !== "application/vnd.google-apps.folder") return { ok: false, error: "target_not_folder" };
      folderName = meta.data.name ?? "";
    } catch {
      return { ok: false, error: "target_unreachable" };
    }
  } else {
    const parentId = opts.sourceFolderUrl ? extractFolderId(opts.sourceFolderUrl) : null;
    if (!parentId) return { ok: false, error: "no_target" };
    folderName = (opts.newFolderName || "").trim() || "Anh Chon";
    try {
      const r = await drive.files.create({
        requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
        fields: "id",
      });
      folderId = (r.data.id as string) || "";
      if (!folderId) return { ok: false, error: "create_folder_failed" };
    } catch {
      return { ok: false, error: "create_folder_failed" };
    }
  }

  const failed: { name: string; error: string }[] = [];
  let copied = 0;
  const CONC = 4;
  for (let i = 0; i < opts.files.length; i += CONC) {
    const batch = opts.files.slice(i, i + CONC);
    await Promise.all(
      batch.map(async (f) => {
        try {
          await drive.files.copy({ fileId: f.id, requestBody: { name: f.name, parents: [folderId] }, fields: "id" });
          copied++;
        } catch (e) {
          failed.push({ name: f.name, error: e instanceof Error ? e.message.slice(0, 120) : "copy_failed" });
        }
      })
    );
  }

  return {
    ok: true,
    folderId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    folderName,
    copied,
    failed,
  };
}

export type FilterDeleteOutcome =
  | {
      ok: true;
      deleted: number;
      /** fileId các ảnh đã xoá được — để gọi bên xoá luôn khỏi album. */
      deletedIds: string[];
      failed: { name: string; error: string }[];
    }
  | { ok: false; error: string };

/**
 * Xoá các file ảnh trên Drive gốc bằng kết nối đã lưu — dùng cho danh sách ảnh
 * khách KHÔNG THÍCH. Mặc định chuyển vào Thùng rác của Drive (`trashed = true`)
 * để studio còn 30 ngày phục hồi nếu bấm nhầm; `permanent` mới xoá hẳn.
 *
 * Tài khoản Drive đã kết nối phải là CHỦ file (Google chỉ cho chủ sở hữu xoá /
 * bỏ vào thùng rác) — file của người khác trả về lỗi cho từng ảnh, không làm
 * hỏng cả lượt xoá.
 */
export async function deleteFilesFromFilterDrive(
  ownerId: string,
  files: { id: string; name: string }[],
  opts?: { permanent?: boolean }
): Promise<FilterDeleteOutcome> {
  const db = createAdminClient();
  const { data } = await db.from("studio_drive").select("filter_refresh_token").eq("owner_id", ownerId).maybeSingle();
  const refreshToken = (data as { filter_refresh_token?: string | null } | null)?.filter_refresh_token;
  if (!refreshToken) return { ok: false, error: "not_connected" };
  if (!files.length) return { ok: false, error: "no_files" };

  const o = oauth();
  o.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: o });

  const failed: { name: string; error: string }[] = [];
  const deletedIds: string[] = [];
  const CONC = 4;
  for (let i = 0; i < files.length; i += CONC) {
    const batch = files.slice(i, i + CONC);
    await Promise.all(
      batch.map(async (f) => {
        try {
          if (opts?.permanent) await drive.files.delete({ fileId: f.id });
          else await drive.files.update({ fileId: f.id, requestBody: { trashed: true } });
          deletedIds.push(f.id);
        } catch (e) {
          failed.push({ name: f.name, error: e instanceof Error ? e.message.slice(0, 160) : "delete_failed" });
        }
      })
    );
  }

  return { ok: true, deleted: deletedIds.length, deletedIds, failed };
}
