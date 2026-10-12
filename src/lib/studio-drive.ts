import "server-only";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { contractKind, kindHasPhotoWork } from "@/lib/contract-kind";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { contractBaseName } from "@/lib/desktop/contract-doc";
import { cleanFolderName, serviceFolderName, monthFolderName, contractFolderSegments } from "@/lib/desktop/contract-path";
import { syncAlbumPhotos } from "@/lib/album-sync";
import { storageUntil } from "@/lib/storage-lifecycle";
import { isMissingColumn } from "@/lib/missing-column";
import { isDeliveryPhase } from "@/lib/album-phase";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Kết nối Google Drive RIÊNG cho từng studio (per-owner OAuth, scope drive.file).
 * Dùng cho tính năng đồng bộ ảnh/video hợp đồng của MStudo Desktop:
 *  - Tạo cây thư mục trên Drive studio: MStudo/{Hợp đồng…}/Photo/{JPG Goc,Raw,
 *    File ChinhSua} + Video/{Video Goc,Video HoanThien} (nếu có quay).
 *  - Đặt "JPG Goc" & "File ChinhSua" ở chế độ ai-có-link-xem-được để album/gallery
 *    (đọc qua GOOGLE_API_KEY) hoạt động, rồi tự tạo album chọn ảnh + gallery giao khách.
 *  - Cấp access token tạm cho client tải file THẲNG lên Drive (không qua máy chủ).
 * Tái dùng OAuth Web client của Story/Admin (drive.file → không cần Google review).
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
// Redirect riêng cho luồng kết nối Drive của studio (đăng ký trong Google Cloud).
const REDIRECT = process.env.GOOGLE_STUDIO_DRIVE_REDIRECT_URI || "";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const ROOT_FOLDER_NAME = "MStudo";

export function studioDriveConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT);
}

function oauth() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);
}

// ─── Mẫu thư mục ──────────────────────────────────────────────────────────────

export type FolderRole = "selection" | "delivery" | null;
export type FolderNode = { name: string; role?: FolderRole; excluded?: boolean };
export type FolderTemplate = { photo: FolderNode[]; video: FolderNode[] };
/** 1 nút lá trong cây đã tạo (trả cho client để tạo thư mục local + biết đích upload). */
export type DriveTreeNode = { path: string; id: string; role: FolderRole; excluded: boolean };

// Mặc định: JPG Goc → album chọn; File ChinhSua → giao khách; Raw & Video Goc loại trừ.
export const DEFAULT_FOLDER_TEMPLATE: FolderTemplate = {
  photo: [
    { name: "JPG Goc", role: "selection", excluded: false },
    { name: "Raw", role: null, excluded: true },
    { name: "File ChinhSua", role: "delivery", excluded: false },
  ],
  video: [
    { name: "Video Goc", role: null, excluded: true },
    // Video hoàn thiện cũng là sản phẩm GIAO KHÁCH: đồng bộ album đọc cả file
    // video/* (photos.is_video), nên thư mục này được gắn làm nguồn giai đoạn
    // giao khách cạnh File ChinhSua. Mốc "đã có ảnh để giao" vẫn tính theo thư
    // mục giao khách ĐẦU TIÊN (File ChinhSua nếu có) — xem deliveryFolders().
    { name: "Video HoanThien", role: "delivery", excluded: false },
  ],
};

function cleanNodes(arr: any): FolderNode[] | null {
  if (!Array.isArray(arr)) return null;
  const out: FolderNode[] = [];
  for (const n of arr) {
    const name = typeof n?.name === "string" ? n.name.trim() : "";
    if (!name) continue;
    const role: FolderRole = n?.role === "selection" || n?.role === "delivery" ? n.role : null;
    out.push({ name, role, excluded: !!n?.excluded });
  }
  return out.length ? out : null;
}

/** Chuẩn hóa mẫu người dùng lưu → luôn có photo[]/video[] hợp lệ. */
export function normalizeTemplate(t: any): FolderTemplate {
  return {
    photo: cleanNodes(t?.photo) ?? DEFAULT_FOLDER_TEMPLATE.photo,
    video: cleanNodes(t?.video) ?? DEFAULT_FOLDER_TEMPLATE.video,
  };
}

// ─── Kết nối / trạng thái ─────────────────────────────────────────────────────

type DriveRow = {
  refresh_token: string | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  folder_template: any;
};

async function loadStudioDrive(ownerId: string): Promise<DriveRow | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("studio_drive")
    .select("refresh_token, root_folder_id, root_folder_name, folder_template")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return (data as DriveRow) ?? null;
}

/** URL đưa chủ studio sang Google cấp quyền Drive (state ký HMAC = ownerId). */
export function studioDriveAuthUrl(ownerId: string): string {
  return oauth().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
    state: signOAuthState(`studio:${ownerId}`),
  });
}

/** Lấy ownerId từ state đã ký ở callback (chống account-linking CSRF). */
export function ownerFromState(state: string | null | undefined): string | null {
  const payload = verifyOAuthState(state);
  if (!payload || !payload.startsWith("studio:")) return null;
  return payload.slice("studio:".length) || null;
}

