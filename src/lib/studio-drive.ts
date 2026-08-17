import "server-only";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOAuthState, verifyOAuthState } from "@/lib/oauth-state";
import { contractBaseName } from "@/lib/desktop/contract-doc";
import { cleanFolderName, serviceFolderName, monthFolderName, contractFolderSegments } from "@/lib/desktop/contract-path";

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
    { name: "Video HoanThien", role: null, excluded: false },
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

async function createAlbumFromFolder(
  db: any,
  ownerId: string,
  opts: {
    title: string;
    folderId: string;
    phase: "selection" | "delivery";
    isGallery: boolean;
    sourceName: string;
    clientName?: string | null;
    clientPhone?: string | null;
    eventDate?: string | null;
  }
): Promise<string | null> {
  const slug = await uniqueSlug(db, opts.title);
  const { data: album, error } = await db
    .from("albums")
    .insert({
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
      // Trước đây album chọn ảnh tự bật watermark, và vì ảnh có dấu bắt buộc
      // phải chảy qua máy chủ (Drive không gửi header CORS nên không chuyển
      // hướng thẳng sang Google được), mỗi lượt khách tải là một lần tốn băng
      // thông — trong khi album không dấu thì 302 sang Drive, tốn 0 byte.
      // Xem supabase/migrations/watermark_opt_in.sql.
      watermark_enabled: false,
    })
    .select("id")
    .single();
  if (error || !album) return null;
  await db.from("album_sources").insert({
    album_id: album.id,
    name: opts.sourceName,
    drive_url: `https://drive.google.com/drive/folders/${opts.folderId}`,
    kind: "folder",
    stage: opts.phase,
    position: 0,
  });
  return album.id as string;
}

/**
 * Tạo (nếu chưa có) album chọn ảnh từ thư mục "JPG Goc" và/hoặc gallery giao
 * khách từ "File ChinhSua", rồi gắn vào hợp đồng. Trả về id các album.
 *
 * `opts.phases` quyết định giai đoạn nào được tạo. Mặc định theo trạng thái hợp
 * đồng: LUÔN tạo album chọn ảnh (selection) khi có thư mục; chỉ tạo album giao
 * (delivery) khi hợp đồng đã "completed" — theo đúng quy trình: ký → chọn ảnh,
 * hoàn thành → giao khách. Hàm idempotent (đã có album thì không tạo lại).
 */
export async function wireContractAlbums(
  ownerId: string,
  contract: ContractForDrive,
  tree: DriveTreeNode[],
  opts?: { phases?: ("selection" | "delivery")[] }
): Promise<{ selectionAlbumId: string | null; galleryAlbumId: string | null }> {
  const db = createAdminClient();
  // Mặc định theo trạng thái hợp đồng — theo đúng quy trình:
  //   - Album CHỌN ẢNH: chỉ tạo khi HĐ đã sang "đang thực hiện" (in_progress)
  //     hoặc "hoàn thành". HĐ mới ký (approved) mà CHƯA tới giai đoạn thực hiện
  //     thì CHƯA tạo album (yêu cầu: ẩn/không tạo album cho tới khi thực hiện).
  //   - Album GIAO KHÁCH: chỉ tạo khi HĐ "hoàn thành".
  const inProduction = contract.status === "in_progress" || contract.status === "completed";
  const phases =
    opts?.phases ??
    ([
      ...(inProduction ? ["selection"] : []),
      ...(contract.status === "completed" ? ["delivery"] : []),
    ] as ("selection" | "delivery")[]);
  const wantSel = phases.includes("selection");
  const wantDel = phases.includes("delivery");
  const sel = wantSel ? tree.find((n) => n.role === "selection") : undefined;
  const del = wantDel ? tree.find((n) => n.role === "delivery") : undefined;
  const who = contract.client_name || contract.code || "Hợp đồng";

  let selectionAlbumId = contract.selection_album_id ?? null;
  let galleryAlbumId = contract.gallery_album_id ?? null;
  const patch: Record<string, any> = {};

  if (sel && !selectionAlbumId) {
    selectionAlbumId = await createAlbumFromFolder(db, ownerId, {
      title: `Chọn ảnh · ${who}`,
      folderId: sel.id,
      phase: "selection",
      isGallery: false,
      sourceName: sel.path.split("/").pop() || "JPG Goc",
      clientName: contract.client_name,
      clientPhone: contract.client_phone,
      eventDate: contract.event_date,
    });
    if (selectionAlbumId) patch.selection_album_id = selectionAlbumId;
  }

  if (del && !galleryAlbumId) {
    galleryAlbumId = await createAlbumFromFolder(db, ownerId, {
      title: `Giao khách · ${who}`,
      folderId: del.id,
      phase: "delivery",
      isGallery: true,
      sourceName: del.path.split("/").pop() || "File ChinhSua",
      clientName: contract.client_name,
      clientPhone: contract.client_phone,
      eventDate: contract.event_date,
    });
    if (galleryAlbumId) patch.gallery_album_id = galleryAlbumId;
  }

  if (Object.keys(patch).length) await db.from("studio_contracts").update(patch).eq("id", contract.id);
  return { selectionAlbumId, galleryAlbumId };
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

/**
 * Tự tạo album GIAO KHÁCH (phase "delivery") khi hợp đồng chuyển sang trạng thái
 * "hoàn thành". Idempotent (đã có gallery_album_id thì bỏ qua). Studio chưa nối
 * Drive → bỏ qua im lặng (desktop sẽ tạo bù khi đồng bộ). Trả về true nếu vừa
 * tạo hoặc đã có album giao.
 */
export async function autoCreateContractDeliveryOnComplete(ownerId: string, contractId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select(CONTRACT_DRIVE_COLS)
    .eq("id", contractId)
    .maybeSingle();
  if (!c) return false;
  if ((c as ContractForDrive).gallery_album_id) return true; // đã có album giao
  const tree = await ensureContractDriveTree(ownerId, c as ContractForDrive);
  if ("error" in tree) return false; // not_connected → studio chưa nối Drive
  const { galleryAlbumId } = await wireContractAlbums(ownerId, c as ContractForDrive, tree.tree, { phases: ["delivery"] });
  return !!galleryAlbumId;
}
