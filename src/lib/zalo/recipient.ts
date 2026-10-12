/**
 * "Nhớ người nhận Zalo" — phần logic THUẦN (không import gì của app) để test
 * được bằng node trần (desktop/test/zalo-recipient.mjs).
 *
 * Vì sao cần nhớ: nhiều khách tắt "cho phép tìm bằng SĐT" hoặc SĐT trên hợp
 * đồng không phải số đăng ký Zalo, nên "Gửi Zalo" theo SĐT báo không tìm thấy.
 * Studio phải mở danh sách bạn, tìm tên, bấm chọn — MỖI LẦN gửi. Lưu lại người
 * đã chọn lên hợp đồng/album (studio_contracts / albums: zalo_uid, zalo_name,
 * zalo_self) thì lần sau một cú bấm là tới đúng người.
 *
 * `zalo_self` = id tài khoản Zalo của studio lúc lưu. uid của một người khác
 * nhau theo từng tài khoản Zalo đi gửi (Zalo cấp uid theo cặp), nên studio đổi
 * sang số Zalo khác thì uid cũ VÔ NGHĨA — chỉ dùng khi khớp tài khoản hiện tại.
 */

export interface SavedZalo {
  zalo_uid?: string | null;
  zalo_name?: string | null;
  zalo_self?: string | null;
}

/** Một hợp đồng khác của cùng studio (để mượn người đã chọn theo SĐT khách). */
export interface SiblingZalo extends SavedZalo {
  client_phone?: string | null;
  updated_at?: string | null;
}

export type RecipientSource = "explicit" | "saved" | "sibling" | "phone";

export interface ResolvedRecipient {
  uid: string | null;
  name: string | null;
  source: RecipientSource;
}

/** Chuẩn hoá SĐT để so khớp: chỉ giữ chữ số, "0…" / "84…" / "+84…" về cùng dạng "84…". */
export function normalizePhone(phone: string | null | undefined): string {
  let d = (phone || "").replace(/[^\d]/g, "");
  if (d.startsWith("0")) d = "84" + d.slice(1);
  return d;
}

/** Người đã lưu còn dùng được với tài khoản Zalo hiện tại không. */
export function usableSaved(s: SavedZalo | null | undefined, selfId: string | null | undefined): boolean {
  return !!(s && s.zalo_uid && selfId && s.zalo_self === selfId);
}

/**
 * Chọn người nhận cho tin gửi KHÁCH, theo thứ tự:
 *   1. uid studio vừa chọn tay (toUid)
 *   2. uid đã lưu trên chính hợp đồng/album (`own` — theo thứ tự ưu tiên), khớp tài khoản Zalo hiện tại
 *   3. uid đã lưu trên hợp đồng KHÁC cùng SĐT khách (mới sửa gần nhất trước)
 *   4. để trống uid → tra theo SĐT như cũ
 */
export function resolveRecipient(opts: {
  toUid?: string | null;
  toName?: string | null;
  selfId?: string | null;
  own?: Array<SavedZalo | null | undefined>;
  siblings?: SiblingZalo[];
  phone?: string | null;
}): ResolvedRecipient {
  const toUid = (opts.toUid || "").trim();
  if (toUid) return { uid: toUid, name: opts.toName ?? null, source: "explicit" };

  for (const s of opts.own ?? []) {
    if (usableSaved(s, opts.selfId)) {
      return { uid: s!.zalo_uid!, name: s!.zalo_name ?? opts.toName ?? null, source: "saved" };
    }
  }

  const sib = pickSibling(opts.siblings ?? [], opts.phone, opts.selfId);
  if (sib) return { uid: sib.zalo_uid!, name: sib.zalo_name ?? opts.toName ?? null, source: "sibling" };

  return { uid: null, name: opts.toName ?? null, source: "phone" };
}

/** Hợp đồng khác cùng SĐT, có người đã lưu khớp tài khoản hiện tại, mới sửa gần nhất. */
export function pickSibling(
  rows: SiblingZalo[],
  phone: string | null | undefined,
  selfId: string | null | undefined
): SiblingZalo | null {
  const norm = normalizePhone(phone);
  // SĐT quá ngắn (nhập dở) thì không mượn — dễ khớp nhầm người.
  if (norm.length < 9) return null;
  const hits = rows.filter((r) => usableSaved(r, selfId) && normalizePhone(r.client_phone) === norm);
  if (!hits.length) return null;
  return hits.reduce((a, b) => ((b.updated_at || "") > (a.updated_at || "") ? b : a));
}

/**
 * Lỗi gửi do NGƯỜI NHẬN (uid cũ không còn hợp lệ, bị chặn, không còn là bạn…)
 * chứ không phải do phiên/mạng. Chỉ lỗi loại này mới được xoá người đã lưu rồi
 * thử lại theo SĐT — lỗi mạng mà xoá thì studio mất công chọn lại vô cớ.
 */
export function isRecipientError(err: string | null | undefined): boolean {
  const e = (err || "").toLowerCase();
  if (!e) return false;
  if (/timeout|network|fetch failed|econn|socket|login|session|zca_js|not_connected|personal_needs_body/.test(e)) {
    return false;
  }
  return /recipient|not.?found|not.?exist|tồn tại|invalid|không hợp lệ|block|chặn|stranger|người lạ|friend|bạn bè|privacy|riêng tư|uid|user/.test(e);
}

/**
 * Có cần ghi lại người nhận lên hợp đồng/album sau khi gửi thành công không.
 * Chỉ ghi người studio CHỌN TAY (hoặc mượn từ hợp đồng cùng SĐT — vốn cũng là
 * người đã chọn tay), không ghi uid tra ra từ SĐT: SĐT trên hợp đồng sửa được,
 * ghi uid theo số cũ thì sau khi sửa số tin vẫn đi tới người cũ.
 * Bỏ qua khi đã lưu đúng như vậy rồi (tránh ghi thừa — mỗi lần ghi đẩy updated_at).
 */
export function shouldSave(
  source: RecipientSource,
  current: SavedZalo | null | undefined,
  next: { uid: string; name: string | null; selfId: string }
): boolean {
  if (source !== "explicit" && source !== "sibling" && source !== "saved") return false;
  return !(
    current &&
    current.zalo_uid === next.uid &&
    current.zalo_self === next.selfId &&
    (current.zalo_name ?? null) === (next.name ?? null)
  );
}
