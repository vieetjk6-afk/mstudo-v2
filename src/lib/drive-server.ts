import "server-only";
import { extractFileId, extractFolderId } from "@/lib/drive";
import { FOLDER_MIME, walkPhotos, type PhotoWalk, type WalkOptions } from "./drive-walk";

export { isPhotoFile, walkPhotos, FOLDER_MIME } from "./drive-walk";
export type { PhotoWalk, WalkOptions, DriveNode } from "./drive-walk";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  imageMediaMetadata?: { width?: number; height?: number };
}

const API = "https://www.googleapis.com/drive/v3";

function key() {
  const k = process.env.GOOGLE_API_KEY;
  if (!k) throw new Error("GOOGLE_API_KEY is not configured");
  return k;
}

/**
 * Referer to send with Drive API calls. Google rejects server-side requests
 * ("Requests from referer <empty> are blocked") when the API key has an HTTP
 * referrer restriction, because server fetches carry no Referer header. Setting
 * one to an allowed origin lets a referrer-restricted key work without removing
 * the restriction. Configure GOOGLE_API_REFERER to a value matching the key's
 * allowed referrers; falls back to the main site host.
 */
function apiReferer(): string | null {
  if (process.env.GOOGLE_API_REFERER) return process.env.GOOGLE_API_REFERER;
  const host = process.env.NEXT_PUBLIC_MAIN_HOST;
  return host ? `https://${host}/` : null;
}

/** fetch() wrapper that attaches the Referer header for referrer-restricted keys. */
function driveFetch(url: string): Promise<Response> {
  const referer = apiReferer();
  return fetch(url, {
    cache: "no-store",
    headers: referer ? { Referer: referer } : undefined,
  });
}

/** Fetch metadata for a single shared file. */
export async function getFileMeta(fileId: string): Promise<DriveFile | null> {
  const url = `${API}/files/${fileId}?fields=id,name,mimeType&key=${key()}`;
  const res = await driveFetch(url);
  if (!res.ok) return null;
  return (await res.json()) as DriveFile;
}

/** List image files inside a publicly shared folder (handles pagination). */
export async function listFolderImages(folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and (mimeType contains 'image/' or mimeType contains 'video/') and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, imageMediaMetadata(width,height))",
      pageSize: "1000",
      orderBy: "name_natural",
      key: key(),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await driveFetch(`${API}/files?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API error (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
    };
    if (data.files) out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}

/** Liệt kê MỌI con trực tiếp (file + thư mục con) của một thư mục, có phân trang. */
export async function listFolderChildren(folderId: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: "1000",
      orderBy: "folder,name_natural",
      key: key(),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await driveFetch(`${API}/files?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API error (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    if (data.files) out.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/** Ảnh trong thư mục CÔNG KHAI, tuỳ chọn quét cả thư mục con (dùng khoá API). */
export function walkFolderPhotos(folderId: string, opts: WalkOptions = {}): Promise<PhotoWalk<DriveFile>> {
  return walkPhotos(folderId, listFolderChildren, opts);
}

export interface ResolvedSource {
  folderName: string | null; // name of the Drive folder, if the source is a folder
  files: DriveFile[];
}

/** List the sub-folders directly inside a folder. */
export async function listSubFolders(folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: "1000",
    orderBy: "name_natural",
    key: key(),
  });
  const res = await driveFetch(`${API}/files?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

/** Resolve a Drive source (file or folder link) to its folder name + images. */
export async function resolveSource(
  url: string,
  kind: "file" | "folder"
): Promise<ResolvedSource> {
  if (kind === "folder") {
    const folderId = extractFolderId(url);
    if (!folderId) return { folderName: null, files: [] };
    const [meta, files] = await Promise.all([
      getFileMeta(folderId),
      listFolderImages(folderId),
    ]);
    return { folderName: meta?.name ?? null, files };
  }

  // kind === "file" — but the link may actually point to a folder (e.g. an
  // "open?id=" link that doesn't contain "/folders/"). Detect via metadata.
  const fileId = extractFileId(url);
  if (!fileId) return { folderName: null, files: [] };

  const meta = await getFileMeta(fileId);
  if (meta) {
    if (meta.mimeType === FOLDER_MIME) {
      return { folderName: meta.name, files: await listFolderImages(fileId) };
    }
    if (meta.mimeType.startsWith("image/") || meta.mimeType.startsWith("video/"))
      return { folderName: null, files: [meta] };
    return { folderName: null, files: [] };
  }

  // Metadata unavailable (e.g. restricted key): try listing as a folder first,
  // then fall back to treating it as a single image file.
  try {
    const asFolder = await listFolderImages(fileId);
    if (asFolder.length > 0) return { folderName: null, files: asFolder };
  } catch {
    /* not a folder */
  }
  return { folderName: null, files: [{ id: fileId, name: fileId, mimeType: "image/*" }] };
}
