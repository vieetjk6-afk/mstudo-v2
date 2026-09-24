/**
 * Tự xác nhận chuyển khoản: phần THUẦN (không DB, không React).
 *
 * SePay đọc biến động số dư của tài khoản studio rồi POST từng giao dịch về
 * /api/bank/sepay. File này làm ba việc, đều test được không cần mạng:
 *
 *   1. đọc payload SePay thành một dạng chung (parseSepay),
 *   2. dò trong nội dung chuyển khoản các MÃ ĐỢT (MSxxxxxxxx) và mã cọc giữ ngày
 *      (COC-xxxx),
 *   3. so số tiền nhận được với số tiền của đợt để biết khớp, dư hay thiếu.
 *
 * Nội dung chuyển khoản trên sao kê bị ngân hàng "nắn" đủ kiểu: viết hoa, bỏ
 * dấu, xoá dấu gạch, dán thêm tiền tố như "MBVCB.3278907687.", có khi cắt dòng.
 * Nên trước khi dò mã, nội dung được quy về chỉ còn A–Z và 0–9, rồi mới tìm.
 * Mã đủ dài và ngẫu nhiên để khả năng khớp nhầm gần như bằng 0.
 */

/** Bỏ 0/O, 1/I/L: khách có lúc phải gõ tay mã vào app ngân hàng. Trùng gen_pay_code() trong SQL. */
export const PAY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PAY_CODE_PREFIX = "MS";
export const PAY_CODE_LENGTH = 8;

/** Mã đợt mới, cùng dạng với default của cột contract_payment_plan.pay_code. */
export function newPayCode(): string {
  let out = PAY_CODE_PREFIX;
  for (let i = 0; i < PAY_CODE_LENGTH; i++) {
    out += PAY_CODE_ALPHABET[Math.floor(Math.random() * PAY_CODE_ALPHABET.length)];
  }
  return out;
}

