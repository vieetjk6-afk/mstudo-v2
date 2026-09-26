import type { ContractIntake, IntakeLocation } from "@/lib/types";
import { directionsLink, mapsLink, validCoords } from "@/lib/map-coords";

/* ═══════════════════════════════════════════════════════════════════════════
   THÔNG TIN BUỔI CHỤP (form khách điền) → các PHẦN riêng lẻ.

   Studio không gửi cả khối cho mọi thợ: thợ theo nhà gái chỉ cần SĐT, giờ
   makeup, vị trí nhà gái; thợ theo nhà trai cần phần nhà trai; ai đi tiệc thì
   cần địa điểm tiệc. Vì vậy dữ liệu được tách thành từng phần có khoá ổn định
   ("gai" | "trai" | "tiec" | "chung" | "ghichu") để màn "Thông tin buổi chụp"
   hiện từng thẻ và ghép tin gửi theo đúng phần studio chọn.

   Khoá "gai"/"trai" trùng giá trị `contract_crew.side` → thợ đã gán nhà nào
   thì mặc định được tick sẵn đúng phần nhà đó.
   ═══════════════════════════════════════════════════════════════════════════ */

export type IntakeSectionKey = "gai" | "trai" | "tiec" | "chung" | "ghichu";

export type IntakeSection = {
  key: IntakeSectionKey;
  title: string;
  rows: { label: string; value: string; tel?: boolean }[];
  location: IntakeLocation | null;
};

const v = (s: string | null | undefined) => (s ?? "").trim();

/**
 * Vị trí dùng được, hoặc null. Bản cũ từng lưu (0,0) — link "q=0,0" giữa Đại
 * Tây Dương — khi khách dán link rút gọn; hiện ra hay gửi cho thợ đều chỉ gây
 * lạc đường, nên coi như khách chưa nhập vị trí.
 */
export function cleanIntakeLocation(loc: IntakeLocation | null | undefined): IntakeLocation | null {
  if (!loc || typeof loc.mapUrl !== "string" || !loc.mapUrl) return null;
  if (loc.lat == null && loc.lng == null) return loc;
  const c = validCoords(loc.lat, loc.lng);
  // Dựng lại link từ toạ độ: dữ liệu cũ lưu dạng `maps?q=` mà app Google Maps
  // trên iPhone không mở được (xem mapsLink).
  return c ? { lat: c.lat, lng: c.lng, mapUrl: mapsLink(c.lat, c.lng) } : null;
}

/** Tách dữ liệu form thành các phần. Phần trống hẳn bị bỏ. */
export function intakeSections(intake: ContractIntake | null | undefined): IntakeSection[] {
  if (!intake) return [];
  const out: IntakeSection[] = [];
  const push = (s: IntakeSection) => {
    s.rows = s.rows.filter((r) => r.value);
    if (s.rows.length || s.location) out.push(s);
  };
  if (intake.type === "psc") {
    const b = intake.bride ?? {};
    const g = intake.groom ?? {};
    const r = intake.reception ?? {};
    push({
      key: "gai",
      title: "Nhà gái (cô dâu)",
      rows: [
        { label: "Cô dâu", value: v(b.name) },
        { label: "SĐT", value: v(b.phone), tel: true },
        { label: "Makeup", value: v(b.makeup_time) },
        { label: "Giờ lễ", value: v(b.ceremony_time) },
      ],
      location: cleanIntakeLocation(b.location),
    });
    push({
      key: "trai",
      title: "Nhà trai (chú rể)",
      rows: [
        { label: "Chú rể", value: v(g.name) },
        { label: "SĐT", value: v(g.phone), tel: true },
        { label: "Xuất phát", value: v(g.depart_time) },
        { label: "Giờ lễ", value: v(g.ceremony_time) },
      ],
      location: cleanIntakeLocation(g.location),
    });
    push({
      key: "tiec",
      title: "Tiệc cưới / địa điểm khác",
      rows: [{ label: "Giờ đãi tiệc", value: v(r.time) }],
      location: cleanIntakeLocation(r.location),
    });
  } else {
    push({
      key: "chung",
      title: "Thông tin buổi chụp",
      rows: [
        { label: "Người làm việc trực tiếp", value: v(intake.contact_name) },
        { label: "SĐT", value: v(intake.contact_phone), tel: true },
        { label: "Bắt đầu", value: v(intake.start_time) },
      ],
      location: cleanIntakeLocation(intake.location),
    });
  }
  if (v(intake.note)) push({ key: "ghichu", title: "Ghi chú của khách", rows: [{ label: "Ghi chú", value: v(intake.note) }], location: null });
  return out;
}

/** Link chỉ đường tới vị trí (chỉ khi có toạ độ). */
export function intakeDirections(loc: IntakeLocation | null | undefined): string | null {
  const c = loc ? validCoords(loc.lat, loc.lng) : null;
  return c ? directionsLink(c.lat, c.lng) : null;
}

/** Một phần dưới dạng chữ thuần (để sao chép / gửi Zalo). */
export function sectionText(s: IntakeSection): string {
  const lines = [s.title.toUpperCase()];
  for (const r of s.rows) lines.push(`• ${r.label}: ${r.value}`);
  if (s.location) {
    lines.push(`• Vị trí: ${s.location.mapUrl}`);
    const d = intakeDirections(s.location);
    if (d) lines.push(`• Chỉ đường: ${d}`);
  }
  return lines.join("\n");
}

/**
 * Tin gửi thợ: đầu tin (buổi chụp, ngày, người nhận) + các phần được chọn.
 * `keys` rỗng = gửi mọi phần.
 */
export function intakeMessage(opts: {
  sections: IntakeSection[];
  keys?: IntakeSectionKey[];
  title?: string | null;
  date?: string | null;
  to?: string | null;
  studio?: string | null;
}): string {
  const picked = opts.keys?.length ? opts.sections.filter((s) => opts.keys!.includes(s.key)) : opts.sections;
  const head: string[] = [];
  if (opts.to) head.push(`Chào ${opts.to},`);
  head.push(
    `${opts.studio ? `${opts.studio} gửi ` : ""}thông tin buổi chụp${opts.title ? ` "${opts.title}"` : ""}${opts.date ? ` — ngày ${opts.date}` : ""}:`
  );
  return [head.join("\n"), ...picked.map(sectionText)].join("\n\n");
}

/** Phần mặc định cho một thợ theo `contract_crew.side`. */
export function defaultKeysForSide(sections: IntakeSection[], side: string | null | undefined): IntakeSectionKey[] {
  const all = sections.map((s) => s.key);
  if (side === "gai" || side === "trai") {
    return all.filter((k) => k === side || k === "tiec" || k === "ghichu");
  }
  return all;
}
