"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { collageBrandFrom, DEFAULT_COLLAGE_BRAND, type CollageBrand, type EndSlide, type SignMode, type SignPos } from "@/lib/collage/brand";
import { Switch } from "@/components/v2/kit-client";

/* ═══════════════════════════════════════════════════════════════════════════
   GHÉP ẢNH — phía studio: cài đặt chung (mọi album) + thống kê album này.

   • Cài đặt (profiles.collage_brand): ký tên studio trên ảnh ghép khách tải
     về, slide cuối "Xem cả album" (mã QR), khoá màu ảnh. Lưu ngay khi đổi.
   • Thống kê (album_collage_events): bộ ghép đã tạo, ảnh đã tải, video, mẫu
     khách dùng nhiều — studio thấy tính năng có được dùng không.
   ═══════════════════════════════════════════════════════════════════════════ */

const MISSING = "Cần cập nhật cơ sở dữ liệu: mở /api/setup-sql/ghep-layout (đăng nhập tài khoản chủ studio), chép toàn bộ rồi chạy trong Supabase SQL Editor.";

const LOCK_DESC = "Khách không đổi được bộ lọc màu (đen trắng, phim ấm…) — giữ đúng màu studio đã chỉnh.";

const SIGNS: { v: SignMode; label: string }[] = [
  { v: "name", label: "Tên studio" },
  { v: "logo", label: "Logo" },
  { v: "off", label: "Không ký" },
];
const POSES: { v: SignPos; label: string }[] = [
  { v: "br", label: "Phải dưới" },
  { v: "bc", label: "Giữa dưới" },
  { v: "bl", label: "Trái dưới" },
  { v: "tr", label: "Phải trên" },
  { v: "tl", label: "Trái trên" },
];
const ENDS: { v: EndSlide; label: string }[] = [
  { v: "studio", label: "Trang studio" },
  { v: "album", label: "Album này" },
  { v: "off", label: "Không có" },
];

/** Tên dễ hiểu của họ bố cục (thống kê). */
const FAMILY_LABEL: Record<string, string> = {
  grid: "Lưới",
  "grid+tb": "Lưới + chữ",
  "grid+tt": "Lưới + chữ",
  "grid+ts": "Lưới + chữ",
  "grid-round": "Lưới bo góc",
  "grid-print": "Ảnh in",
  tight: "Ghép sát",
  edit: "Biên tập",
  bleed: "Tràn khung",
  overlay: "Chữ trên ảnh",
  "overlay-top": "Chữ trên ảnh",
  "deco-polaroid": "Polaroid",
  "deco-arch": "Khung vòm",
  "deco-oval": "Bầu dục",
  "deco-prints": "Ảnh in chéo",
  "deco-inset": "Ảnh đè góc",
  "deco-arches": "Hàng vòm",
  "deco-circles": "Cụm tròn",
  "deco-stagger": "Bậc thang",
  "deco-scatter": "Ảnh rải",
  "deco-stamp": "Tem thư",
  "deco-stamps": "Hai tem thư",
  "deco-film": "Dải phim",
  "pano-flow": "Carousel",
  "pano-flow-round": "Carousel",
  "pano-flow-print": "Carousel",
  "pano-prints": "Carousel ảnh treo",
  "pano-hero": "Carousel ảnh lớn",
  "pano-arches": "Carousel vòm",
  "end-card": "Slide cuối",
};

/**
 * Cài đặt ghép ảnh của STUDIO SỞ HỮU album (`ownerId`), không phải của người
 * đang đăng nhập: admin mở album của studio khác (RLS cho phép đọc/sửa hồ sơ
 * mọi studio) trước đây đọc và ghi vào hồ sơ CỦA ADMIN — đổi gì cũng không
 * có tác dụng lên album đó, còn album của admin thì bị đổi theo.
 */
