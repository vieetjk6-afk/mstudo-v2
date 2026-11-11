"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { Switch } from "@/components/v2/kit-client";

/* ═══════════════════════════════════════════════════════════════════════════
   CÔNG TẮC "CHO KHÁCH GHÉP LAYOUT ẢNH" trên hợp đồng — cột
   studio_contracts.collage_enabled (migrations/ghep_layout.sql), MẶC ĐỊNH BẬT
   khi tạo hợp đồng. Bật thì album giao khách của hợp đồng có thẻ "Ghép ảnh đăng
   mạng xã hội": cô dâu / chú rể (xác nhận SĐT như chọn ảnh in) chọn ảnh, nhập
   lời muốn viết, máy ghép nhiều layout để tải về đăng Facebook / Instagram.

   Chỉ gói Photographer Plus / Studio: gói thấp hơn thấy công tắc mờ kèm lời mời
   nâng gói (album của họ không hiện phần ghép ảnh dù cột là true).
   ═══════════════════════════════════════════════════════════════════════════ */

const DESC = "Album giao khách có thêm “Ghép ảnh đăng mạng xã hội”: cô dâu, chú rể chọn ảnh, nhập lời muốn viết — máy tự ghép nhiều layout để sửa rồi tải về. Chỉ dùng ảnh studio đã giao.";
const MISSING = "Cần cập nhật cơ sở dữ liệu (chạy supabase/ghep-layout.sql) để lưu lựa chọn này.";

function useCollageToggle(contractId: string, initial: boolean | null | undefined) {
  // Cột chưa có (chưa chạy migration) hoặc null → mặc định của tính năng là BẬT.
  const [on, setOn] = useState(initial !== false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function flip(next: boolean) {
    setSaving(true);
    setErr(null);
    const { error } = await createClient().from("studio_contracts").update({ collage_enabled: next }).eq("id", contractId);
    setSaving(false);
    if (error) {
      setErr(isMissingColumn(error, "collage_enabled") ? MISSING : error.message);
      return;
    }
    setOn(next);
  }
  return { on, saving, err, flip };
}

type Props = {
  contractId: string;
  value?: boolean | null;
  /** Gói của studio có tính năng này không (tierAllowsCollage). */
  allowed: boolean;
};

/** Bản giao diện mới (tab Album của hợp đồng). */
export function CollageToggleV2({ contractId, value, allowed }: Props) {
  const t = useCollageToggle(contractId, value);
  return (
    <div className="rounded-[12px] px-3.5 py-3" style={{ border: "1px solid var(--bd)", opacity: allowed ? 1 : 0.75 }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <LayoutGrid size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <Switch
            checked={allowed && t.on}
            disabled={!allowed || t.saving}
            onChange={(v) => void t.flip(v)}
            label="Cho khách ghép layout ảnh"
            desc={DESC}
          />
          {!allowed ? (
            <p className="mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>
              Có ở gói Photographer Plus và Studio.{" "}
              <Link href="/dashboard/upgrade" className="font-semibold" style={{ color: "var(--ac)" }}>
                Nâng gói
              </Link>
            </p>
          ) : null}
          {t.err ? (
            <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--rd)" }}>
              {t.err}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Bản giao diện cũ (ContractEditor). */
export function CollageToggleV1({ contractId, value, allowed }: Props) {
  const t = useCollageToggle(contractId, value);
  return (
    <div>
      <label className="flex items-start gap-2.5" style={{ opacity: allowed ? 1 : 0.7 }}>
        <input
          type="checkbox"
          className="mt-0.5"
          checked={allowed && t.on}
          disabled={!allowed || t.saving}
          onChange={(e) => void t.flip(e.target.checked)}
        />
        <span>
          <span className="block text-[13px] font-semibold">Cho khách ghép layout ảnh đăng mạng xã hội</span>
          <span className="block text-[11px]" style={{ color: "var(--text3)" }}>
            {DESC}
            {!allowed ? " Có ở gói Photographer Plus và Studio." : ""}
          </span>
        </span>
      </label>
      {t.err ? (
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--danger)" }}>
          {t.err}
        </p>
      ) : null}
    </div>
  );
}
