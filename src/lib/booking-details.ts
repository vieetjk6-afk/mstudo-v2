/**
 * Phần khách điền thêm ở form đặt lịch /book — lưu ở studio_bookings.details
 * (migrations/dat_lich_chi_tiet.sql). Thuần dữ liệu: dùng chung cho form,
 * API, danh sách đặt lịch và bước "Tạo hợp đồng" từ yêu cầu đặt lịch.
 */

export type BookingPerson = { name?: string; phone?: string; address?: string };
export type BookingDay = { label: string; date: string };
export type BookingPackage = { name: string; price: number | null };

export type BookingDetails = {
  /** Khách chọn NHIỀU gói (gói tự ghi có price null). */
  packages?: BookingPackage[];
  /** Tên ngày chính khách tự đặt ("Lễ nhà gái"…); ngày ở preferred_date. */
  event_label?: string;
  /** Ngày phụ: tên + ngày. */
  extra_days?: BookingDay[];
  bride?: BookingPerson;
  groom?: BookingPerson;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function person(v: unknown): BookingPerson | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const p: BookingPerson = {};
  const name = txt(o.name, 120);
  const phone = txt(o.phone, 20).replace(/[^\d+]/g, "");
  const address = txt(o.address, 300);
  if (name) p.name = name;
  if (phone) p.phone = phone;
  if (address) p.address = address;
  return Object.keys(p).length ? p : undefined;
}

/**
 * Kiểm lại ở MÁY CHỦ — trình duyệt gửi gì cũng được. Bỏ trường rỗng / sai dạng,
 * giới hạn độ dài và số phần tử. Trả null khi không còn gì.
 */
export function cleanBookingDetails(raw: unknown): BookingDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: BookingDetails = {};
  if (Array.isArray(r.packages)) {
    const pk = r.packages
      .map((x): BookingPackage | null => {
        const o = (x ?? {}) as Record<string, unknown>;
        const name = txt(o.name, 160);
        if (!name) return null;
        const price = typeof o.price === "number" && Number.isFinite(o.price) && o.price >= 0 ? Math.round(o.price) : null;
        return { name, price };
      })
      .filter((x): x is BookingPackage => !!x)
      .slice(0, 20);
    if (pk.length) out.packages = pk;
  }
  const label = txt(r.event_label, 80);
  if (label) out.event_label = label;
  if (Array.isArray(r.extra_days)) {
    const days = r.extra_days
      .map((x): BookingDay | null => {
        const o = (x ?? {}) as Record<string, unknown>;
        const date = txt(o.date, 10);
        if (!ISO.test(date)) return null;
        return { label: txt(o.label, 80) || "Ngày phụ", date };
      })
      .filter((x): x is BookingDay => !!x)
      .slice(0, 6);
    if (days.length) out.extra_days = days;
  }
  const bride = person(r.bride);
  if (bride) out.bride = bride;
  const groom = person(r.groom);
  if (groom) out.groom = groom;
  return Object.keys(out).length ? out : null;
}

/** "Ngày phụ: Lễ nhà trai 26/12/2026" — dd/mm/yyyy cho người đọc. */
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function personLine(role: string, p?: BookingPerson): string | null {
  if (!p) return null;
  const bits = [p.name, p.phone, p.address].filter(Boolean);
  return bits.length ? `${role}: ${bits.join(" · ")}` : null;
}

/**
 * Các dòng chữ tóm tắt — hiện ở danh sách đặt lịch, thông báo cho studio, và
 * ghi vào ghi chú khi database chưa có cột details (để không mất thông tin).
 */
export function bookingDetailLines(d: BookingDetails | null | undefined, opts: { includePackages?: boolean } = {}): string[] {
  if (!d) return [];
  const out: string[] = [];
  if (opts.includePackages && d.packages && d.packages.length > 1) out.push(`Gói: ${d.packages.map((p) => p.name).join(", ")}`);
  if (d.event_label) out.push(`Ngày chính: ${d.event_label}`);
  for (const x of d.extra_days ?? []) out.push(`Ngày phụ: ${x.label} ${dmy(x.date)}`);
  const b = personLine("Cô dâu", d.bride);
  if (b) out.push(b);
  const g = personLine("Chú rể", d.groom);
  if (g) out.push(g);
  return out;
}

/** Có vẻ là đám cưới không — để mở sẵn phần cô dâu / chú rể ở form đặt lịch. */
export function looksLikeWedding(...texts: (string | null | undefined)[]): boolean {
  const s = texts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
  return /\bcuoi\b|wedding|dam cuoi|le cuoi|an hoi|dinh hon|vu quy|thanh hon/.test(s);
}
