/**
 * SỔ LỰA CHỌN NGOẠI TUYẾN của album khách (/a/[slug]).
 *
 * Vì sao cần. Khách chọn ảnh gần như 100% trên điện thoại, ngồi lâu, mạng chập
 * chờn. Trước đây mỗi lần bấm là một `POST /api/a/[slug]/select`: mạng rớt thì
 * lượt bấm đó bay mất, và khách không hề biết — trang không hiện gì cả
 * (`saveStatus` được đặt nhưng chưa bao giờ được vẽ ra). Giờ mọi lượt bấm ghi
 * xuống MÁY trước, mạng chỉ là bước đồng bộ sau.
 *
 * Vì sao phải hoà giải ba bên. Một album chỉ có MỘT lựa chọn dùng chung
 * (`sessionId = "shared"`, xem route select) vì link album là của một khách —
 * nhưng cả nhà cùng mở một link trên hai ba điện thoại là chuyện thường. Nếu
 * "bản trên máy luôn thắng" thì máy nào lưu sau sẽ xoá sạch lựa chọn của người
 * kia. Nên sổ giữ thêm `base` — bản mà máy này và máy chủ ĐÃ TỪNG khớp nhau —
 * và hoà giải theo TỪNG ẢNH: ảnh nào máy này vừa đổi thì lấy máy này, ảnh nào
 * máy này không chạm tới thì lấy máy chủ (tức lấy của người kia).
 *
 * File này KHÔNG chạm vào IndexedDB/localStorage và không gọi mạng — chỗ lưu
 * nằm ở `@/lib/album-store`, để luật hoà giải kiểm thử được bằng node
 * (`npm run test:album-offline`).
 */

/** Lựa chọn của khách trong một album: ảnh thích · ảnh không thích · ghi chú. */
export type AlbumPicks = {
  selected: string[];
  disliked: string[];
  notes: Record<string, string>;
};

/** Trạng thái của MỘT ảnh. Ba trạng thái loại trừ nhau (xem @/lib/album-dislike). */
export type PickState = "selected" | "disliked" | "none";

/**
 * Sổ lưu trên máy. `base` là bản đã khớp với máy chủ lần gần nhất; `picks` là
 * bản khách đang thấy trên máy này.
 *
 * `editedAt > syncedAt` ⇒ còn thay đổi CHƯA lên máy chủ. Hai mốc thời gian
 * (thay vì một cờ `dirty`) là để lượt lưu đang bay không đóng dấu "đã đồng bộ"
 * lên thay đổi khách vừa bấm giữa lúc đó — xem `markSynced`.
 */
export type AlbumLedger = {
  /** Số phiên bản định dạng: đổi hình dữ liệu thì tăng lên, bản cũ bị bỏ. */
  v: 1;
  slug: string;
  picks: AlbumPicks;
  base: AlbumPicks;
  /** Mốc (ms) lần cuối khách chạm vào lựa chọn trên máy này. */
  editedAt: number;
  /** Mốc (ms) của bản `picks` gần nhất mà máy chủ đã nhận đủ. 0 = chưa lần nào. */
  syncedAt: number;
};

export const LEDGER_VERSION = 1 as const;

export const EMPTY_PICKS: AlbumPicks = { selected: [], disliked: [], notes: {} };

/* ─────────────────────────────────────────────────────────────────────────────
   Hàm dựng & chuẩn hoá
   ───────────────────────────────────────────────────────────────────────────── */

/** Bản sao sạch của một bộ lựa chọn: bỏ id trùng, bỏ ghi chú rỗng, ảnh không thích thắng. */
export function normalizePicks(p: Partial<AlbumPicks> | null | undefined): AlbumPicks {
  const disliked = dedup(p?.disliked ?? []);
  const dis = new Set(disliked);
  // "Đã chọn" và "không thích" loại trừ nhau — chốt lại ở đây để mọi bản trong
  // sổ đều hợp lệ, kể cả bản đọc lên từ máy chủ hay từ ổ đĩa của bản cũ.
  const selected = dedup(p?.selected ?? []).filter((id) => !dis.has(id));
  const notes: Record<string, string> = {};
  const keep = new Set([...selected, ...disliked]);
  for (const [id, text] of Object.entries(p?.notes ?? {})) {
    const t = (text ?? "").trim();
    // Ghi chú chỉ có nghĩa khi gắn với một ảnh khách đã đánh dấu: route lưu cũng
    // chỉ ghi `client_note` trên hàng selections/dislikes, nên ghi chú mồ côi
    // sẽ biến mất sau vòng đồng bộ đầu — đừng để nó làm sổ báo "còn thay đổi".
    if (t && keep.has(id)) notes[id] = t;
  }
  return { selected, disliked, notes };
}

/** Sổ mới cho một album, coi như đã khớp máy chủ tại `now`. */
export function newLedger(slug: string, picks: Partial<AlbumPicks>, now: number): AlbumLedger {
  const clean = normalizePicks(picks);
  return { v: LEDGER_VERSION, slug, picks: clean, base: clean, editedAt: now, syncedAt: now };
}