/** Đổi code lấy refresh token và lưu (upsert — giữ nguyên root/template cũ). */
export async function connectStudioDrive(ownerId: string, code: string): Promise<void> {
  const o = oauth();
  const { tokens } = await o.getToken(code);
  if (!tokens.refresh_token) throw new Error("no_refresh_token");
  const db = createAdminClient();
  await db.from("studio_drive").upsert(
    {
      owner_id: ownerId,
      refresh_token: tokens.refresh_token,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" }
  );
}

/** Ngắt kết nối: xóa token + root (kết nối lại tài khoản khác sẽ tạo root mới). */
export async function disconnectStudioDrive(ownerId: string): Promise<void> {
  const db = createAdminClient();
  await db
    .from("studio_drive")
    .update({ refresh_token: null, root_folder_id: null, updated_at: new Date().toISOString() })
    .eq("owner_id", ownerId);
}

export async function studioDriveStatus(
  ownerId: string
): Promise<{ configured: boolean; connected: boolean; rootFolderName: string; rootCreated: boolean; template: FolderTemplate }> {
  const row = await loadStudioDrive(ownerId);
  return {
    configured: studioDriveConfigured(),
    connected: !!row?.refresh_token,
    rootFolderName: row?.root_folder_name || ROOT_FOLDER_NAME,
    rootCreated: !!row?.root_folder_id,
    template: normalizeTemplate(row?.folder_template),
  };
}

/**
 * Đặt/đổi tên thư mục gốc trên Drive. Nếu thư mục gốc đã được tạo và đang kết
 * nối → đổi tên luôn trên Drive (studio vẫn có thể tự kéo nó đi nơi khác trong
 * Drive, app nhận theo ID nên không ảnh hưởng đồng bộ).
 */
export async function setRootFolderName(ownerId: string, name: string): Promise<void> {
  const clean = (name || "").trim().replace(/[\\/]/g, " ").slice(0, 100) || ROOT_FOLDER_NAME;
  const db = createAdminClient();
  await db.from("studio_drive").upsert(
    { owner_id: ownerId, root_folder_name: clean, updated_at: new Date().toISOString() },
    { onConflict: "owner_id" }
  );
  const row = await loadStudioDrive(ownerId);
  if (row?.refresh_token && row.root_folder_id) {
    const o = oauth();
    o.setCredentials({ refresh_token: row.refresh_token });
    const drive = google.drive({ version: "v3", auth: o });
    await drive.files.update({ fileId: row.root_folder_id, requestBody: { name: clean } }).catch(() => {});
  }
}

/** Lưu mẫu thư mục mặc định của studio (áp dụng cho hợp đồng tạo cây SAU đó). */
export async function setFolderTemplate(ownerId: string, template: FolderTemplate): Promise<void> {
  const db = createAdminClient();
  await db.from("studio_drive").upsert(
    { owner_id: ownerId, folder_template: normalizeTemplate(template), updated_at: new Date().toISOString() },
    { onConflict: "owner_id" }
  );
}

/** Cấp access token TẠM để client tải file thẳng lên Drive (scope drive.file). */
export async function getStudioAccessToken(
  ownerId: string
): Promise<{ access_token: string; expiry: number } | null> {
  const row = await loadStudioDrive(ownerId);
  if (!row?.refresh_token) return null;
  const o = oauth();
  o.setCredentials({ refresh_token: row.refresh_token });
  const r = await o.getAccessToken();
  const token = r?.token;
  if (!token) return null;
  return { access_token: token, expiry: o.credentials.expiry_date ?? Date.now() + 50 * 60 * 1000 };
}

// ─── Tạo cây thư mục Drive cho hợp đồng ───────────────────────────────────────

async function mkFolder(drive: any, name: string, parentId: string | null): Promise<string> {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });
  const id = res.data.id as string | undefined;
  if (!id) throw new Error("mkfolder_failed");
  return id;
}

async function makePublic(drive: any, fileId: string): Promise<void> {
  await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" } }).catch(() => {});
}

const MEDIA_Q = "(mimeType contains 'image/' or mimeType contains 'video/')";

/**
 * Thư mục Drive của studio đã CÓ ảnh/video chưa (soi cả thư mục con, tới 3 tầng
 * — cùng độ sâu mà đồng bộ album tách thư mục con, xem planSubFolderSources).
 *
 * Dùng để biết hậu kỳ đã xử lý xong hay chưa: hợp đồng chuyển "hoàn thành" là
 * chuyện TIỀN (thu đủ, chốt sổ), không có nghĩa File ChinhSua đã có ảnh. Đọc
 * bằng chính OAuth của studio nên không phụ thuộc GOOGLE_API_KEY hay việc thư
 * mục đã công khai chưa.
 *
 * Trước đây chỉ soi MỘT tầng con, trong khi đồng bộ đi 3 tầng: ảnh nằm ở
 * "File ChinhSua / Ngày 1 / Sáng" thì đồng bộ thấy mà hàm này báo trống → album
 * giao khách không bao giờ tự tạo. Mỗi lượt hỏi Drive chỉ lấy vài dòng và có
 * trần tổng số lượt để cron không nện Drive API.
 *
 * Lỗi/không kết nối → trả `false` (coi như CHƯA có ảnh): thà chậm một nhịp — cron
 * hôm sau và nút "Giao khách ngay" vẫn tạo được — còn hơn đẩy khách sang album
 * giao khách rỗng.
 */
