import type { WeddingBank, WeddingConfig, WeddingInvitation } from "@/lib/types";

export type Wish = { guest_name: string; wish: string; created_at: string };

export type TemplateProps = { inv: WeddingInvitation; wishes: Wish[]; guest?: string };

export function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function vietqrUrl(bank?: WeddingBank): string | null {
  if (!bank?.bin || !bank?.account) return null;
  const acc = bank.account.replace(/\s/g, "");
  const params = new URLSearchParams();
  if (bank.holder) params.set("accountName", bank.holder);
  const qs = params.toString();
  return `https://img.vietqr.io/image/${bank.bin}-${acc}-compact2.png${qs ? `?${qs}` : ""}`;
}

export type Palette = { surface: string; border: string; accent: string; muted: string };

/** VietQR "mừng cưới" card, styled by the calling template's palette. */
export function GiftCard({ title, bank, defaultName, pal, round = 16 }: { title: string; bank?: WeddingBank; defaultName?: string; pal: Palette; round?: number }) {
  const url = vietqrUrl(bank);
  if (!url) return null;
  return (
    <div className="flex flex-col items-center gap-2 p-5 text-center shadow-sm" style={{ background: pal.surface, border: `1px solid ${pal.border}`, borderRadius: round }}>
      <p className="font-serif text-lg" style={{ color: pal.accent }}>Mừng cưới {title}</p>
      <img src={url} alt="" width={190} height={190} style={{ width: 190, height: "auto", borderRadius: 12, background: "#fff" }} />
      {(bank?.holder || defaultName) && <p className="text-sm font-medium">{bank?.holder || defaultName}</p>}
      <p className="text-xs" style={{ color: pal.muted }}>{bank?.account?.replace(/\s/g, "")}{bank?.name ? ` · ${bank.name}` : ""}</p>
    </div>
  );
}

type FullPal = { accent: string; surface: string; text: string; muted: string; border: string };
const initialOf = (s?: string) => (s || "").trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "♥";

/**
 * Khối "lời mời + TÊN KHÁCH MỜI" — nằm TRONG nội dung thiệp (cuộn theo trang,
 * không cố định). Đặt sau phần "Ngày trọng đại" của mỗi mẫu. Tên dùng font viết tay.
 */
export function GuestBlock({ name, label, pal, dark }: { name: string; label: string; pal: FullPal; dark?: boolean }) {
  return (
    <section style={{ padding: "44px 20px", textAlign: "center", background: dark ? "rgba(255,255,255,.06)" : `${pal.accent}12`, borderTop: `1px solid ${pal.border}`, borderBottom: `1px solid ${pal.border}` }}>
      <p style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 12.5, letterSpacing: ".24em", textTransform: "uppercase", color: pal.accent }}>{label}</p>
      <p style={{ fontFamily: "var(--font-hand), cursive", fontSize: 46, lineHeight: 1.08, color: dark ? "#ffffff" : pal.text, margin: "6px 0 12px" }}>{name}</p>
      <span style={{ display: "inline-block", width: 60, height: 1, background: pal.accent, opacity: 0.6 }} />
    </section>
  );
}

/**
 * Nội dung "mới" dùng chung cho MỌI mẫu thiệp: tên khách mời + hồ sơ cô dâu/chú
 * rể (ảnh tròn + vai vế + cha mẹ) + nút chỉ đường + màu trang phục (dress code).
 * Chỉ hiện phần nào có dữ liệu. Đặt ngay sau phần "Ngày trọng đại".
 */
