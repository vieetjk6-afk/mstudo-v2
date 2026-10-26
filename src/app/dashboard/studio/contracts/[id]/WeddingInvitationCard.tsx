"use client";

import { useEffect, useState } from "react";
import { Heart, Copy, Check, ExternalLink, Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumn } from "@/lib/missing-column";
import { thiepUrl } from "@/lib/hosts";
import { weddingEditMessage } from "@/lib/share-messages";
import MessengerButton from "@/components/MessengerButton";
import type { WeddingConfig } from "@/lib/types";

function slugify(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "le-cuoi"}-${Math.random().toString(36).slice(2, 7)}`;
}

type Existing = { slug: string; edit_token: string; published: boolean } | null;

/**
 * Studio-side card on a contract: create the free online wedding invitation
 * (a draft prefilled from the contract) and share the client's edit link.
 *
 * Chưa có thiệp thì card còn một công tắc "tự tặng": khoảng một tháng trước ngày
 * cưới, việc tự động `gift_invitation` (src/lib/automations.ts) tự tạo thiệp và
 * gửi khách link sửa. Gói phóng sự cưới bật sẵn; studio bật/tắt riêng từng hợp
 * đồng (cột `studio_contracts.gift_invitation`).
 *
 * Chế độ Quà cưới (`combo`): khách sửa thiệp ngay trong trang kế hoạch cưới, và
 * thiệp tự có khi khách mở trang đó lần đầu — link gửi khách nằm ở thẻ Kế hoạch
 * cưới, thẻ này chỉ còn link xem thiệp và lối vào trình sửa cho studio.
 */
export type WeddingInvitationProps = {
  contract: { id: string; owner_id: string; title: string; event_date: string | null; location: string | null };
  clientName: string;
  clientMessenger: string;
  /** Lựa chọn riêng của hợp đồng: true tặng, false không tặng, null/undefined theo gói. */
  giftInvitation?: boolean | null;
  /** Hợp đồng là gói phóng sự cưới (mặc định được tặng). */
  reportage: boolean;
  /** Chế độ Quà cưới: thiệp nằm trong trang kế hoạch cưới của khách. */
  combo?: boolean;
};

/** Logic thẻ thiệp cưới online — dùng chung cho bản cũ và WeddingInvitationCardV2. */
export function useWeddingInvitation({ contract, clientName, giftInvitation, reportage }: WeddingInvitationProps) {
  const supabase = createClient();
  const [inv, setInv] = useState<Existing>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<"edit" | "view" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gift, setGift] = useState<boolean | null>(giftInvitation ?? null);
  const [savingGift, setSavingGift] = useState(false);
  const autoOn = gift ?? reportage;

  /**
   * Bật/tắt tự tặng cho hợp đồng này. Chọn trùng với mặc định của gói thì lưu
   * null ("theo gói") chứ không đóng đinh true/false — đổi gói sau này là theo.
   */
  async function toggleGift() {
    const next = !autoOn;
    const value = next === reportage ? null : next;
    setSavingGift(true);
    setErr(null);
    const { error } = await supabase.from("studio_contracts").update({ gift_invitation: value }).eq("id", contract.id);
    setSavingGift(false);
    if (error) {
      setErr(
        isMissingColumn(error, "gift_invitation")
          ? "Cần cập nhật cơ sở dữ liệu (chạy supabase/cap-nhat.sql) để lưu lựa chọn này."
          : error.message,
      );
      return;
    }
    setGift(value);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("wedding_invitations")
        .select("slug, edit_token, published")
        .eq("contract_id", contract.id)
        .maybeSingle();
      setInv((data as Existing) ?? null);
      setLoading(false);
    })().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.id]);

  async function create() {
    setCreating(true);
    setErr(null);
    const config: WeddingConfig = {
      wedding_date: contract.event_date ?? undefined,
      rsvp_enabled: true,
      events: contract.event_date || contract.location
        ? [{ label: "Tiệc cưới", date: contract.event_date ?? undefined, venue: contract.location ?? undefined }]
        : [],
    };
    const { data, error } = await supabase
      .from("wedding_invitations")
      .insert({
        owner_id: contract.owner_id,
        contract_id: contract.id,
        slug: slugify(clientName || contract.title),
        edit_token: (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, ""),
        config,
      })
      .select("slug, edit_token, published")
      .single();
    setCreating(false);
    if (error || !data) { setErr(error?.message || "Không tạo được thiệp."); return; }
    setInv(data as Existing);
  }

  const editUrl = inv ? thiepUrl(`/sua/${inv.edit_token}`) : "";
  const viewUrl = inv ? thiepUrl(`/${inv.slug}`) : "";

  function copy(text: string, key: "edit" | "view") {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return { inv, loading, creating, copied, err, savingGift, autoOn, toggleGift, create, editUrl, viewUrl, copy };
}

export default function WeddingInvitationCard(props: WeddingInvitationProps) {
  const { clientMessenger, reportage, combo = false } = props;
  const { inv, loading, creating, copied, err, savingGift, autoOn, toggleGift, create, editUrl, viewUrl, copy } = useWeddingInvitation(props);

  if (loading) return null;

  return (
    <div className="card mb-6 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Heart size={16} style={{ color: "#d96e8f" }} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>
            🎁 Thiệp cưới online tặng khách
          </p>
          <p className="text-sm" style={{ color: "var(--text2)" }}>
            {combo
              ? inv
                ? "Khách sửa thiệp ngay trong trang Quà cưới — gửi link ở thẻ Kế hoạch cưới phía trên."
                : "Thiệp tự tạo khi khách mở trang Quà cưới lần đầu (gửi link ở thẻ Kế hoạch cưới phía trên)."
              : inv
                ? "Gửi link bên dưới để khách tự chỉnh sửa thiệp cưới của mình."
                : "Tạo thiệp cưới online miễn phí — khách tự điền nội dung & ảnh, chia sẻ cho quan khách."}
          </p>
        </div>
        {!inv && (
          <button onClick={create} disabled={creating} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />} Tạo thiệp cưới
          </button>
        )}
      </div>

      {!inv && (
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 border-t pt-3 text-[12.5px]" style={{ borderColor: "var(--border)" }}>
          <input type="checkbox" className="mt-0.5" checked={autoOn} disabled={savingGift} onChange={toggleGift} />
          <span>
            <span className="font-semibold" style={{ color: "var(--text1, var(--text))" }}>
              {combo
                ? "Khách chưa mở Quà cưới thì khoảng 1 tháng trước ngày cưới tự tạo thiệp & gửi link Quà cưới"
                : "Tự tạo & gửi thiệp cho khách khoảng 1 tháng trước ngày cưới"}
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed" style={{ color: "var(--text3)" }}>
              {reportage
                ? "Gói phóng sự cưới — được tặng sẵn. Bỏ chọn nếu không muốn tặng hợp đồng này."
                : "Gói này không phải phóng sự cưới — chọn để tặng thiệp cho khách."}{" "}
              Gửi link sửa qua Zalo, chưa nối Zalo thì gửi email. Đổi số ngày hoặc tắt cho mọi hợp đồng ở Dịch vụ → Việc tự động.
            </span>
          </span>
        </label>
      )}

      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

      {inv && (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {/* Edit link (for the client) */}
          {combo ? (
            <div className="flex flex-wrap items-center gap-2">
              <Pencil size={13} style={{ color: "var(--text3)" }} />
              <span className="min-w-0 flex-1 text-sm" style={{ color: "var(--text2)" }}>Khách sửa trong trang Quà cưới</span>
              <a href={editUrl} target="_blank" rel="noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs">
                <ExternalLink size={13} /> Mở trình sửa
              </a>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Pencil size={13} style={{ color: "var(--text3)" }} />
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text2)" }}>{editUrl}</span>
              <MessengerButton
                link={clientMessenger}
                label="Gửi khách sửa"
                message={weddingEditMessage(editUrl)}
              />
              <button onClick={() => copy(weddingEditMessage(editUrl), "edit")} className="btn-ghost px-2.5 py-1.5 text-xs">
                {copied === "edit" ? <Check size={13} /> : <Copy size={13} />} {copied === "edit" ? "Đã chép lời nhắn" : "Chép link sửa kèm lời nhắn"}
              </button>
            </div>
          )}
          {/* Public link */}
          <div className="flex flex-wrap items-center gap-2">
            <ExternalLink size={13} style={{ color: "var(--text3)" }} />
            <a href={viewUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm underline" style={{ color: "var(--text2)" }}>{viewUrl}</a>
            <span className="text-[11px]" style={{ color: inv.published ? "#7bb38a" : "var(--text3)" }}>
              {inv.published ? "Đang hiển thị" : "Chưa xuất bản"}
            </span>
            <button onClick={() => copy(viewUrl, "view")} className="btn-ghost px-2.5 py-1.5 text-xs">
              {copied === "view" ? <Check size={13} /> : <Copy size={13} />} {copied === "view" ? "Đã chép" : "Chép link xem"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