export async function driveFolderHasMedia(ownerId: string, folderId: string): Promise<boolean> {
  const row = await loadStudioDrive(ownerId);
  if (!row?.refresh_token) return false;
  const o = oauth();
  o.setCredentials({ refresh_token: row.refresh_token });
  const drive = google.drive({ version: "v3", auth: o });
  const MAX_DEPTH = 3;
  let budget = 40; // trần số lượt gọi Drive cho một lần soi
  const walk = async (parentId: string, depth: number): Promise<boolean> => {
    if (budget-- <= 0) return false;
    const media = await drive.files.list({
      q: `'${parentId}' in parents and ${MEDIA_Q} and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
      spaces: "drive",
    });
    if ((media.data.files?.length ?? 0) > 0) return true;
    if (depth >= MAX_DEPTH || budget <= 0) return false;
    budget--;
    const subs = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
      pageSize: 10,
      spaces: "drive",
    });
    for (const f of subs.data.files ?? []) {
      if (f.id && (await walk(f.id, depth + 1))) return true;
    }
    return false;
  };
  try {
    return await walk(folderId, 0);
  } catch {
    return false;
  }
}

export type ContractForDrive = {
  id: string;
  code?: string | null;
  title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  event_date?: string | null;
  shoot_type?: string | null;
  service_id?: string | null;
  status?: string | null;
  drive_folder_id?: string | null;
  drive_tree?: any;
  drive_make_photo?: boolean | null;
  drive_make_video?: boolean | null;
  selection_album_id?: string | null;
  gallery_album_id?: string | null;
};

// Cột chọn cho các query hợp đồng cần đồng bộ Drive (thêm service_id để chọn root).
const CONTRACT_DRIVE_COLS =
  "id, code, title, client_name, client_phone, event_date, shoot_type, service_id, status, drive_folder_id, drive_tree, drive_make_photo, drive_make_video, selection_album_id, gallery_album_id";

// ─── Cây thư mục: Gốc / Loại dịch vụ / Thang N / Hợp đồng ─────────────────────
// Quy ước tên thư mục (loại dịch vụ / tháng) dùng chung với file hợp đồng — xem
// @/lib/desktop/contract-path.

/**
 * Tìm thư mục con theo tên trong 1 thư mục cha (chưa xoá) — tái dùng nếu đã có,
 * chưa có thì tạo. Nhờ vậy thư mục Loại dịch vụ & Tháng chỉ tạo MỘT LẦN rồi các
 * hợp đồng sau lưu đúng vào đó.
 */
async function findOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
  const safe = name.replace(/['\\]/g, "\\$&");
  try {
    const res = await drive.files.list({
      q: `name = '${safe}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
      fields: "files(id)",
      pageSize: 1,
      spaces: "drive",
    });
    const found = res.data.files?.[0]?.id as string | undefined;
    if (found) return found;
  } catch {
    /* lỗi tìm kiếm → tạo mới */
  }
  return mkFolder(drive, name, parentId);
}

/** Thư mục GỐC mặc định của studio (studio_drive). create=true → tạo nếu chưa có. */
async function ensureRootFolder(
  db: any,
  drive: any,
  ownerId: string,
  row: DriveRow,
  create: boolean
): Promise<{ rootId: string | null; rootName: string }> {
  const rootName = cleanFolderName(row.root_folder_name || "") || ROOT_FOLDER_NAME;
  let rid = row.root_folder_id;
  if (!rid && create) {
    rid = await mkFolder(drive, rootName, null);
    await db.from("studio_drive").update({ root_folder_id: rid, updated_at: new Date().toISOString() }).eq("owner_id", ownerId);
  }
  return { rootId: rid ?? null, rootName };
}

/**
 * Đường dẫn tương đối cho DESKTOP tạo thư mục local: [Loại dịch vụ, Thang N?,
 * Tên hợp đồng]. KHÔNG kèm tên thư mục gốc — trên máy, thư mục studio đã chọn
 * (mediaDir) CHÍNH LÀ gốc. (Trên Drive vẫn có thư mục gốc riêng vì đó là thư mục
 * thật trong Drive.) Dùng CHUNG quy ước với file hợp đồng để 2 bên cùng cấu trúc.
 */
async function contractPathSegments(db: any, contract: ContractForDrive): Promise<string[]> {
  return contractFolderSegments(db, contract, contractBaseName(contract as any));
}

/**
 * Bảo đảm cây thư mục Drive cho hợp đồng đã tồn tại (idempotent). Cấu trúc:
 *   {Gốc} / {Loại dịch vụ} / Thang{tháng ngày thực hiện} / {Tên hợp đồng} / Photo|Video/…
 * Thư mục Loại dịch vụ & Tháng được tái dùng (tạo 1 lần). Trả { folderId, tree,
 * pathSegments } hoặc { error }.
 */