export function useCollageStudioSettings(enabled: boolean, ownerId: string) {
  const [brand, setBrand] = useState<CollageBrand>(DEFAULT_COLLAGE_BRAND);
  const [uid, setUid] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!enabled || !ownerId) return;
    let alive = true;
    (async () => {
      const sb = createClient();
      const id = ownerId;
      setUid(id);
      const { data, error } = await sb.from("profiles").select("collage_brand").eq("id", id).maybeSingle();
      if (!alive) return;
      if (error) {
        if (isMissingColumn(error, "collage_brand")) setErr(MISSING);
        return;
      }
      setBrand(collageBrandFrom((data as { collage_brand?: unknown } | null)?.collage_brand));
    })().catch(() => {
      /* không kết nối được — giữ mặc định */
    });
    return () => {
      alive = false;
    };
  }, [enabled, ownerId]);
  async function update(patch: Partial<CollageBrand>) {
    if (!uid) return;
    const prev = brand;
    const next = { ...brand, ...patch };
    setBrand(next);
    setSaving(true);
    setErr(null);
    // .select(): RLS chặn thì PostgREST KHÔNG báo lỗi mà trả 0 dòng — không đếm
    // dòng là màn hình báo đã lưu trong khi chẳng có gì được ghi.
    const { data, error } = await createClient().from("profiles").update({ collage_brand: next }).eq("id", uid).select("id");
    setSaving(false);
    if (error) setErr(isMissingColumn(error, "collage_brand") ? MISSING : error.message);
    else if (!data?.length) {
      setBrand(prev);
      setErr("Không có quyền sửa cài đặt ghép ảnh của studio này.");
    }
  }
  return { brand, update, err, saving, ready: !!uid };
}

export interface CollageStats {
  sets: number;
  images: number;
  videos: number;
  top: string[];
  last: string | null;
}

export function useCollageStats(albumId: string, enabled: boolean) {
  const [stats, setStats] = useState<CollageStats | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      const { data, error } = await createClient()
        .from("album_collage_events")
        .select("kind, n, meta, created_at")
        .eq("album_id", albumId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!alive || error) return;
      const rows = (data ?? []) as { kind: string; n: number; meta: Record<string, unknown> | null; created_at: string }[];
      const freq = new Map<string, number>();
      for (const r of rows) {
        const fams = Array.isArray(r.meta?.families) ? (r.meta!.families as unknown[]) : [];
        for (const f of fams) {
          const label = typeof f === "string" ? FAMILY_LABEL[f] : undefined;
          if (label && label !== "Slide cuối") freq.set(label, (freq.get(label) ?? 0) + 1);
        }
      }
      setStats({
        sets: rows.filter((r) => r.kind === "set").length,
        images: rows.filter((r) => r.kind === "export").reduce((s, r) => s + (r.n || 0), 0),
        videos: rows.filter((r) => r.kind === "video").length,
        top: [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
        last: rows[0]?.created_at ?? null,
      });
    })().catch(() => {
      /* không kết nối được — chưa có số liệu */
    });
    return () => {
      alive = false;
    };
  }, [albumId, enabled]);
  return stats;
}

