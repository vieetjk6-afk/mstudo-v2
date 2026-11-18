/*
 * LƯU LƯỢNG — phần luật THUẦN (không vào/ra gì), dùng chung cho bộ đếm phía
 * máy chủ (@/lib/luu-luong), bộ đếm phía trình duyệt (@/lib/supabase/client),
 * route nhận số đếm, script đọc số liệu Vercel và trang Sức khoẻ hệ thống.
 * Kiểm thử: desktop/test/luu-luong.mjs.
 */

/** Hạn mức gói Free đáng canh nhất. Supabase: egress cả tổ chức / tháng. */
export const GIOI_HAN = {
  supabaseEgressBytes: 5 * 1024 ** 3,
  /** Vercel Hobby — chỉ hai mục hay chạm; mục khác hiện số, không có trần. */
  vercel: [
    { khop: /fast data transfer/i, ten: "Fast Data Transfer", tran: 100 * 1024 ** 3, donVi: "byte" },
    { khop: /fast origin transfer/i, ten: "Fast Origin Transfer", tran: 10 * 1024 ** 3, donVi: "byte" },
  ],
} as const;

/** Cảnh báo admin khi ước tính tháng này chạm ngần này phần trăm hạn mức. */
export const NGUONG_CANH_BAO = 0.8;

export const NGUON_SUPABASE = ["supabase-may-chu", "supabase-trinh-duyet"] as const;
export type NguonSupabase = (typeof NGUON_SUPABASE)[number];

/** Ngày UTC dạng YYYY-MM-DD — hạn mức Supabase / Vercel tính theo ngày UTC. */
export function ngayUtc(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}
/** Tháng UTC dạng YYYY-MM. */
export const thangUtc = (ms: number = Date.now()) => ngayUtc(ms).slice(0, 7);

/** Có phải request tới Supabase của app không (chỉ đếm những request đó). */
export function laSupabase(url: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    return new URL(url).host === new URL(supabaseUrl).host;
  } catch {
    return false;
  }
}

/** Độ dài thân trả lời theo header (byte trên đường truyền). null khi không có. */
export function doDaiTheoHeader(h: { get(name: string): string | null }): number | null {
  const v = h.get("content-length");
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Bộ đếm theo ngày: cộng dồn, lấy ra để xả, trả lại khi xả hỏng. */
export class BoDem {
  private theoNgay = new Map<string, { bytes: number; requests: number }>();
  cong(bytes: number, requests = 0, ngay = ngayUtc()): void {
    if (!(bytes >= 0) || !(requests >= 0)) return;
    const o = this.theoNgay.get(ngay) ?? { bytes: 0, requests: 0 };
    o.bytes += bytes;
    o.requests += requests;
    this.theoNgay.set(ngay, o);
  }
  tong(): number {
    let t = 0;
    for (const v of this.theoNgay.values()) t += v.bytes;
    return t;
  }
  rong(): boolean {
    return this.theoNgay.size === 0;
  }
  /** Lấy hết ra (bộ đếm về 0) để xả. */
  layRa(): { ngay: string; bytes: number; requests: number }[] {
    const out = [...this.theoNgay.entries()].map(([ngay, v]) => ({ ngay, ...v }));
    this.theoNgay.clear();
    return out;
  }
  /** Xả hỏng → cộng lại để lần sau xả tiếp. */
  traLai(ds: { ngay: string; bytes: number; requests: number }[]): void {
    for (const d of ds) this.cong(d.bytes, d.requests, d.ngay);
  }
}

/** Kiểm số đếm trình duyệt gửi lên (route /api/usage/egress). */
export function kiemSoDem(raw: unknown): { bytes: number; requests: number } | null {
  const o = raw as { bytes?: unknown; requests?: unknown } | null;
  const b = Number(o?.bytes);
  const r = Number(o?.requests);
  if (!Number.isFinite(b) || !Number.isFinite(r)) return null;
  if (b < 0 || r < 0 || b > 2 * 1024 ** 3 || r > 100_000) return null;
  if (b === 0 && r === 0) return null;
  return { bytes: Math.round(b), requests: Math.round(r) };
}

export type DongUsage = { day: string; source: string; metric: string; quantity: number; unit: string | null; cost: number | null; requests: number };

/** Gộp số liệu tháng cho trang Sức khoẻ hệ thống. */
export function tomTatThang(rows: readonly DongUsage[], thang: string, now = Date.now()) {
  const trong = rows.filter((r) => r.day.startsWith(thang));
  const supa = trong.filter((r) => (NGUON_SUPABASE as readonly string[]).includes(r.source));
  const theoNgay = new Map<string, number>();
  let mayChu = 0;
  let trinhDuyet = 0;
  for (const r of supa) {
    theoNgay.set(r.day, (theoNgay.get(r.day) ?? 0) + r.quantity);
    if (r.source === "supabase-may-chu") mayChu += r.quantity;
    else trinhDuyet += r.quantity;
  }
  const tong = mayChu + trinhDuyet;
  // Dự báo cuối tháng theo tốc độ trung bình các ngày đã qua (kể cả hôm nay).
  const d = new Date(now);
  const ngayTrongThang = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const daQua = thang === thangUtc(now) ? d.getUTCDate() : ngayTrongThang;
  const duBao = daQua > 0 ? (tong / daQua) * ngayTrongThang : tong;

  const vercelRows = trong.filter((r) => r.source === "vercel" && !r.metric.startsWith("_"));
  const vMap = new Map<string, { service: string; quantity: number; unit: string | null; cost: number }>();
  for (const r of vercelRows) {
    const k = `${r.metric}|${r.unit ?? ""}`;
    const o = vMap.get(k) ?? { service: r.metric, quantity: 0, unit: r.unit, cost: 0 };
    o.quantity += r.quantity;
    o.cost += r.cost ?? 0;
    vMap.set(k, o);
  }
  const vercel = [...vMap.values()]
    .map((v) => {
      const g = GIOI_HAN.vercel.find((x) => x.khop.test(v.service));
      const tran = g && laDonViByte(v.unit) ? g.tran : null;
      return { ...v, tran, tiLe: tran ? (doiRaByte(v.quantity, v.unit) ?? 0) / tran : null };
    })
    .sort((a, b) => (b.tiLe ?? -1) - (a.tiLe ?? -1) || b.cost - a.cost);
  const loiVercel = trong.find((r) => r.source === "vercel" && r.metric === "_loi");
  const capNhatVercel = trong.filter((r) => r.source === "vercel").map((r) => r.day).sort().pop() ?? null;

  return {
    thang,
    supabase: {
      bytes: tong,
      mayChu,
      trinhDuyet,
      tran: GIOI_HAN.supabaseEgressBytes,
      tiLe: tong / GIOI_HAN.supabaseEgressBytes,
      duBao,
      tiLeDuBao: duBao / GIOI_HAN.supabaseEgressBytes,
      theoNgay: [...theoNgay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, bytes]) => ({ day, bytes })),
    },
    vercel,
    vercelLoi: loiVercel ? loiVercel.unit : null,
    vercelCapNhat: capNhatVercel,
  };
}