export async function ensureContractDriveTree(
  ownerId: string,
  contract: ContractForDrive
): Promise<{ folderId: string; tree: DriveTreeNode[]; pathSegments: string[] } | { error: string }> {
  const row = await loadStudioDrive(ownerId);
  if (!row?.refresh_token) return { error: "not_connected" };
  const db = createAdminClient();

  // Đã tạo rồi → trả lại (không tạo trùng). Vẫn tính lại đường dẫn (chỉ đọc DB)
  // để desktop lồng thư mục local đúng cấu trúc.
  if (contract.drive_folder_id && Array.isArray(contract.drive_tree)) {
    const pathSegments = await contractPathSegments(db, contract);
    return { folderId: contract.drive_folder_id, tree: contract.drive_tree as DriveTreeNode[], pathSegments };
  }

  const o = oauth();
  o.setCredentials({ refresh_token: row.refresh_token });
  const drive = google.drive({ version: "v3", auth: o });
  const template = normalizeTemplate(row.folder_template);

  // 1) Gốc → Loại dịch vụ → Thang N (dịch vụ & tháng tái dùng nếu đã có).
  const { rootId } = await ensureRootFolder(db, drive, ownerId, row, true);
  const svcName = await serviceFolderName(db, contract);
  const serviceFolderId = await findOrCreateFolder(drive, svcName, rootId as string);
  const month = monthFolderName(contract.event_date);
  const parentId = month ? await findOrCreateFolder(drive, month, serviceFolderId) : serviceFolderId;

  // 2) Thư mục hợp đồng (nằm trong thư mục tháng của loại dịch vụ).
  const contractFolderName = contractBaseName(contract as any);
  const contractFolderId = await findOrCreateFolder(drive, contractFolderName, parentId);
  // Đường dẫn local KHÔNG kèm thư mục gốc — mediaDir của studio chính là gốc.
  const pathSegments = [svcName, ...(month ? [month] : []), contractFolderName];

  const tree: DriveTreeNode[] = [];
  const makePhoto = contract.drive_make_photo !== false;
  const makeVideo = contract.drive_make_video === true;

  // 3) Photo/*
  if (makePhoto) {
    const photoId = await findOrCreateFolder(drive, "Photo", contractFolderId);
    for (const node of template.photo) {
      const id = await findOrCreateFolder(drive, node.name, photoId);
      if (node.role === "selection" || node.role === "delivery") await makePublic(drive, id);
      tree.push({ path: `Photo/${node.name}`, id, role: node.role ?? null, excluded: !!node.excluded });
    }
  }

  // 4) Video/* — chỉ khi studio chọn có quay.
  if (makeVideo) {
    const videoId = await findOrCreateFolder(drive, "Video", contractFolderId);
    for (const node of template.video) {
      const id = await findOrCreateFolder(drive, node.name, videoId);
      if (node.role === "selection" || node.role === "delivery") await makePublic(drive, id);
      tree.push({ path: `Video/${node.name}`, id, role: node.role ?? null, excluded: !!node.excluded });
    }
  }

  await db.from("studio_contracts").update({ drive_folder_id: contractFolderId, drive_tree: tree }).eq("id", contract.id);

  return { folderId: contractFolderId, tree, pathSegments };
}

// ─── Tạo album chọn ảnh (JPG Goc) + gallery giao khách (File ChinhSua) ────────

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "album"
  );
}

async function uniqueSlug(db: any, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    const { data } = await db.from("albums").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

type AlbumFolder = { id: string; name: string };

/** Lý do không chốt được giai đoạn giao khách — để màn hợp đồng nói đúng chuyện. */
export type DeliveryReason =
  | "no_drive" // studio chưa nối Drive / hợp đồng chưa có cây thư mục
  | "no_delivery_folder" // cây thư mục không có thư mục vai trò "giao khách"
  | "waiting" // có thư mục giao khách nhưng còn trống
  | `insert_failed:${string}` // database từ chối tạo album (trigger hạn mức / quyền gallery…)
  | `update_failed:${string}`; // không chuyển được album của hợp đồng sang giao khách

/** Các thư mục vai trò "giao khách" trong cây Drive; phần tử ĐẦU là thư mục chính (File ChinhSua). */
function deliveryFolders(tree: DriveTreeNode[] | null | undefined): DriveTreeNode[] {
  return (tree ?? []).filter((n) => n.role === "delivery" && !!n.id);
}

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/**
 * Dấu mốc giao khách — Y HỆT nút "Chuyển sang giai đoạn Giao khách" trong
 * AlbumEditor (switchPhase): `delivered_at` đặt MỘT lần, `storage_until` tính
 * từ đó theo chính sách lưu trữ của studio (profiles.storage_months, mặc định 6).
 */
async function deliveryStamp(db: any, ownerId: string): Promise<{ delivered_at: string; storage_until: string | null }> {
  const { data, error } = await db.from("profiles").select("storage_months").eq("id", ownerId).maybeSingle();
  const months = !error && typeof data?.storage_months === "number" ? data.storage_months : 6;
  const now = new Date();
  return { delivered_at: now.toISOString(), storage_until: storageUntil(now, months) };
}

/** Bỏ hai cột vòng đời lưu trữ khi database chưa chạy migrations/lifecycle_followup.sql. */
function lacksLifecycleCols(err: unknown): boolean {
  return isMissingColumn(err, "delivered_at") || isMissingColumn(err, "storage_until");
}
function withoutLifecycle<T extends Record<string, any>>(row: T): T {
  const { delivered_at: _d, storage_until: _s, ...rest } = row;
  return rest as T;
}

/** Album chưa có ảnh nào → đồng bộ lại từ Drive (lỗi thì bỏ qua, lần sau thử lại). */
async function resyncIfEmpty(db: any, albumId: string): Promise<void> {
  try {
    const { count } = await db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);
    if ((count ?? 0) === 0) await syncAlbumPhotos(db, albumId);
  } catch {
    /* đồng bộ là việc phụ — không chặn luồng giao khách */
  }
}

