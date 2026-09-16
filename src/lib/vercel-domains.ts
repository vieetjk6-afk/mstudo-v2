import "server-only";

/**
 * Vercel Domains API — dùng chung cho tên miền phụ (<sub>.mstudo.com) và tên
 * miền riêng của studio (studio.com).
 *
 * VÌ SAO CẦN: Vercel chỉ phục vụ một host khi host đó ĐÃ được thêm vào project.
 * Lưu `sites.subdomain` vào database KHÔNG làm được việc đó — nên trước đây
 * studio gõ tên miền phụ, bấm Lưu, mở link ra thì gặp trang lỗi của Vercel
 * ("domain not found") mà app còn chưa kịp chạy dòng code nào. Muốn tự chạy thì
 * hoặc project có domain wildcard `*.mstudo.com`, hoặc app phải tự gọi API thêm
 * từng host — file này lo cả hai.
 *
 * Không có VERCEL_TOKEN/VERCEL_PROJECT_ID thì mọi hàm trả về configured=false
 * và người vận hành tự thêm domain trong bảng điều khiển Vercel.
 */

// .trim() vì giá trị dán vào ô Environment Variables của Vercel rất dễ mang theo
// khoảng trắng / xuống dòng ở cuối (cùng lý do đã phải trim biến Supabase trong
// middleware). Một ký tự thừa trong TOKEN là mọi lời gọi API trả 403, còn thừa
// trong PROJECT_ID thì URL thành `/projects/prj_abc%0A/domains` → 404. Cả hai
// đều hiện ra dưới dạng "tên miền phụ không chạy" mà chẳng có lỗi nào rõ ràng.
const TOKEN = process.env.VERCEL_TOKEN?.trim();
const PROJECT = process.env.VERCEL_PROJECT_ID?.trim();
const TEAM = process.env.VERCEL_TEAM_ID?.trim();

export function vercelConfigured(): boolean {
  return !!(TOKEN && PROJECT);
}

export type VercelResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  /** Lỗi mạng / API không trả JSON — KHÁC với "API trả lỗi có mã". */
  unreachable?: boolean;
};

function vercelUrl(path: string) {
  const q = TEAM ? `${path.includes("?") ? "&" : "?"}teamId=${TEAM}` : "";
  return `https://api.vercel.com${path}${q}`;
}

/**
 * Gọi API Vercel. KHÔNG bao giờ ném: mọi lỗi mạng thành `{ ok:false,
 * unreachable:true }`. Chỗ gọi đều nằm trên đường lưu tên miền của studio —
 * Vercel chớp mạng không được phép làm hỏng cả thao tác lưu.
 */
export async function vercelApi(path: string, init?: RequestInit): Promise<VercelResult> {
  if (!vercelConfigured()) return { ok: false, status: 0, data: {}, unreachable: true };
  try {
    const res = await fetch(vercelUrl(path), {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error("[vercel] không gọi được API:", err);
    return { ok: false, status: 0, data: {}, unreachable: true };
  }
}

/** Mã lỗi Vercel trả về (data.error.code), nếu có. */
function errorCode(r: VercelResult): string {
  const e = r.data?.error as { code?: string } | undefined;
  return e?.code ?? "";
}

export type DomainInfo = {
  /** Host đã nằm trong project chưa. */
  present: boolean;
  /** Vercel đã xác minh quyền sở hữu + DNS đã trỏ đúng chưa. */
  verified: boolean;
  /** Các bản ghi cần thêm khi chưa xác minh (TXT `_vercel`…). */
  verification: unknown[];
};

/** Tình trạng một host trong project. `present=false` khi Vercel trả 404. */
export async function getDomain(host: string): Promise<DomainInfo> {
  const r = await vercelApi(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(host)}`);
  if (!r.ok) return { present: false, verified: false, verification: [] };
  return {
    present: true,
    verified: !!r.data?.verified,
    verification: (r.data?.verification as unknown[]) ?? [],
  };
}

/**
 * Thêm host vào project (bỏ qua nếu đã có). Trả về tình trạng sau khi thêm.
 *
 * `domain_already_in_use` = host đang thuộc project/tài khoản KHÁC — thêm kiểu
 * gì cũng không được, phải gỡ bên kia trước; báo rõ thay vì im lặng.
 */
export async function addDomain(host: string): Promise<DomainInfo & { conflict?: boolean }> {
  const r = await vercelApi(`/v10/projects/${PROJECT}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: host }),
  });
  if (r.ok) {
    return {
      present: true,
      verified: !!r.data?.verified,
      verification: (r.data?.verification as unknown[]) ?? [],
    };
  }
  const code = errorCode(r);
  // 409 / domain_already_exists: đã thêm từ trước (có thể ở lần lưu trước) —
  // đọc lại tình trạng thật thay vì coi là lỗi.
  if (r.status === 409 || code === "domain_already_exists") return getDomain(host);
  if (code === "domain_already_in_use") return { present: false, verified: false, verification: [], conflict: true };
  return { present: false, verified: false, verification: [] };
}

