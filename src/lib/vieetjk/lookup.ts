import "server-only";
import { isDeliveryPhase } from "@/lib/album-phase";
import { createAdminClient } from "@/lib/supabase/admin";
import { mainUrl } from "@/lib/hosts";
import type { Lang } from "./content";

/**
 * Tra cứu trạng thái HỢP ĐỒNG / ALBUM cho chatbox vieetjk.
 *
 * Nguyên tắc bảo mật (chatbox là kênh CÔNG KHAI, ẩn danh):
 *  - CHỈ tra khi khách cung cấp đúng SỐ ĐIỆN THOẠI đã đăng ký trên hợp đồng
 *    (client_phone) — giống cổng khách /c/[token] và /album/[slug] dùng SĐT làm
 *    mật khẩu xem.
 *  - Mọi truy vấn được giới hạn trong phạm vi 1 studio (owner_id của vieetjk).
 *  - Chỉ trả về TRẠNG THÁI tối giản + ĐƯỜNG LINK; không trả tiền cọc, hạng mục,
 *    ghi chú nội bộ hay thông tin ê-kíp (những dữ liệu đó không được nạp ở đây).
 */

const onlyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Chuẩn hoá SĐT về "9 chữ số cuối" để so khớp bất kể mã nước (0.. / +84..). */
function last9(digits: string): string {
  let d = digits;
  if (d.startsWith("84")) d = "0" + d.slice(2);
  return d.slice(-9);
}

/** Hai SĐT được coi là cùng một số nếu 9 chữ số cuối trùng nhau. */
function samePhone(a: string, b: string): boolean {
  const x = last9(a);
  const y = last9(b);
  return x.length === 9 && x === y;
}

/**
 * Rút số điện thoại (đủ dài) từ tin nhắn khách. Trả về chuỗi CHỮ SỐ đã chuẩn hoá,
 * hoặc null nếu không thấy số hợp lệ. Yêu cầu 9–12 chữ số để tránh nhầm với năm,
 * số tiền hay số lượng ảnh.
 */
export function extractClientPhone(text: string): string | null {
  if (!text) return null;
  const groups = text.match(/\+?\d[\d\s.\-()]{6,}\d/g);
  if (!groups) return null;
  for (const g of groups) {
    const d = onlyDigits(g);
    if (d.length >= 9 && d.length <= 12) return d;
  }
  return null;
}

/**
 * Tin nhắn có phải đang hỏi về hợp đồng / trạng thái album không? Dùng từ khoá
 * ĐẶC TRƯNG để tránh dương tính giả (không dùng "anh"/"ảnh" trần vì quá phổ biến).
 */
export function looksLikeStatusQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  const kw = [
    "hợp đồng", "hop dong", "contract", " hđ ", "hđ ", " hđ", "mã hđ", "ma hd",
    "album", "gallery", "thư viện ảnh", "thu vien anh",
    "trạng thái", "trang thai", "status",
    "tình trạng", "tinh trang", "tình hình", "tinh hinh",
    "tiến độ", "tien do", "tiến trình", "tien trinh",
    "giao ảnh", "giao anh", "giao hình", "giao hinh", "nhận ảnh", "nhan anh",
    "lấy ảnh", "lay anh", "lấy hình", "lay hinh",
    "chọn ảnh", "chon anh", "link ảnh", "link anh", "link album",
    "xem ảnh", "xem anh", "xem hình", "xem hinh",
    "xong chưa", "xong chua", "tới đâu", "toi dau", "đến đâu", "den dau",
    "khi nào xong", "khi nao xong", "bao giờ xong", "bao gio xong",
    "khi nào có", "khi nao co", "bao giờ có", "bao gio co",
  ];
  return kw.some((k) => t.includes(k));
}

const CONTRACT_STATUS: Record<string, { vi: string; en: string }> = {
  draft: { vi: "đang soạn", en: "being drafted" },
  sent: { vi: "đã gửi, chờ khách ký", en: "sent, awaiting signature" },
  approved: { vi: "đã ký / đã duyệt", en: "signed / approved" },
  in_progress: { vi: "đang thực hiện", en: "in progress" },
  completed: { vi: "đã hoàn thành", en: "completed" },
  cancelled: { vi: "đã huỷ", en: "cancelled" },
};

function contractStatusLabel(status: string, lang: Lang): string {
  const m = CONTRACT_STATUS[status];
  return m ? (lang === "en" ? m.en : m.vi) : status;
}

function phaseLabel(phase: string, lang: Lang): string {
  if (phase === "delivery") {
    return lang === "en" ? "photos delivered (finished album)" : "đã giao ảnh (album hoàn thiện)";
  }
  return lang === "en" ? "photo selection open" : "đang ở bước chọn ảnh";
}

