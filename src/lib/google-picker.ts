"use client";

/**
 * Google Picker + token helper (browser-only). Uses the NON-sensitive
 * `drive.file` scope: the app only gets access to files/folders the user picks
 * in the Picker (or that it creates). No Google verification needed, no
 * "unverified app" screen, and it works for ANY signed-in Google user on their
 * OWN Drive — including private folders.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
export const GOOGLE_PICKER_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
export const GOOGLE_APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID || "";
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
// Quyền Drive ĐẦY ĐỦ: cho phép mở thư mục theo ID (link dán sẵn) mà không cần
// Picker. Là scope "hạn chế" của Google → hiện màn "app chưa xác minh" cho tới
// khi app được Google kiểm duyệt.
export const DRIVE_FULL_SCOPE = "https://www.googleapis.com/auth/drive";

export const pickerConfigured = !!GOOGLE_CLIENT_ID && !!GOOGLE_PICKER_KEY;

export interface PickedItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`load_failed:${src}`));
    document.head.appendChild(s);
  });
}

let ready = false;
async function ensureGoogle(): Promise<void> {
  if (ready) return;
  await loadScript("https://accounts.google.com/gsi/client");
  await loadScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => (window as any).gapi.load("picker", () => resolve()));
  ready = true;
}

/**
 * Preload the Google scripts (call on mount) so the token popup later opens
 * synchronously inside the click handler instead of after a network load —
 * otherwise the browser blocks it as a non-user-gesture popup.
 */
export async function preloadGoogle(): Promise<void> {
  try {
    await ensureGoogle();
  } catch {
    /* ignore — surfaced when the user actually clicks */
  }
}

// Token đã cấp (giữ trong bộ nhớ trang) → tái dùng cho các lần sau, KHÔNG bắt
// đăng nhập lại mỗi lần. Token Google sống ~1 giờ; hết hạn/bị từ chối thì xin lại.
let cachedToken: { token: string; scope: string; expiry: number } | null = null;

/** Xoá token đã cache (khi bị từ chối quyền) để lần sau đăng nhập lại tài khoản khác. */
export function clearDriveToken(): void {
  cachedToken = null;
}

/**
 * Request a Drive access token via Google Identity Services. `forceConsent`
 * shows the account/consent chooser (use when the previous token expired).
 * Tự cache token còn hạn cho cùng scope → chỉ hiện popup đăng nhập LẦN ĐẦU,
 * các lần sau trong phiên dùng lại token (không popup).
 */
export async function requestDriveToken(forceConsent = false, scope: string = DRIVE_FILE_SCOPE): Promise<string> {
  if (
    !forceConsent &&
    cachedToken &&
    cachedToken.scope === scope &&
    cachedToken.expiry > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }
  await ensureGoogle();
  return new Promise<string>((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      callback: (resp: any) => {
        if (resp?.access_token) {
          const ttl = (Number(resp.expires_in) || 3000) * 1000;
          cachedToken = { token: resp.access_token, scope, expiry: Date.now() + ttl };
          resolve(resp.access_token);
        } else {
          reject(new Error("no_token"));
        }
      },
      error_callback: (err: any) =>
        reject(new Error(err?.type || err?.message || "token_error")),
    });
    client.requestAccessToken({ prompt: forceConsent ? "consent" : "" });
  });
}

/** Open the Picker (images + folders, multi-select). Resolves to picked items. */
export async function openDrivePicker(token: string): Promise<PickedItem[]> {
  await ensureGoogle();
  const google = (window as any).google;
  return new Promise<PickedItem[]>((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes("image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,application/vnd.google-apps.folder");

    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_PICKER_KEY)
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const docs = (data.docs ?? []) as any[];
          resolve(
            docs.map((d) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              isFolder: d.mimeType === "application/vnd.google-apps.folder" || d.type === "folder",
            }))
          );
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      });
    if (GOOGLE_APP_ID) picker.setAppId(GOOGLE_APP_ID);
    picker.build().setVisible(true);
  });
}

/** List image files inside a folder the user granted via the Picker. */
export async function listFolderImages(
  token: string,
  folderId: string
): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) throw new Error("drive_unauthorized");
    if (!res.ok) throw new Error(`drive_error_${res.status}`);
    const data = await res.json();
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/** Fetch a Drive file's bytes (the user granted access via the Picker). */
export async function fetchDriveBytes(token: string, fileId: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 401 || res.status === 403) throw new Error("drive_unauthorized");
  if (!res.ok) throw new Error(`drive_error_${res.status}`);
  return res.blob();
}

/** Create a sub-folder inside a folder the user granted via the Picker. */
export async function createDriveFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    throw new Error("drive_unauthorized");
  }
  if (!res.ok) throw new Error(`drive_error_${res.status}`);
  const data = await res.json();
  if (!data.id) throw new Error("create_folder_failed");
  return data.id as string;
}

/**
 * Copy a Drive file into `parentId` (server-side on Google — no bytes touch the
 * browser). Source must be readable by the signed-in account (public link, or a
 * file the user opened via the Picker); destination is a folder they can edit.
 */
export async function copyDriveFile(token: string, fileId: string, name: string, parentId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    throw new Error("drive_unauthorized");
  }
  if (!res.ok) throw new Error(`drive_error_${res.status}`);
}
