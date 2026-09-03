"use client";

/**
 * CHỖ CẤT sổ lựa chọn của album khách trên máy khách.
 *
 * IndexedDB trước, localStorage sau. Vì sao cả hai:
 *  - IndexedDB không có hạn 5 MB như localStorage và ghi bất đồng bộ nên không
 *    chặn luồng vẽ khi album vài nghìn ảnh.
 *  - Nhưng Safari riêng tư, WebView cũ và một số trình duyệt trong app chat
 *    (khách mở link album từ Zalo/Messenger là chuyện thường) chặn hoặc làm hỏng
 *    IndexedDB. Mất chỗ cất là mất toàn bộ giá trị của tính năng, nên có đường
 *    lui: cùng khoá, cất bằng localStorage.
 *
 * Luật hoà giải nằm ở `@/lib/album-offline` — file này chỉ đọc/ghi.
 */

import { parseLedger, type AlbumLedger } from "./album-offline";

const DB_NAME = "mstudo-album";
const DB_VERSION = 1;
const STORE = "picks";
const LS_PREFIX = "mstudo_picks:";

/** `null` = chưa thử; `false` = đã thử và không dùng được → đi lối localStorage. */
let idbOk: boolean | null = null;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      idbOk = false;
      resolve(null);
      return;
    }
    let done = false;
    const finish = (db: IDBDatabase | null) => {
      if (done) return;
      done = true;
      idbOk = !!db;
      resolve(db);
    };
    // Safari treo `open()` không lỗi không sự kiện khi hết quota hoặc khi tab bị
    // một tab khác chặn nâng cấp. Không có hẹn giờ thì lượt bấm của khách kẹt
    // mãi ở "đang lưu" — thà rơi sang localStorage sau 1,5 giây.
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        finish(req.result);
      };
      req.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };
      req.onblocked = () => {
        clearTimeout(timer);
        finish(null);
      };
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

function lsRead(slug: string): unknown {
  try {
    const raw = localStorage.getItem(LS_PREFIX + slug);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsWrite(slug: string, value: AlbumLedger | null): void {
  try {
    if (value === null) localStorage.removeItem(LS_PREFIX + slug);
    else localStorage.setItem(LS_PREFIX + slug, JSON.stringify(value));
  } catch {
    /* hết dung lượng / chế độ riêng tư — mất chỗ cất, không được ném ra ngoài */
  }
}

/** Đọc sổ đã cất của album. Sai định dạng / khác phiên bản → `null`. */
export async function loadLedger(slug: string): Promise<AlbumLedger | null> {
  if (typeof window === "undefined") return null;

  if (idbOk !== false) {
    const db = await openDb();
    if (db) {
      const raw = await new Promise<unknown>((resolve) => {
        try {
          const req = db.transaction(STORE, "readonly").objectStore(STORE).get(slug);
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      db.close();
      const parsed = parseLedger(raw, slug);
      if (parsed) return parsed;
      // IndexedDB rỗng nhưng localStorage có thể còn bản của lần trước khi máy
      // này dùng được IndexedDB — vẫn ngó qua, đừng làm mất lựa chọn của khách.
    }
  }

  return parseLedger(lsRead(slug), slug);
}

/**
 * Cất sổ. Luôn ghi localStorage TRƯỚC rồi mới ghi IndexedDB: ghi localStorage là
 * đồng bộ, nên nếu khách đóng tab ngay sau khi bấm thì bản mới vẫn còn. Ghi hai
 * chỗ tốn thêm vài chục KB, đổi lại không có cửa sổ nào mất lựa chọn.
 */
export async function saveLedger(l: AlbumLedger): Promise<void> {
  if (typeof window === "undefined") return;
  lsWrite(l.slug, l);
  if (idbOk === false) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(l, l.slug);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Xoá sổ của một album (khách bấm "quên lựa chọn trên máy này"). */
export async function clearLedger(slug: string): Promise<void> {
  if (typeof window === "undefined") return;
  lsWrite(slug, null);
  if (idbOk === false) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(slug);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