async function createAlbumFromFolder(
  db: any,
  ownerId: string,
  opts: {
    title: string;
    folderId: string;
    phase: "selection" | "delivery";
    isGallery: boolean;
    sourceName: string;
    /** Thư mục nguồn thêm (cùng giai đoạn) — vd "Video HoanThien" cạnh File ChinhSua. */
    extraFolders?: AlbumFolder[];
    clientName?: string | null;
    clientPhone?: string | null;
    eventDate?: string | null;
  }
): Promise<{ id: string | null; error?: string }> {
  const slug = await uniqueSlug(db, opts.title);
  const row: Record<string, any> = {
    owner_id: ownerId,
    title: opts.title,
    slug,
    phase: opts.phase,
    is_gallery: opts.isGallery,
    status: "published",
    client_name: opts.clientName ?? null,
    client_phone: opts.clientPhone ?? null,
    event_date: opts.eventDate ?? null,
    download_enabled: opts.phase === "delivery",
    // Đóng dấu chìm là TỰ CHỌN — studio tự bật trong cài đặt album.
    //
    // Trước đây album chọn ảnh tự bật watermark. Hệ quả về băng thông rất
    // lớn: ảnh CÓ dấu bắt buộc phải chảy qua máy chủ (canvas cần đọc pixel,
    // mà Google Drive không gửi header CORS nên không chuyển hướng thẳng
    // sang Google được), còn ảnh KHÔNG dấu thì 302 sang Drive — máy chủ tốn
    // đúng 0 byte. Vercel báo Fast Origin Transfer 11,54 GB / 10 GB.
    //
    // Hàm này chạy TỰ ĐỘNG mỗi ngày: cron /api/cron/reminders →
    // autoAdvanceContracts() → hợp đồng sang "đang thực hiện" → tạo album
    // chọn ảnh. Nên chỉ đổi default trong DB là KHÔNG đủ — dòng này ghi đè
    // lên default. Xem supabase/migrations/watermark_opt_in.sql.
    watermark_enabled: false,
  };
  // Album giao khách tự tạo cũng phải có mốc giao + hạn lưu trữ như khi studio
  // tự bấm chuyển giai đoạn — thiếu thì nhắc dọn Drive không bao giờ chạy.
  if (opts.phase === "delivery") Object.assign(row, await deliveryStamp(db, ownerId));

  let res = await db.from("albums").insert(row).select("id").single();
  if (res.error && lacksLifecycleCols(res.error)) res = await db.from("albums").insert(withoutLifecycle(row)).select("id").single();
  // Trước đây lỗi chèn bị nuốt im lặng (vd trigger enforce_album_quota chặn
  // gallery khi profiles.can_galleries tắt) và màn hợp đồng báo nhầm "chưa có
  // thư mục Drive". Giờ trả nguyên lý do lên.
  if (res.error || !res.data) return { id: null, error: res.error?.message || "không rõ lỗi" };
  const albumId = res.data.id as string;

  const folders: AlbumFolder[] = [{ id: opts.folderId, name: opts.sourceName }, ...(opts.extraFolders ?? [])];
  const { error: srcErr } = await db.from("album_sources").insert(
    folders.map((fo, i) => ({
      album_id: albumId,
      name: fo.name,
      drive_url: folderUrl(fo.id),
      kind: "folder",
      stage: opts.phase,
      position: i,
    }))
  );
  // Album tạo phía máy chủ trước đây CHỈ có album + nguồn, không ai đồng bộ ảnh
  // → khách mở ra trống trơn cho tới khi studio tự bấm "Lưu & đồng bộ". Đồng bộ
  // ngay; lỗi (thiếu GOOGLE_API_KEY, Drive chậm) không được làm hỏng cả luồng.
  if (!srcErr) {
    try {
      await syncAlbumPhotos(db, albumId);
    } catch {
      /* lần đồng bộ sau (desktop / cron / nút đồng bộ) tạo bù */
    }
  }
  return { id: albumId };
}

/**
 * Chuyển CHÍNH album của hợp đồng (selection_album_id) sang giai đoạn giao
 * khách thay vì đẻ thêm album "Giao khách · …".
 *
 * Trước đây luồng giao khách chỉ nhìn gallery_album_id: studio đã gắn album cho
 * hợp đồng mà hoàn thành vẫn tạo album mới, cổng khách giấu album cũ và
 * /a/[slug] chuyển khách sang album mới rỗng.
 *
 * Các bước: thêm thư mục giao khách của cây Drive (File ChinhSua…) làm nguồn
 * stage='delivery' nếu chưa có → đồng bộ → có ảnh giao khách (hoặc `force`) thì
 * đổi phase y như nút chuyển giai đoạn trong AlbumEditor (+ bật tải ảnh như album
 * giao khách tự tạo).
 *
 * Trả `null` = không áp dụng được (album không còn, hoặc album không có nguồn
 * Drive nào mà hợp đồng cũng không có cây thư mục) → chỗ gọi dùng luồng cũ.
 */
