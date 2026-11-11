"use client";

/* Màn xem trước: album giao khách + GHÉP LAYOUT ẢNH đăng mạng xã hội.
   Dữ liệu giả, không mạng: API /api/album/<slug>/collage/* được giả lập NGAY
   TRONG TRÌNH DUYỆT (chỉ cho đúng slug của màn này), nhưng dùng thật bộ chia
   nhóm ảnh (categorize) và bộ kiểm dữ liệu máy chủ (sanitizeDoc) — lưu bộ
   layout sai luật là màn xem trước báo lỗi y như máy chủ thật.
   SĐT xác nhận thử: 0901 234 567. */

import GalleryViewV2 from "@/app/album/[slug]/GalleryViewV2";
import { AlbumImgProvider } from "@/app/a/[slug]/album-v2-ui";
import { categorize } from "@/lib/collage/categories";
import { sanitizeDoc } from "@/lib/collage/validate";
import { DEMO_IMG, G_BASE, G_PHOTOS } from "./khalbum-demo";

const SLUG = G_BASE.gallery.slug;

type MockSet = { id: string; title: string; data: unknown; updated_at: string; expires_at: string };

function buildData() {
  const photos = G_PHOTOS.filter((p) => !("is_video" in p && p.is_video)).map((p) => ({ id: p.id, d: p.drive_file_id, s: p.source_id }));
  const couple = ["p50", "p52", "p55", "p58", "p71", "p73", "p76", "p80", "p84"];
  const bride = ["p51", "p54", "p60", "p72", "p78"];
  const groom = ["p53", "p61", "p75"];
  const group = ["p59", "p63", "p74", "p79", "p81", "p83", "p85", "p87"];
  const faces: { photo_id: string; box: number[]; sharpness: number }[] = [];
  const links: { person_id: string; photo_id: string }[] = [];
  const add = (pid: string, person: string | null, x: number, w = 0.14, sharp = 120) => {
    faces.push({ photo_id: pid, box: [x, 0.18, w, w * 1.2], sharpness: sharp });
    if (person) links.push({ person_id: person, photo_id: pid });
  };
  couple.forEach((id, i) => {
    add(id, "A", 0.28, 0.13, 100 + i * 9);
    add(id, "B", 0.52, 0.13, 90 + i * 7);
  });
  bride.forEach((id, i) => add(id, "A", 0.4, 0.2, 140 + i * 11));
  groom.forEach((id, i) => add(id, "B", 0.42, 0.18, 120 + i * 5));
  group.forEach((id) => {
    add(id, "C", 0.1);
    add(id, "D", 0.3);
    add(id, null, 0.5);
    add(id, null, 0.7);
  });
  const res = categorize({
    photos: photos.map((p, i) => ({ id: p.id, source_id: p.s, position: i })),
    sources: [
      { id: "g1", name: "Bê quả · Lễ gia tiên" },
      { id: "g2", name: "Tiệc cưới" },
    ],
    faces,
    scanned: new Set(photos.map((p) => p.id)),
    people: [
      { id: "A", name: "Cô dâu" },
      { id: "B", name: "Chú rể" },
      { id: "C", name: "" },
      { id: "D", name: "" },
    ],
    links,
  });
  return { photos, ...res };
}

function installMock() {
  const w = window as Window & { __mstudoCollageMock?: boolean };
  if (w.__mstudoCollageMock) return;
  w.__mstudoCollageMock = true;
  const data = buildData();
  const allowed = new Set(data.photos.map((p) => p.id));
  const sets: MockSet[] = [];
  const real = window.fetch.bind(window);
  const base = `/api/album/${SLUG}/collage`;
  // ?mock=cham (máy chủ chậm 9 giây) | treo (không bao giờ trả lời) | 504 | tat
  // (album tắt ghép ảnh) — để xem màn ghép xử lý máy chủ chậm / lỗi ra sao.
  const mode = new URLSearchParams(window.location.search).get("mock");
  /** Chờ như mạng thật: bỏ dở được bằng AbortSignal (hết giờ phía máy khách). */
  const wait = (ms: number, signal?: AbortSignal | null) =>
    new Promise<void>((resolve, reject) => {
      const t = ms === Infinity ? undefined : setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(href, window.location.href);
    if (!u.pathname.startsWith(base)) return real(input, init);
    const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
    await wait(220, init?.signal);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (u.pathname === `${base}/verify`) {
      return String(body.phone ?? "").replace(/\D/g, "").endsWith("901234567") ? json({ ok: true, key: "demo-key" }) : json({ error: "wrong_phone" }, 403);
    }
    if (u.pathname === `${base}/photos`) {
      if (mode === "cham") await wait(9000, init?.signal);
      if (mode === "treo") await wait(Infinity, init?.signal);
      if (mode === "504") return new Response("An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT", { status: 504 });
      if (mode === "tat") return json({ error: "not_enabled" }, 403);
      return json(data);
    }
    if (u.pathname === base && method === "GET") return json({ sets: sets.filter((s) => new Date(s.expires_at).getTime() > Date.now()) });
    if (u.pathname === base && method === "DELETE") {
      const id = u.searchParams.get("id");
      const i = sets.findIndex((s) => s.id === id);
      if (i >= 0) sets.splice(i, 1);
      return json({ ok: true });
    }
    if (u.pathname === base && method === "POST") {
      const check = sanitizeDoc(body.doc, allowed);
      if (!check.ok) {
        console.error("[xem trước] máy chủ sẽ từ chối bộ layout:", check.error);
        return json({ error: check.error }, 400);
      }
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
      let row = sets.find((s) => s.id === body.id);
      if (!row) {
        row = { id: crypto.randomUUID(), title: "", data: null, updated_at: "", expires_at: "" };
        sets.unshift(row);
      }
      Object.assign(row, { title: String(body.title ?? ""), data: check.doc, updated_at: now.toISOString(), expires_at: expires });
      return json({ ok: true, id: row.id, updatedAt: row.updated_at, expiresAt: expires });
    }
    return json({ error: "not_found" }, 404);
  };
}

export function KhAlbumGhepAnhDemo() {
  if (typeof window !== "undefined") installMock();
  return (
    <AlbumImgProvider value={DEMO_IMG}>
      <GalleryViewV2 {...G_BASE} print={null} collage={{ coupleOnly: true }} />
    </AlbumImgProvider>
  );
}
