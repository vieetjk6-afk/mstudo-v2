"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { Badge, Section, btn } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";

/* ═══════════════════════════════════════════════════════════════════════════
   GHÉP LAYOUT ẢNH — thẻ ở tab Giao khách của album (phía studio).

   • Album LẺ (không thuộc hợp đồng): công tắc ngay tại đây — cột
     albums.collage_enabled, MẶC ĐỊNH BẬT.
   • Album thuộc hợp đồng: công tắc nằm ở hợp đồng (tab Sản phẩm); thẻ này chỉ
     báo đang bật / tắt và dẫn sang đó — hai chỗ cùng sửa một việc là rối.
   • Gói thấp hơn Photographer Plus: thẻ mờ kèm lời mời nâng gói.
   Luật đầy đủ ở src/lib/collage/enabled.ts.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AlbumCollageInfo = {
  /** Gói của studio có tính năng này (planAllowsCollage). */
  allowed: boolean;
  /** Album thuộc hợp đồng → công tắc ở hợp đồng. */
  contractId: string | null;
  /** Công tắc của hợp đồng; null = cột chưa có. */
  contractEnabled: boolean | null;
  /** Công tắc của album lẻ; null = cột chưa có (chưa chạy SQL). */
  albumEnabled: boolean | null;
};

const MISSING = "Cần cập nhật cơ sở dữ liệu: mở /api/setup-sql/ghep-layout (đăng nhập tài khoản chủ studio), chép toàn bộ rồi chạy trong Supabase SQL Editor.";
const DESC = "Album giao khách có thêm thẻ “Ghép ảnh”: khách chọn ảnh, nhập lời muốn viết — máy tự ghép nhiều layout để tải về đăng Facebook, Instagram, Story. Chỉ dùng ảnh studio đã giao.";
const LOOSE_NOTE = "Album lẻ không có SĐT cô dâu / chú rể để xác nhận, nên ai mở được album (qua mật khẩu nếu có) đều ghép được.";

function useAlbumCollage(albumId: string, info: AlbumCollageInfo) {
  const [on, setOn] = useState(info.albumEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(info.albumEnabled === null && !info.contractId && info.allowed ? MISSING : null);
  async function flip(next: boolean) {
    setSaving(true);
    setErr(null);
    const { error } = await createClient().from("albums").update({ collage_enabled: next }).eq("id", albumId);
    setSaving(false);
    if (error) {
      setErr(isMissingColumn(error, "collage_enabled") ? MISSING : error.message);
      return;
    }
    setOn(next);
  }
  return { on, saving, err, flip };
}

/** Bản giao diện mới (DeliverTabV2). */
export function AlbumCollageCardV2({ albumId, info }: { albumId: string; info: AlbumCollageInfo }) {
  const t = useAlbumCollage(albumId, info);
  const status = !info.allowed ? null : info.contractId ? (
    info.contractEnabled === null ? <Badge tone="amber" dot>Chưa cập nhật DB</Badge> : info.contractEnabled ? <Badge tone="green" dot>Đang bật</Badge> : <Badge tone="gray" dot>Đang tắt</Badge>
  ) : t.on && !t.err ? (
    <Badge tone="green" dot>Đang bật</Badge>
  ) : (
    <Badge tone="gray" dot>Đang tắt</Badge>
  );
  return (
    <Section icon={LayoutGrid} title="Ghép ảnh đăng mạng xã hội" desc={DESC} actions={status}>
      {!info.allowed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx3)" }}>
            Có ở gói Photographer Plus và Studio.
          </p>
          <Link href="/dashboard/upgrade" className={btn("secondary", "sm")}>
            <Lock size={14} /> Nâng gói
          </Link>
        </div>
      ) : info.contractId ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx2)" }}>
            Album này thuộc hợp đồng — bật / tắt ở hợp đồng, tab Sản phẩm.
          </p>
          <Link href={`/dashboard/studio/contracts/${info.contractId}?tab=album`} className={btn("secondary", "sm")}>
            Mở hợp đồng <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Switch checked={t.on && info.albumEnabled !== null} disabled={t.saving} onChange={(v) => void t.flip(v)} label="Cho khách ghép layout ảnh" desc={LOOSE_NOTE} />
          {t.err ? (
            <p className="text-[12px] font-medium" style={{ color: "var(--rd)" }}>
              {t.err}
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

/** Bản giao diện cũ (AlbumEditorV1). */
export function AlbumCollageCardV1({ albumId, info }: { albumId: string; info: AlbumCollageInfo }) {
  const t = useAlbumCollage(albumId, info);
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}>
          <LayoutGrid size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Ghép ảnh đăng mạng xã hội</p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text2)" }}>
            {DESC}
          </p>
          {!info.allowed ? (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--text3)" }}>
              Có ở gói Photographer Plus và Studio.{" "}
              <Link href="/dashboard/upgrade" style={{ color: "var(--gold)" }}>
                Nâng gói
              </Link>
            </p>
          ) : info.contractId ? (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--text2)" }}>
              Album này thuộc hợp đồng ({info.contractEnabled === false ? "đang tắt" : "đang bật"}) — bật / tắt ở{" "}
              <Link href={`/dashboard/studio/contracts/${info.contractId}`} style={{ color: "var(--gold)" }}>
                hợp đồng
              </Link>
              .
            </p>
          ) : (
            <label className="mt-2 flex items-start gap-2.5">
              <input type="checkbox" className="mt-0.5" checked={t.on && info.albumEnabled !== null} disabled={t.saving} onChange={(e) => void t.flip(e.target.checked)} />
              <span>
                <span className="block text-[13px] font-semibold">Cho khách ghép layout ảnh</span>
                <span className="block text-[11.5px]" style={{ color: "var(--text3)" }}>
                  {LOOSE_NOTE}
                </span>
              </span>
            </label>
          )}
          {t.err ? (
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--danger)" }}>
              {t.err}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