export type ContractStatusHit = {
  title: string;
  code: string | null;
  status: string;
  eventDate: string | null;
  contractUrl: string;
  galleryUrl: string | null;
};

export type GalleryStatusHit = {
  title: string;
  phase: string;
  url: string;
};

export type ClientStatusResult = {
  contracts: ContractStatusHit[];
  galleries: GalleryStatusHit[];
};

/**
 * Tra hợp đồng + album/thư viện đã giao khớp SĐT khách, trong phạm vi 1 studio.
 * Chỉ lấy các cột an toàn để dựng trạng thái + link.
 */
export async function lookupClientStatus(ownerId: string, phone: string): Promise<ClientStatusResult> {
  const db = createAdminClient();

  const [{ data: contractRows }, { data: albumRows }] = await Promise.all([
    db
      .from("studio_contracts")
      .select("id, code, title, status, event_date, client_phone, client_token, gallery_album_id")
      .eq("owner_id", ownerId)
      .not("client_phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("albums")
      .select("id, slug, title, phase, is_gallery, client_phone")
      .eq("owner_id", ownerId)
      .eq("status", "published")
      .or("is_gallery.eq.true,phase.eq.delivery")
      .not("client_phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const contracts = ((contractRows ?? []) as Array<Record<string, unknown>>).filter((c) =>
    samePhone(phone, String(c.client_phone ?? ""))
  );
  const albums = ((albumRows ?? []) as Array<Record<string, unknown>>).filter((a) =>
    samePhone(phone, String(a.client_phone ?? ""))
  );

  // Album đã giao gắn với hợp đồng → dùng để deep-link ngay trong dòng hợp đồng
  // và không liệt kê lại ở mục thư viện.
  const albumById = new Map<string, Record<string, unknown>>();
  for (const a of albums) albumById.set(String(a.id), a);

  const usedAlbumIds = new Set<string>();
  const contractHits: ContractStatusHit[] = [];
  for (const c of contracts) {
    const token = String(c.client_token ?? "");
    if (!token) continue;
    let galleryUrl: string | null = null;
    const gid = c.gallery_album_id ? String(c.gallery_album_id) : null;
    if (gid && albumById.has(gid)) {
      const al = albumById.get(gid)!;
      // `phase` thắng cờ cũ `is_gallery`: album đã được đưa về giai đoạn chọn
      // ảnh thì đừng gửi khách link giao khách nữa (xem @/lib/album-phase).
      if (isDeliveryPhase(al as { phase?: string | null; is_gallery?: boolean | null })) {
        galleryUrl = mainUrl(`/album/${String(al.slug)}`);
        usedAlbumIds.add(gid);
      }
    }
    contractHits.push({
      title: String(c.title ?? "Hợp đồng"),
      code: c.code ? String(c.code) : null,
      status: String(c.status ?? ""),
      eventDate: c.event_date ? String(c.event_date) : null,
      contractUrl: mainUrl(`/c/${token}`),
      galleryUrl,
    });
  }

  const galleryHits: GalleryStatusHit[] = [];
  for (const a of albums) {
    if (usedAlbumIds.has(String(a.id))) continue;
    galleryHits.push({
      title: String(a.title ?? ""),
      phase: String(a.phase ?? "delivery"),
      url: mainUrl(`/album/${String(a.slug)}`),
    });
  }

  return { contracts: contractHits, galleries: galleryHits };
}

/** Khối ngữ cảnh: khách hỏi trạng thái nhưng CHƯA cung cấp SĐT → yêu cầu SĐT. */
export function statusNeedsPhoneContext(lang: Lang): string {
  if (lang === "en") {
    return `## Contract / album lookup
The customer is asking about their contract or album status but has NOT provided a phone number. Politely ask for the PHONE NUMBER registered on their contract so you can look it up. For privacy, a lookup is only possible with the correct phone number — never guess or invent any status.`;
  }
  return `## Tra cứu hợp đồng / album
Khách đang hỏi về hợp đồng hoặc tình trạng album nhưng CHƯA cung cấp số điện thoại. Hãy lịch sự đề nghị khách cho biết SỐ ĐIỆN THOẠI đã đăng ký trên hợp đồng để tra cứu. Vì lý do bảo mật, chỉ tra được khi có đúng SĐT — TUYỆT ĐỐI không suy đoán hay bịa trạng thái.`;
}

/** Khối ngữ cảnh: đã tra bằng SĐT → hướng dẫn bot trả lời với dữ liệu tìm được. */
export function buildStatusContext(lang: Lang, result: ClientStatusResult): string {
  const has = result.contracts.length > 0 || result.galleries.length > 0;
  if (!has) {
    if (lang === "en") {
      return `## Contract / album lookup
No contract or album matched the phone number the customer just gave. Gently ask them to double-check the exact phone number registered when they signed the contract, or to leave their number / call the studio for help. Do NOT invent any status.`;
    }
    return `## Tra cứu hợp đồng / album
Không tìm thấy hợp đồng hay album nào khớp với số điện thoại khách vừa cung cấp. Hãy nhẹ nhàng đề nghị khách kiểm tra lại đúng SĐT đã dùng khi ký hợp đồng, hoặc để lại SĐT / gọi studio để được hỗ trợ. TUYỆT ĐỐI không bịa trạng thái.`;
  }

  const lines: string[] = [];
  if (lang === "en") {
    lines.push(`## Contract / album lookup (verified by phone)`);
    lines.push(
      `The customer gave a phone number that matches the records below. Rules:\n` +
        `- By DEFAULT reply with only the NAME + STATUS. Do NOT paste any link yet.\n` +
        `- Send a link ONLY when the customer explicitly asks for it (e.g. "send me the contract link", "photo link") — then give the matching link below.\n` +
        `- You MAY proactively offer, e.g. "Would you like the link to view your photos?" and send it if they say yes.\n` +
        `- NEVER reveal or guess deposits, line items, internal notes, crew or any other detail. The linked pages still ask for the phone as the password.`
    );
    if (result.contracts.length) {
      lines.push(`\nContracts:`);
      for (const c of result.contracts) {
        const parts = [`"${c.title}"${c.code ? ` (${c.code})` : ""}`, `status: ${contractStatusLabel(c.status, lang)}`];
        if (c.eventDate) parts.push(`shoot date: ${c.eventDate}`);
        parts.push(`view contract: ${c.contractUrl}`);
        if (c.galleryUrl) parts.push(`photos: ${c.galleryUrl}`);
        lines.push(`- ${parts.join(" — ")}`);
      }
    }
    if (result.galleries.length) {
      lines.push(`\nAlbums / galleries:`);
      for (const g of result.galleries) {
        lines.push(`- "${g.title}" — ${phaseLabel(g.phase, lang)} — link: ${g.url}`);
      }
    }
    return lines.join("\n");
  }

  lines.push(`## Tra cứu hợp đồng / album (đã xác thực bằng SĐT)`);
  lines.push(
    `Khách vừa cung cấp SĐT khớp với các hồ sơ dưới đây. Quy tắc trả lời:\n` +
      `- MẶC ĐỊNH chỉ báo TÊN + TRẠNG THÁI. CHƯA gửi đường link.\n` +
      `- CHỈ gửi link khi khách chủ động hỏi xin (vd "cho xin link hợp đồng", "link xem ảnh", "gửi link ảnh") — khi đó mới đưa link tương ứng bên dưới.\n` +
      `- Có thể CHỦ ĐỘNG hỏi, vd "Anh/chị có cần link xem ảnh không ạ?" và gửi link nếu khách đồng ý.\n` +
      `- TUYỆT ĐỐI không tiết lộ hay suy đoán tiền cọc, hạng mục, ghi chú nội bộ, ê-kíp hay bất kỳ chi tiết nào khác. Trang mở qua link vẫn hỏi SĐT làm mật khẩu.`
  );
  if (result.contracts.length) {
    lines.push(`\nHợp đồng:`);
    for (const c of result.contracts) {
      const parts = [`"${c.title}"${c.code ? ` (${c.code})` : ""}`, `trạng thái: ${contractStatusLabel(c.status, lang)}`];
      if (c.eventDate) parts.push(`ngày chụp: ${c.eventDate}`);
      parts.push(`xem hợp đồng: ${c.contractUrl}`);
      if (c.galleryUrl) parts.push(`ảnh: ${c.galleryUrl}`);
      lines.push(`- ${parts.join(" — ")}`);
    }
  }
  if (result.galleries.length) {
    lines.push(`\nAlbum / thư viện ảnh:`);
    for (const g of result.galleries) {
      lines.push(`- "${g.title}" — ${phaseLabel(g.phase, lang)} — link: ${g.url}`);
    }
  }
  return lines.join("\n");
}

/** Khách tra quá nhiều lần (chống dò SĐT) → mời liên hệ trực tiếp studio. */
export function statusRateLimitedContext(lang: Lang): string {
  if (lang === "en") {
    return `## Contract / album lookup
The customer has made too many lookups in a short time. Politely ask them to try again in a moment, or to contact the studio directly by phone/Zalo for help. Do NOT reveal any status now.`;
  }
  return `## Tra cứu hợp đồng / album
Khách tra cứu quá nhiều lần trong thời gian ngắn. Hãy lịch sự mời khách thử lại sau ít phút, hoặc liên hệ trực tiếp studio qua điện thoại/Zalo để được hỗ trợ. TUYỆT ĐỐI không trả trạng thái lúc này.`;
}