/** Gỡ host khỏi project. Không có cũng coi như xong. */
export async function removeDomain(host: string): Promise<void> {
  await vercelApi(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(host)}`, { method: "DELETE" });
}

/* ── Wildcard *.mstudo.com ────────────────────────────────────────────────── */

/**
 * Khi project có wildcard `*.mstudo.com` ĐÃ xác minh thì MỌI tên miền phụ chạy
 * ngay, không cần đăng ký từng cái. Đây là cách nên dùng; đăng ký từng host chỉ
 * là phương án dự phòng.
 *
 * Nhớ tạm kết quả: mỗi lần studio lưu tên miền phụ đều hỏi câu này, mà wildcard
 * thì hàng tháng mới đổi một lần. TTL ngắn để sau khi người vận hành vừa thêm
 * wildcard, app nhận ra trong vòng vài phút chứ không phải chờ deploy lại.
 */
let wildcardCache: { at: number; info: DomainInfo } | null = null;
const WILDCARD_TTL_MS = 5 * 60_000;

export async function getWildcard(mainHost: string, force = false): Promise<DomainInfo> {
  if (!force && wildcardCache && Date.now() - wildcardCache.at < WILDCARD_TTL_MS) return wildcardCache.info;
  const info = await getDomain(`*.${mainHost}`);
  wildcardCache = { at: Date.now(), info };
  return info;
}

export type HostState =
  /** Host chạy được ngay (wildcard đã xác minh, hoặc host đã đăng ký & xác minh). */
  | "ready"
  /** Đã đăng ký nhưng Vercel chưa xác minh xong (DNS đang lan truyền / thiếu bản ghi). */
  | "pending"
  /** Host đang thuộc project hoặc tài khoản Vercel khác. */
  | "conflict"
  /** Máy chủ chưa nối API Vercel — người vận hành phải tự thêm domain. */
  | "manual";

export type EnsureResult = {
  state: HostState;
  /** Chạy được nhờ wildcard `*.mstudo.com` (không phải nhờ đăng ký riêng). */
  viaWildcard: boolean;
  verification: unknown[];
};

/**
 * Lo cho `<sub>.mstudo.com` phục vụ được — gọi mỗi khi studio lưu tên miền phụ.
 *
 * 1. Có wildcard đã xác minh → xong, không đụng gì tới project.
 * 2. Chưa có → đăng ký riêng host này (nên vẫn tự chạy dù người vận hành quên
 *    thêm wildcard).
 *
 * Gọi lại nhiều lần không sao: bước 2 chỉ đọc lại tình trạng nếu host đã có.
 * Nhờ vậy nút "Kiểm tra" cũng là nút SỬA — tên miền phụ lưu từ trước lúc code
 * này chưa có, chưa từng được đăng ký, sẽ được đăng ký ngay ở lượt hỏi đầu tiên.
 */
export async function ensureSubdomainHost(host: string, mainHost: string, force = false): Promise<EnsureResult> {
  if (!vercelConfigured()) return { state: "manual", viaWildcard: false, verification: [] };

  const wildcard = await getWildcard(mainHost, force);
  if (wildcard.present && wildcard.verified) return { state: "ready", viaWildcard: true, verification: [] };

  const added = await addDomain(host);
  if (added.conflict) return { state: "conflict", viaWildcard: false, verification: [] };
  if (added.present && added.verified) return { state: "ready", viaWildcard: false, verification: [] };
  return { state: "pending", viaWildcard: false, verification: added.verification };
}