export function ExtraSections({ c, groom, bride, guest, pal, dark }: { c: WeddingConfig; groom: string; bride: string; guest?: string; pal: FullPal; dark?: boolean }) {
  const label = c.guest_greeting?.trim() || "Trân trọng kính mời";
  const hasProfiles = !!(c.bride_photo || c.groom_photo || c.bride_role || c.groom_role || c.bride_subtitle || c.groom_subtitle);
  const dress = (c.dress_code ?? []).filter(Boolean);
  // Màu chữ dễ đọc trên nền tối.
  const nameColor = dark ? "#ffffff" : pal.text;
  const subColor = dark ? "rgba(255,255,255,.82)" : pal.muted;

  const Profile = ({ role, name, photo, sub }: { role: string; name: string; photo?: string; sub?: string }) => (
    <div style={{ textAlign: "center" }}>
      <div style={{ margin: "0 auto 18px", width: 176, height: 176, borderRadius: "50%", overflow: "hidden", border: `3px solid ${pal.accent}`, background: dark ? "rgba(255,255,255,.08)" : `${pal.accent}18` }}>
        {photo ? (
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, color: pal.accent, fontFamily: "var(--font-hand), cursive" }}>{initialOf(name)}</div>}
      </div>
      <p style={{ fontSize: 11.5, letterSpacing: ".3em", textTransform: "uppercase", color: pal.accent }}>{role}</p>
      <h3 style={{ marginTop: 4, fontSize: 30, lineHeight: 1.1, fontFamily: "var(--font-hand), cursive", color: nameColor }}>{name}</h3>
      {sub && <p style={{ margin: "8px auto 0", maxWidth: 260, fontSize: 14, color: subColor }}>{sub}</p>}
    </div>
  );

  return (
    <>
      {guest && <GuestBlock name={guest} label={label} pal={pal} dark={dark} />}

      {hasProfiles && (
        <section style={{ padding: "52px 24px" }}>
          <div style={{ margin: "0 auto", maxWidth: 720, display: "grid", gap: 44, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Profile role={c.bride_role || "Cô dâu"} name={bride} photo={c.bride_photo} sub={c.bride_subtitle} />
            <Profile role={c.groom_role || "Chú rể"} name={groom} photo={c.groom_photo} sub={c.groom_subtitle} />
          </div>
        </section>
      )}

      {c.map_url && (
        <section style={{ padding: "8px 20px 40px", textAlign: "center" }}>
          <a href={c.map_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: `1px solid ${pal.accent}`, color: pal.accent, borderRadius: 999, padding: "10px 24px", fontSize: 14 }}>📍 Chỉ đường đến hôn lễ</a>
        </section>
      )}

      {dress.length > 0 && (
        <section style={{ padding: "44px 20px", textAlign: "center", background: dark ? "rgba(255,255,255,.05)" : `${pal.accent}0f` }}>
          <p style={{ fontSize: 11.5, letterSpacing: ".3em", textTransform: "uppercase", color: pal.accent }}>Màu trang phục · Dress code</p>
          <div style={{ margin: "18px auto 0", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
            {dress.map((col, i) => <span key={i} style={{ width: 42, height: 42, borderRadius: "50%", background: col, border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.12)" }} />)}
          </div>
          {c.dress_code_note && <p style={{ margin: "16px auto 0", maxWidth: 420, fontSize: 14, color: subColor }}>{c.dress_code_note}</p>}
        </section>
      )}
    </>
  );
}

/**
 * Lời cảm ơn cuối thiệp (chữ + ảnh) — dùng chung cho MỌI mẫu, đặt gần cuối trang
 * (trước footer). Chỉ hiện khi có nội dung; palette theo mẫu đang gọi.
 */
export function ThanksBlock({ note, photo, pal, dark }: { note?: string; photo?: string; pal: FullPal; dark?: boolean }) {
  if (!note && !photo) return null;
  const sub = dark ? "rgba(255,255,255,.85)" : pal.muted;
  return (
    <section style={{ padding: "52px 24px", textAlign: "center", background: dark ? "rgba(255,255,255,.05)" : `${pal.accent}0f`, borderTop: `1px solid ${pal.border}` }}>
      <p style={{ fontSize: 11.5, letterSpacing: ".3em", textTransform: "uppercase", color: pal.accent }}>Lời cảm ơn</p>
      {photo && (
        <div style={{ margin: "20px auto 0", width: 190, height: 190, borderRadius: "50%", overflow: "hidden", border: `3px solid ${pal.accent}` }}>
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      {note && <p style={{ margin: "18px auto 0", maxWidth: 460, fontSize: 15.5, lineHeight: 1.7, whiteSpace: "pre-line", fontStyle: "italic", color: sub }}>{note}</p>}
    </section>
  );
}

/** Normalised, render-ready view of a config (defaults + filtered lists). */
export function readConfig(inv: WeddingInvitation) {
  const c = inv.config as WeddingConfig;
  return {
    c,
    groom: c.groom_name || "Chú rể",
    bride: c.bride_name || "Cô dâu",
    events: (c.events ?? []).filter((e) => e.label || e.date || e.venue),
    gallery: (c.gallery ?? []).filter(Boolean),
    hasGift: !!c.gift_enabled && (!!vietqrUrl(c.groom_bank) || !!vietqrUrl(c.bride_bank)),
  };
}