/** Đơn vị byte của FOCUS (Vercel ghi "GB", "MB", "Bytes"…). */
export function laDonViByte(unit: string | null | undefined): boolean {
  return /^(bytes?|[kmgt]i?b)$/i.test((unit ?? "").trim());
}
export function doiRaByte(q: number, unit: string | null | undefined): number | null {
  const u = (unit ?? "").trim().toLowerCase();
  const bang: Record<string, number> = { byte: 1, bytes: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 };
  return u in bang ? q * bang[u] : null;
}

/**
 * Đọc dữ liệu chi phí Vercel (FOCUS v1.3, mỗi dòng một JSON) → gộp theo ngày +
 * dịch vụ + đơn vị. Bỏ dòng hỏng thay vì ném: một dòng lạ không được làm mất
 * cả ngày số liệu.
 */
export function docFocus(jsonl: string): { day: string; service: string; quantity: number; unit: string | null; cost: number }[] {
  const m = new Map<string, { day: string; service: string; quantity: number; unit: string | null; cost: number }>();
  for (const line of jsonl.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let r: Record<string, unknown>;
    try {
      r = JSON.parse(t);
    } catch {
      continue;
    }
    const day = String(r.ChargePeriodStart ?? r.chargePeriodStart ?? "").slice(0, 10);
    const service = String(r.ServiceName ?? r.serviceName ?? r.ChargeDescription ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !service) continue;
    const q = Number(r.ConsumedQuantity ?? r.consumedQuantity ?? 0);
    const unitRaw = r.ConsumedUnit ?? r.consumedUnit ?? null;
    const unit = unitRaw == null ? null : String(unitRaw);
    const cost = Number(r.BilledCost ?? r.billedCost ?? r.EffectiveCost ?? 0);
    const k = `${day}|${service}|${unit ?? ""}`;
    const o = m.get(k) ?? { day, service, quantity: 0, unit, cost: 0 };
    if (Number.isFinite(q)) o.quantity += q;
    if (Number.isFinite(cost)) o.cost += cost;
    m.set(k, o);
  }
  return [...m.values()];
}

/** Dạng đọc cho người: 1,23 GB / 456 MB. */
export function dinhDangByte(n: number): string {
  if (!(n >= 0)) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("vi-VN", { maximumFractionDigits: v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2 })} ${u[i]}`;
}