/**
 * Đọc lại sổ từ ổ đĩa. Trả `null` khi bản lưu sai định dạng / khác album / khác
 * phiên bản — gọi bên ngoài sẽ dựng sổ mới từ dữ liệu máy chủ thay vì cố vá.
 */
export function parseLedger(raw: unknown, slug: string): AlbumLedger | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AlbumLedger>;
  if (r.v !== LEDGER_VERSION || r.slug !== slug) return null;
  if (!r.picks || typeof r.picks !== "object") return null;
  const editedAt = Number(r.editedAt) || 0;
  const syncedAt = Number(r.syncedAt) || 0;
  return {
    v: LEDGER_VERSION,
    slug,
    picks: normalizePicks(r.picks),
    base: normalizePicks(r.base ?? r.picks),
    editedAt,
    syncedAt,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Trạng thái đồng bộ
   ───────────────────────────────────────────────────────────────────────────── */

/** Còn thay đổi chưa lên máy chủ? */
export function isPending(l: AlbumLedger): boolean {
  return l.editedAt > l.syncedAt;
}

/** Khách vừa bấm: ghi bản mới xuống sổ, mốc `editedAt` nhảy lên. */
export function applyEdit(l: AlbumLedger, picks: Partial<AlbumPicks>, now: number): AlbumLedger {
  // `now` phải THỰC SỰ lớn hơn syncedAt, nếu không lượt bấm này bị coi là đã
  // đồng bộ. Đồng hồ máy chỉ có độ phân giải ms nên hai lượt bấm trong cùng một
  // ms là có thật.
  const editedAt = Math.max(now, l.syncedAt + 1, l.editedAt);
  return { ...l, picks: normalizePicks(picks), editedAt };
}

/**
 * Máy chủ đã nhận xong bản có mốc `sentEditedAt`.
 *
 * Truyền vào mốc CHỤP LÚC GỬI, không phải `Date.now()`: khách bấm thêm trong
 * lúc request đang bay thì `editedAt` đã nhảy lên, và sổ phải còn báo "chờ
 * mạng" cho lượt bấm đó. Đóng dấu bằng thời điểm hiện tại sẽ đánh mất nó.
 */
export function markSynced(l: AlbumLedger, sentEditedAt: number, sentPicks: AlbumPicks): AlbumLedger {
  if (sentEditedAt <= l.syncedAt) return l; // phản hồi cũ về muộn — bỏ qua
  return { ...l, base: normalizePicks(sentPicks), syncedAt: sentEditedAt };
}

/** Số ảnh (và ghi chú) đang khác nhau giữa bản trên máy và bản máy chủ đã nhận. */
export function pendingCount(l: AlbumLedger): number {
  if (!isPending(l)) return 0;
  return diffCount(l.base, l.picks);
}

/** Số ảnh/ghi chú khác nhau giữa hai bộ lựa chọn. */
export function diffCount(a: AlbumPicks, b: AlbumPicks): number {
  const A = index(a);
  const B = index(b);
  let n = 0;
  for (const id of unionIds(a, b)) {
    if (A.state.get(id) !== B.state.get(id)) n++;
    else if ((A.notes.get(id) ?? "") !== (B.notes.get(id) ?? "")) n++;
  }
  return n;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Hoà giải với máy chủ
   ───────────────────────────────────────────────────────────────────────────── */

export type MergeOutcome = {
  picks: AlbumPicks;
  /** Bản mới của sổ, đã cập nhật `base`/`syncedAt` theo kết quả hoà giải. */
  ledger: AlbumLedger;
  /**
   * `remote`: lấy nguyên bản máy chủ (máy này không có gì chờ).
   * `local`: giữ nguyên bản trên máy (máy chủ không đổi gì so với `base`).
   * `merged`: cả hai bên đều đổi — trộn theo từng ảnh.
   */
  how: "remote" | "local" | "merged";
  /** Còn phải gửi lên máy chủ sau khi hoà giải? */
  needsPush: boolean;
};

/**
 * Gộp bản máy chủ vừa đọc được vào sổ trên máy.
 *
 * Luật, theo đúng thứ tự:
 *  1. Máy này không còn thay đổi nào chờ ⇒ tin máy chủ hoàn toàn. Đây là lối đi
 *     thường ngày (mở lại album trên máy khác, hoặc vòng poll 20 giây).
 *  2. Máy này còn thay đổi chờ, mà máy chủ vẫn đúng bằng `base` ⇒ chưa ai khác
 *     chạm vào, giữ nguyên bản trên máy và đẩy lên.
 *  3. Cả hai bên đều đổi ⇒ trộn theo TỪNG ẢNH: ảnh máy này vừa đổi thì lấy máy
 *     này, còn lại lấy máy chủ. Đây là điều cứu lựa chọn của người mở cùng link
 *     trên điện thoại khác khỏi bị xoá.
 */
export function mergeFromServer(
  l: AlbumLedger | null,
  remoteRaw: Partial<AlbumPicks>,
  slug: string,
  now: number
): MergeOutcome {
  const remote = normalizePicks(remoteRaw);

  if (!l) {
    const ledger = newLedger(slug, remote, now);
    return { picks: ledger.picks, ledger, how: "remote", needsPush: false };
  }

  if (!isPending(l)) {
    const ledger: AlbumLedger = { ...l, picks: remote, base: remote, editedAt: now, syncedAt: now };
    return { picks: remote, ledger, how: "remote", needsPush: false };
  }

  if (diffCount(l.base, remote) === 0) {
    // Máy chủ chưa nhận bản mới của máy này, nhưng cũng không có gì lạ ở đó.
    return { picks: l.picks, ledger: l, how: "local", needsPush: true };
  }

  const picks = mergePicks(l.base, l.picks, remote);
  // `base` thành bản máy chủ: những gì của người kia coi như đã biết, để vòng
  // hoà giải sau chỉ còn phải xử lý thay đổi mới.
  const ledger: AlbumLedger = { ...l, picks, base: remote, editedAt: Math.max(now, l.syncedAt + 1) };
  return { picks, ledger, how: "merged", needsPush: true };
}

/**
 * Trộn ba bên theo từng ảnh: `base` là mốc chung, `local` là bản trên máy,
 * `remote` là bản máy chủ. Ảnh nào `local` khác `base` thì ý muốn của khách
 * trên máy này là mới hơn → lấy `local`; còn lại → lấy `remote`.
 */
export function mergePicks(base: AlbumPicks, local: AlbumPicks, remote: AlbumPicks): AlbumPicks {
  const B = index(base);
  const L = index(local);
  const R = index(remote);

  const selected: string[] = [];
  const disliked: string[] = [];
  const notes: Record<string, string> = {};

  for (const id of unionIds(local, remote, base)) {
    const lState = L.state.get(id) ?? "none";
    const bState = B.state.get(id) ?? "none";
    const state = lState !== bState ? lState : R.state.get(id) ?? "none";
    if (state === "selected") selected.push(id);
    else if (state === "disliked") disliked.push(id);

    const lNote = L.notes.get(id) ?? "";
    const bNote = B.notes.get(id) ?? "";
    const note = lNote !== bNote ? lNote : R.notes.get(id) ?? "";
    if (note && state !== "none") notes[id] = note;
  }

  return { selected, disliked, notes };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Nhãn cho khách
   ───────────────────────────────────────────────────────────────────────────── */

/** Việc đang xảy ra ở lượt lưu hiện tại — do component báo xuống. */
export type SaveActivity = "idle" | "saving" | "failed";

export type SyncBadge = {
  /** `ok` xanh · `busy` trung tính · `wait` vàng (chờ mạng). */
  tone: "ok" | "busy" | "wait";
  text: string;
  /** Trợ năng / rê chuột: giải thích dài hơn một dòng. */
  detail: string;
};

/**
 * Viên trạng thái hiện cho khách. Không bao giờ nói dối theo hai chiều:
 *  - còn thay đổi chờ ⇒ KHÔNG được hiện "đã lưu" (dù `fetch` vừa trả 200 cho
 *    bản cũ hơn);
 *  - đã đồng bộ hết ⇒ KHÔNG được hiện "chờ mạng" chỉ vì trình duyệt báo offline.
 */
export function syncBadge(l: AlbumLedger | null, activity: SaveActivity, online: boolean): SyncBadge {
  const n = l ? pendingCount(l) : 0;
  const pending = !!l && isPending(l);

  if (!pending) {
    return activity === "saving"
      ? { tone: "busy", text: "Đang lưu…", detail: "Đang gửi lựa chọn lên studio." }
      : { tone: "ok", text: "Đã lưu", detail: "Studio đã nhận đủ lựa chọn của bạn." };
  }

  const changes = n > 0 ? ` · ${n} thay đổi` : "";
  if (activity === "saving") {
    return { tone: "busy", text: "Đang lưu…", detail: `Đang gửi lên studio${changes}.` };
  }
  if (!online) {
    return {
      tone: "wait",
      text: `Chờ mạng${changes}`,
      detail: "Lựa chọn đã lưu trên máy bạn. Có mạng là tự gửi lên studio, không cần chọn lại.",
    };
  }
  return {
    tone: "wait",
    text: `Chờ gửi${changes}`,
    detail: "Lựa chọn đã lưu trên máy bạn, đang thử gửi lại lên studio.",
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Nội bộ
   ───────────────────────────────────────────────────────────────────────────── */

function dedup(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function index(p: AlbumPicks): { state: Map<string, PickState>; notes: Map<string, string> } {
  const state = new Map<string, PickState>();
  for (const id of p.selected) state.set(id, "selected");
  for (const id of p.disliked) state.set(id, "disliked");
  const notes = new Map<string, string>();
  for (const [id, t] of Object.entries(p.notes)) if (t) notes.set(id, t);
  return { state, notes };
}

/**
 * Tất cả id có mặt ở các bộ lựa chọn, theo thứ tự ổn định (bộ đầu trước) — để
 * kết quả trộn không phụ thuộc thứ tự bảng băm, và kiểm thử so được chuỗi JSON.
 */
function unionIds(...sets: AlbumPicks[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of sets) {
    for (const id of [...p.selected, ...p.disliked, ...Object.keys(p.notes)]) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