/** Khoá webhook: dài, ngẫu nhiên, chỉ chữ và số để dán vào ô API Key của SePay không vướng gì. */
export function newHookSecret(): string {
  const a = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
  const b = globalThis.crypto?.randomUUID?.() ?? `${Math.random()}${Date.now()}`;
  return `msk${a}${b}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 48);
}

/** "Chuyển tiền cọc – MSAB23…" → "CHUYENTIENCOCMSAB23…": bỏ dấu, viết hoa, chỉ giữ A–Z/0–9. */
export function normalizeMemo(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const PAY_CODE_BODY = new RegExp(`^[${PAY_CODE_ALPHABET}]{${PAY_CODE_LENGTH}}$`);

/**
 * Mọi mã đợt CÓ THỂ nằm trong nội dung. Xét mọi chỗ có chữ "MS" chứ không chỉ
 * chỗ đầu tiên: nội dung bị nối liền nên "…MSMSAB23CD45…" hay tên khách có chữ
 * MS đứng trước mã đều không được làm lạc mã thật. Mã nào có thật thì DB trả lời.
 */
export function payCodeCandidates(text: string | null | undefined): string[] {
  const s = normalizeMemo(text);
  const out = new Set<string>();
  let i = s.indexOf(PAY_CODE_PREFIX);
  while (i !== -1) {
    const body = s.slice(i + PAY_CODE_PREFIX.length, i + PAY_CODE_PREFIX.length + PAY_CODE_LENGTH);
    if (PAY_CODE_BODY.test(body)) out.add(PAY_CODE_PREFIX + body);
    i = s.indexOf(PAY_CODE_PREFIX, i + 1);
  }
  return [...out];
}

/**
 * Mã cọc giữ ngày ("COC-7F3A", xem booking-deposit.ts). Ngân hàng hay xoá dấu
 * gạch nên nhận cả "COC7F3A", "COC 7F3A", rồi trả về đúng dạng đang lưu trong DB.
 *
 * Khác mã đợt, mã này chỉ có 4 ký tự và chữ "cọc" thì khách viết suốt ("tien coc
 * dam cuoi"), nên KHÔNG dò trên chuỗi đã nối liền mà bắt buộc mã đứng thành một
 * cụm riêng. Luôn tra kèm owner_id: mã chỉ cần duy nhất trong một studio.
 */
export function depositCodeCandidates(text: string | null | undefined): string[] {
  const s = (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase();
  const out = new Set<string>();
  const re = new RegExp(`(?:^|[^A-Z0-9])COC[-_. ]?([${PAY_CODE_ALPHABET}]{4})(?![A-Z0-9])`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.add(`COC-${m[1]}`);
    re.lastIndex = m.index + 1;
  }
  return [...out];
}

export type BankTxn = {
  /** Mã giao dịch phía SePay: khoá chống ghi hai lần khi SePay gửi lại. */
  txnId: string;
  amount: number;
  direction: "in" | "out";
  content: string;
  accountNumber: string | null;
  gateway: string | null;
  referenceCode: string | null;
  /** ISO, đã quy từ giờ Việt Nam (SePay gửi "2026-09-24 14:02:37" không kèm múi giờ). */
  txnAt: string | null;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** "2026-09-24 14:02:37" (giờ VN) → ISO UTC. Sai dạng thì null, không đoán. */
export function vnTimeToIso(s: string | null): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const ms = Date.UTC(+y, +mo - 1, +d, +h - 7, +mi, +(se || 0));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Payload webhook của SePay → BankTxn. Trả null nếu thiếu thứ bắt buộc (mã giao
 * dịch, số tiền). Đọc mềm: số tiền đến dạng chuỗi cũng nhận, vì đây là dữ liệu
 * từ bên ngoài, không phải kiểu TypeScript mình kiểm soát.
 *
 * Mẫu SePay gửi:
 *   { id, gateway, transactionDate, accountNumber, code, content, transferType,
 *     transferAmount, accumulated, subAccount, referenceCode, description }
 */
export function parseSepay(body: unknown): BankTxn | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const txnId = str(b.id);
  const amount = Math.round(Number(b.transferAmount));
  if (!txnId || !Number.isFinite(amount) || amount <= 0) return null;
  // "code" là mã thanh toán SePay tự nhận ra (nếu studio có cấu hình), còn
  // "description" có khi chứa cả nội dung gốc. Gộp cả ba để không sót mã.
  const content = [str(b.content), str(b.code), str(b.description)].filter(Boolean).join(" ");
  return {
    txnId,
    amount,
    direction: String(b.transferType || "").toLowerCase() === "out" ? "out" : "in",
    content: content.slice(0, 500),
    accountNumber: str(b.accountNumber),
    gateway: str(b.gateway),
    referenceCode: str(b.referenceCode),
    txnAt: vnTimeToIso(str(b.transactionDate)),
  };
}

/**
 * Lấy khoá từ header Authorization. SePay gửi "Apikey <khoá>"; nhận thêm
 * "Bearer <khoá>" và khoá trần cho ai tự cấu hình bằng công cụ khác.
 */
export function hookSecretFromHeader(h: string | null | undefined): string | null {
  const v = (h || "").trim();
  if (!v) return null;
  const m = /^(?:apikey|bearer)\s+(.+)$/i.exec(v);
  const key = (m ? m[1] : v).trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(key) ? key : null;
}

export type AmountFit = "exact" | "over" | "under";

/** So tiền nhận với tiền của đợt. */
export function amountFit(received: number, expected: number): AmountFit {
  const r = Math.round(received);
  const e = Math.round(expected);
  if (r === e) return "exact";
  return r > e ? "over" : "under";
}

/** Ngày giao dịch (giờ VN) dạng YYYY-MM-DD — cột paid_at của contract_payments là date. */
export function vnDate(iso: string | null | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  const ms = Number.isFinite(t) ? t : now;
  return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export const BANK_TXN_STATUS_LABEL: Record<string, string> = {
  matched: "Đã tự ghi thu",
  unmatched: "Chưa rõ của ai",
  mismatch: "Cần xem lại",
  ignored: "Đã bỏ qua",
};

/** Lý do (cột note) → câu hiện cho studio. */
export const BANK_TXN_NOTE_LABEL: Record<string, string> = {
  partial: "Khách chuyển thiếu: đã ghi phần nhận được, phần còn lại tách thành đợt mới",
  over: "Khách chuyển dư so với đợt",
  already_paid: "Đợt này đã đánh dấu thu từ trước: có thể khách chuyển hai lần",
  deposit_under: "Cọc giữ ngày chuyển thiếu, chưa xác nhận",
  deposit_done: "Cọc giữ ngày này đã xác nhận từ trước",
  no_code: "Nội dung chuyển khoản không có mã nào của studio",
  write_failed: "Có mã nhưng ghi thu hỏng (sổ đã khoá?)",
  manual: "Studio gán tay",
};