async function promoteLinkedAlbum(
  db: any,
  ownerId: string,
  albumId: string,
  tree: DriveTreeNode[] | null,
  opts?: { force?: boolean }
): Promise<DeliveryAlbumResult | null> {
  const { data: al } = await db.from("albums").select("id, owner_id, phase, is_gallery").eq("id", albumId).maybeSingle();
  if (!al || al.owner_id !== ownerId) return null;
  if (isDeliveryPhase(al)) return { album: true, created: false, waiting: false };
  // Đọc riêng: database chưa chạy lifecycle_followup.sql thì cột chưa có.
  const { data: stamp } = await db.from("albums").select("delivered_at").eq("id", albumId).maybeSingle();
  const deliveredAt = (stamp as { delivered_at?: string | null } | null)?.delivered_at ?? null;

  const { data: srcRows } = await db.from("album_sources").select("id, drive_url, stage, position").eq("album_id", albumId);
  const sources = (srcRows ?? []) as { id: string; drive_url: string | null; stage: string | null; position: number | null }[];
  const dels = deliveryFolders(tree);
  if (sources.length === 0 && dels.length === 0) return null;

  // Thêm thư mục giao khách của cây Drive làm nguồn (một lần — so theo id thư mục).
  const hasFolder = (id: string) => sources.some((x) => (x.drive_url ?? "").includes(id));
  let pos = Math.max(0, ...sources.map((x) => x.position ?? 0));
  const add = dels
    .filter((d) => !hasFolder(d.id))
    .map((d) => ({
      album_id: albumId,
      name: d.path.split("/").pop() || "File ChinhSua",
      drive_url: folderUrl(d.id),
      kind: "folder",
      stage: "delivery",
      position: ++pos,
    }));
  if (add.length) await db.from("album_sources").insert(add);

  try {
    await syncAlbumPhotos(db, albumId);
  } catch {
    /* đồng bộ lỗi → dựa vào phép soi Drive bên dưới */
  }

  // Có ảnh giao khách chưa? Đếm ảnh thuộc nguồn stage='delivery' (kể cả thư mục
  // con vừa tách khi đồng bộ).
  const { data: delSrc } = await db.from("album_sources").select("id").eq("album_id", albumId).eq("stage", "delivery");
  const delIds = ((delSrc ?? []) as { id: string }[]).map((x) => x.id);
  let ready = opts?.force === true;
  if (!ready && delIds.length) {
    const { count } = await db
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("album_id", albumId)
      .in("source_id", delIds);
    ready = (count ?? 0) > 0;
  }
  if (!ready && dels[0]) ready = await driveFolderHasMedia(ownerId, dels[0].id);
  if (!ready) {
    return delIds.length
      ? { album: false, created: false, waiting: true, reason: "waiting" }
      : { album: false, created: false, waiting: false, reason: "no_delivery_folder" };
  }

  const patch: Record<string, any> = { phase: "delivery", download_enabled: true };
  if (!deliveredAt) Object.assign(patch, await deliveryStamp(db, ownerId));
  let { error } = await db.from("albums").update(patch).eq("id", albumId);
  if (error && lacksLifecycleCols(error)) ({ error } = await db.from("albums").update(withoutLifecycle(patch)).eq("id", albumId));
  if (error) return { album: false, created: false, waiting: false, reason: `update_failed:${error.message}` };
  return { album: true, created: true, waiting: false };
}

/**
 * Tạo (nếu chưa có) album chọn ảnh từ thư mục "JPG Goc" và/hoặc gallery giao
 * khách từ "File ChinhSua", rồi gắn vào hợp đồng. Trả về id các album.
 *
 * `opts.phases` quyết định giai đoạn nào được tạo. Mặc định theo trạng thái hợp
 * đồng: LUÔN tạo album chọn ảnh (selection) khi có thư mục; chỉ tạo album giao
 * (delivery) khi hợp đồng đã "completed" — theo đúng quy trình: ký → chọn ảnh,
 * hoàn thành → giao khách. Hàm idempotent (đã có album thì không tạo lại).
 *
 * Album GIAO KHÁCH còn một điều kiện nữa: thư mục File ChinhSua phải CÓ ẢNH.
 * `opts.force` bỏ qua điều kiện đó (studio bấm "Giao khách ngay"). Cờ trả về
 * `deliveryWaiting` = có thư mục giao khách nhưng còn trống, tức hợp đồng đã
 * hoàn thành mà hậu kỳ chưa xong — cứ để khách ở giai đoạn chọn ảnh.
 *
 * Hợp đồng ĐÃ có album (selection_album_id) mà chưa có album giao riêng → không
 * tạo album mới nữa: chuyển chính album đó sang giao khách (promoteLinkedAlbum).
 * Khi đó `deliveredAlbumId` = album của hợp đồng, `galleryAlbumId` vẫn null.
 */