function Chips<T extends string>({ value, options, onPick, disabled, label }: { value: T; options: { v: T; label: string }[]; onPick: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          disabled={disabled}
          onClick={() => onPick(o.v)}
          className="h-8 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-60"
          style={value === o.v ? { background: "var(--acS, rgba(175,43,184,.1))", color: "var(--ac, var(--gold))", border: "1.5px solid var(--ac, var(--gold))" } : { background: "transparent", color: "var(--tx2, var(--text2))", border: "1px solid var(--bd, var(--border))" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Cài đặt chung + thống kê — dùng trong thẻ Ghép ảnh (bản mới và bản cũ). `legacy`: giao diện cũ (không có kiểu .ui-v2 → dùng ô tích thường). */
export function CollageStudioPanel({ albumId, ownerId, legacy = false }: { albumId: string; ownerId: string; legacy?: boolean }) {
  const s = useCollageStudioSettings(true, ownerId);
  const stats = useCollageStats(albumId, true);
  const muted = { color: "var(--tx3, var(--text3))" } as const;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[12px] px-3.5 py-3" style={{ border: "1px solid var(--bd, var(--border))" }}>
        <p className="text-[13px] font-semibold">Thống kê album này</p>
        {stats ? (
          <>
            <p className="mt-1 text-[13px]" style={{ color: "var(--tx2, var(--text2))" }}>
              Khách đã tạo <b>{stats.sets}</b> bộ ghép · tải <b>{stats.images}</b> ảnh · <b>{stats.videos}</b> video
            </p>
            {stats.top.length ? (
              <p className="mt-0.5 text-[12px]" style={muted}>
                Mẫu dùng nhiều: {stats.top.join(", ")}
              </p>
            ) : null}
            {stats.last ? (
              <p className="mt-0.5 text-[12px]" style={muted}>
                Lần gần nhất: {new Date(stats.last).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-[12.5px]" style={muted}>
            Chưa có lượt nào (hoặc cơ sở dữ liệu chưa cập nhật).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 rounded-[12px] px-3.5 py-3" style={{ border: "1px solid var(--bd, var(--border))" }}>
        <div>
          <p className="text-[13px] font-semibold">Cài đặt ghép ảnh của studio</p>
          <p className="text-[12px]" style={muted}>
            Áp dụng cho mọi album. Mỗi ảnh khách đăng là một lần studio được giới thiệu.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx2, var(--text2))" }}>
            Ký tên studio trên ảnh ghép
          </p>
          <Chips label="Ký tên" value={s.brand.sign} options={SIGNS} disabled={!s.ready} onPick={(v) => void s.update({ sign: v })} />
          {s.brand.sign !== "off" ? <Chips label="Vị trí ký tên" value={s.brand.pos} options={POSES} disabled={!s.ready} onPick={(v) => void s.update({ pos: v })} /> : null}
          {s.brand.sign === "logo" ? (
            <p className="text-[11.5px]" style={muted}>
              Dùng logo trong thương hiệu studio. Logo không tải được thì máy ký bằng tên.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx2, var(--text2))" }}>
            Slide cuối “Xem cả album” (mã QR)
          </p>
          <Chips label="Slide cuối" value={s.brand.end} options={ENDS} disabled={!s.ready} onPick={(v) => void s.update({ end: v })} />
          <p className="text-[11.5px]" style={muted}>
            {s.brand.end === "album"
              ? "Mã QR mở album này — ai thấy bài đăng cũng xem được album (album có mật khẩu thì vẫn phải nhập)."
              : s.brand.end === "studio"
                ? "Mã QR mở trang của studio. Khách xoá được slide này nếu không muốn đăng."
                : "Không thêm slide cuối."}
          </p>
        </div>
        <div className="h-px" style={{ background: "var(--bd, var(--border))" }} />
        {legacy ? (
          <label className="flex items-start gap-2.5">
            <input type="checkbox" className="mt-0.5" checked={s.brand.lockColor} disabled={!s.ready} onChange={(e) => void s.update({ lockColor: e.target.checked })} />
            <span>
              <span className="block text-[13px] font-semibold">Khoá màu ảnh</span>
              <span className="block text-[11.5px]" style={muted}>
                {LOCK_DESC}
              </span>
            </span>
          </label>
        ) : (
          <Switch checked={s.brand.lockColor} disabled={!s.ready} onChange={(v) => void s.update({ lockColor: v })} label="Khoá màu ảnh" desc={LOCK_DESC} />
        )}
        {s.err ? (
          <p className="text-[12px] font-medium" style={{ color: "var(--rd, var(--danger))" }}>
            {s.err}
          </p>
        ) : s.saving ? (
          <p className="text-[12px]" style={muted}>
            Đang lưu…
          </p>
        ) : null}
      </div>
    </div>
  );
}