export async function wireContractAlbums(
  ownerId: string,
  contract: ContractForDrive,
  tree: DriveTreeNode[],
  opts?: { phases?: ("selection" | "delivery")[]; force?: boolean }
): Promise<{
  selectionAlbumId: string | null;
  galleryAlbumId: string | null;
  deliveryWaiting: boolean;
  /** Album đang là album giao khách sau lần gọi này (gallery hoặc album của hợp đồng). */
  deliveredAlbumId: string | null;
  /** Vừa tạo / vừa chuyển sang giao khách trong lần gọi này. */
  deliveryCreated: boolean;
  deliveryReason?: DeliveryReason;
}> {
  const db = createAdminClient();
  // Mặc định theo trạng thái hợp đồng — theo đúng quy trình:
  //   - Album CHỌN ẢNH: chỉ tạo khi HĐ đã sang "đang thực hiện" (in_progress)
  //     hoặc "hoàn thành". HĐ mới ký (approved) mà CHƯA tới giai đoạn thực hiện
  //     thì CHƯA tạo album (yêu cầu: ẩn/không tạo album cho tới khi thực hiện).
  //   - Album GIAO KHÁCH: chỉ tạo khi HĐ "hoàn thành".
  const inProduction =
    contract.status === "in_progress" || contract.status === "post_production" || contract.status === "completed";
  /* Hợp đồng makeup / thuê đồ KHÔNG có ảnh nào để chọn hay giao, nên đừng tạo
     album và thư mục Drive cho nó — tạo ra là rác trong thư viện, và kéo theo
     cả chuỗi nhắc "mời khách chọn ảnh" qua Zalo cho một hợp đồng không có ảnh.
     Chỉ chặn đường SUY RA MẶC ĐỊNH: chỗ nào truyền thẳng `opts.phases` là studio
     chủ động yêu cầu, vẫn làm như thường. */
  const coHauKyAnh = kindHasPhotoWork(contractKind(contract.shoot_type as never));
  const phases =
    opts?.phases ??
    ([
      ...(inProduction && coHauKyAnh ? ["selection"] : []),
      ...(contract.status === "completed" && coHauKyAnh ? ["delivery"] : []),
    ] as ("selection" | "delivery")[]);
  const wantSel = phases.includes("selection");
  const wantDel = phases.includes("delivery");
  const sel = wantSel ? tree.find((n) => n.role === "selection") : undefined;
  // Thư mục giao khách: phần tử đầu (File ChinhSua) quyết định "đã có ảnh để
  // giao chưa"; các thư mục giao khách khác (Video HoanThien) đi kèm làm nguồn.
  const dels = wantDel ? deliveryFolders(tree) : [];
  const del = dels[0];
  const who = contract.client_name || contract.code || "Hợp đồng";

  let selectionAlbumId = contract.selection_album_id ?? null;
  let galleryAlbumId = contract.gallery_album_id ?? null;
  let deliveredAlbumId: string | null = galleryAlbumId;
  let deliveryCreated = false;
  let deliveryReason: DeliveryReason | undefined;
  const patch: Record<string, any> = {};

  if (sel && !selectionAlbumId) {
    const r = await createAlbumFromFolder(db, ownerId, {
      title: `Chọn ảnh · ${who}`,
      folderId: sel.id,
      phase: "selection",
      isGallery: false,
      sourceName: sel.path.split("/").pop() || "JPG Goc",
      clientName: contract.client_name,
      clientPhone: contract.client_phone,
      eventDate: contract.event_date,
    });
    selectionAlbumId = r.id;
    if (selectionAlbumId) patch.selection_album_id = selectionAlbumId;
  }

  // Hợp đồng "hoàn thành" = đã thu đủ tiền, KHÔNG có nghĩa ảnh đã chỉnh xong.
  // Thư mục File ChinhSua còn trống thì chưa có gì để giao: không tạo album giao
  // khách, để khách ở nguyên giai đoạn chọn ảnh. Ảnh lên Drive lúc nào thì cron
  // /api/cron/zalo?only=work (hoặc nút "Giao khách ngay") tạo album lúc đó.
  let deliveryWaiting = false;
  let handled = false;
  if (wantDel && !galleryAlbumId && contract.selection_album_id) {
    // Studio đã gắn album cho hợp đồng → giao khách trên CHÍNH album đó.
    const p = await promoteLinkedAlbum(db, ownerId, contract.selection_album_id, tree, { force: opts?.force });
    if (p) {
      handled = true;
      deliveryWaiting = p.waiting;
      deliveryReason = p.reason;
      if (p.album) deliveredAlbumId = contract.selection_album_id;
      deliveryCreated = p.created;
    }
  }
  if (wantDel && !galleryAlbumId && !handled) {
    if (!del) {
      deliveryReason = "no_delivery_folder";
    } else {
      const ready = opts?.force === true || (await driveFolderHasMedia(ownerId, del.id));
      if (!ready) {
        deliveryWaiting = true;
        deliveryReason = "waiting";
      } else {
        const r = await createAlbumFromFolder(db, ownerId, {
          title: `Giao khách · ${who}`,
          folderId: del.id,
          phase: "delivery",
          isGallery: true,
          sourceName: del.path.split("/").pop() || "File ChinhSua",
          extraFolders: dels.slice(1).map((d) => ({ id: d.id, name: d.path.split("/").pop() || "Giao khách" })),
          clientName: contract.client_name,
          clientPhone: contract.client_phone,
          eventDate: contract.event_date,
        });
        galleryAlbumId = r.id;
        if (galleryAlbumId) {
          patch.gallery_album_id = galleryAlbumId;
          deliveredAlbumId = galleryAlbumId;
          deliveryCreated = true;
        } else {
          deliveryReason = `insert_failed:${r.error ?? "không rõ lỗi"}`;
        }
      }
    }
  }

  if (Object.keys(patch).length) await db.from("studio_contracts").update(patch).eq("id", contract.id);
  return { selectionAlbumId, galleryAlbumId, deliveryWaiting, deliveredAlbumId, deliveryCreated, deliveryReason };
}

/**
 * Tự tạo cây thư mục Drive + album NGAY khi khách ký (chạy phía máy chủ, không
 * phụ thuộc app desktop). Nếu studio chưa kết nối Drive → bỏ qua im lặng.
 * Thư mục trên MÁY do app desktop tạo (server không ghi được ổ đĩa của studio).
 */
export async function autoCreateContractDriveOnSign(ownerId: string, contractId: string): Promise<void> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select(CONTRACT_DRIVE_COLS)
    .eq("id", contractId)
    .maybeSingle();
  if (!c) return;
  const tree = await ensureContractDriveTree(ownerId, c as ContractForDrive);
  if ("error" in tree) return; // not_connected → studio chưa nối Drive
  // Khi ký: chỉ dựng sẵn cây thư mục Drive, CHƯA tạo album nào. Album chọn ảnh
  // để dành tới khi hợp đồng chuyển sang "đang thực hiện" (in_progress) —
  // autoCreateContractSelectionOnProduction; album giao khách để dành tới khi
  // "hoàn thành" — autoCreateContractDeliveryOnComplete.
}

/**
 * Tự tạo album CHỌN ẢNH (phase "selection") khi hợp đồng chuyển sang "đang thực
 * hiện" (in_progress). Trước mốc này album được giữ CHƯA tạo để không hiện trong
 * thư viện/danh sách. Idempotent (đã có selection_album_id thì bỏ qua). Studio
 * chưa nối Drive → bỏ qua im lặng (desktop sẽ tạo bù khi đồng bộ). Trả về true
 * nếu vừa tạo hoặc đã có album chọn ảnh.
 */
export async function autoCreateContractSelectionOnProduction(ownerId: string, contractId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select(CONTRACT_DRIVE_COLS)
    .eq("id", contractId)
    .maybeSingle();
  if (!c) return false;
  if ((c as ContractForDrive).selection_album_id) return true; // đã có album chọn ảnh
  const tree = await ensureContractDriveTree(ownerId, c as ContractForDrive);
  if ("error" in tree) return false; // not_connected → studio chưa nối Drive
  const { selectionAlbumId } = await wireContractAlbums(ownerId, c as ContractForDrive, tree.tree, { phases: ["selection"] });
  return !!selectionAlbumId;
}

/** Kết quả một lần thử chốt giai đoạn giao khách cho hợp đồng. */
export type DeliveryAlbumResult = {
  /** Hợp đồng đã có album giao khách (vừa tạo hoặc có sẵn). */
  album: boolean;
  /** Album vừa được tạo (hoặc album của hợp đồng vừa chuyển sang giao khách) trong lần gọi này. */
  created: boolean;
  /** Thư mục ảnh chỉnh sửa còn trống → hậu kỳ chưa xong, vẫn ở giai đoạn chọn ảnh. */
  waiting: boolean;
  /** Vì sao chưa giao được (album = false) — xem DeliveryReason. */
  reason?: DeliveryReason;
};

/**
 * Chốt giai đoạn GIAO KHÁCH khi hợp đồng "hoàn thành" VÀ thư mục ảnh chỉnh sửa
 * đã có ảnh. Idempotent. `opts.force` = studio tự bấm giao khách, không đợi ảnh.
 *
 *   • Đã có album giao riêng (gallery_album_id) → giữ nguyên; album đó chưa có
 *     ảnh nào thì đồng bộ lại (album tạo phía máy chủ trước đây không đồng bộ).
 *   • Đã có album của hợp đồng (selection_album_id) → chuyển CHÍNH nó sang giao
 *     khách (promoteLinkedAlbum), không tạo album thứ hai.
 *   • Không có gì → tạo album "Giao khách · …" từ thư mục File ChinhSua như cũ.
 * Studio chưa nối Drive → reason "no_drive" (desktop sẽ tạo bù khi đồng bộ).
 */
export async function autoCreateContractDeliveryOnComplete(
  ownerId: string,
  contractId: string,
  opts?: { force?: boolean }
): Promise<DeliveryAlbumResult> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select(CONTRACT_DRIVE_COLS)
    .eq("id", contractId)
    .maybeSingle();
  if (!c) return { album: false, created: false, waiting: false };
  const contract = c as ContractForDrive;
  if (contract.gallery_album_id) {
    await resyncIfEmpty(db, contract.gallery_album_id);
    return { album: true, created: false, waiting: false };
  }
  // Album của hợp đồng đã ở giai đoạn giao khách → xong, khỏi gọi Drive.
  if (contract.selection_album_id) {
    const { data: s } = await db.from("albums").select("phase, is_gallery").eq("id", contract.selection_album_id).maybeSingle();
    if (s && isDeliveryPhase(s)) return { album: true, created: false, waiting: false };
  }

  let tree: DriveTreeNode[] | null = null;
  try {
    const t = await ensureContractDriveTree(ownerId, contract);
    if (!("error" in t)) tree = t.tree;
  } catch {
    tree = null; // lỗi Drive tạm thời — vẫn thử giao trên nguồn sẵn có của album
  }

  if (!tree) {
    // Không có cây Drive: album của hợp đồng có nguồn riêng (studio tự dán link
    // File ChinhSua trong AlbumEditor) thì vẫn chuyển được.
    if (contract.selection_album_id) {
      const p = await promoteLinkedAlbum(db, ownerId, contract.selection_album_id, null, opts);
      if (p) return p;
    }
    return { album: false, created: false, waiting: false, reason: "no_drive" };
  }
  const r = await wireContractAlbums(ownerId, contract, tree, { phases: ["delivery"], force: opts?.force });
  return {
    album: !!r.deliveredAlbumId,
    created: r.deliveryCreated,
    waiting: r.deliveryWaiting,
    reason: r.deliveredAlbumId ? undefined : r.deliveryReason,
  };
}
