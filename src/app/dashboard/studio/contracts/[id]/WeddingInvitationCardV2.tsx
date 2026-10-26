"use client";

import { Check, Copy, ExternalLink, Heart, Loader2, Pencil } from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import { Badge, Callout, btn } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { weddingEditMessage } from "@/lib/share-messages";
import { useWeddingInvitation, type WeddingInvitationProps } from "./WeddingInvitationCard";
import { GiftBlock, LinkRow } from "./ContractV2Shared";

/* Thiệp cưới online tặng khách — giao diện mới (khối Quà tặng, tab Sản phẩm).
   Cùng logic với thẻ bản cũ (useWeddingInvitation); "tự tặng" là công tắc. */
export default function WeddingInvitationCardV2(props: WeddingInvitationProps) {
  const { clientMessenger, reportage, combo = false } = props;
  const w = useWeddingInvitation(props);
  if (w.loading) return null;
  const { inv } = w;

  return (
    <GiftBlock
      icon={Heart}
      tone="red"
      title="Thiệp cưới online tặng khách"
      badge={
        inv ? (
          <Badge tone={inv.published ? "green" : "gray"} dot>
            {inv.published ? "Đang hiển thị" : "Chưa xuất bản"}
          </Badge>
        ) : w.autoOn ? (
          <Badge tone="blue">Tự tặng</Badge>
        ) : undefined
      }
      desc={
        combo
          ? inv
            ? "Khách sửa thiệp ngay trong trang Quà cưới — gửi link ở thẻ Kế hoạch cưới phía trên."
            : "Thiệp tự tạo khi khách mở trang Quà cưới lần đầu (gửi link ở thẻ Kế hoạch cưới phía trên)."
          : inv
            ? "Gửi link bên dưới để khách tự chỉnh sửa thiệp cưới của mình."
            : "Tạo thiệp cưới online miễn phí — khách tự điền nội dung & ảnh, chia sẻ cho quan khách."
      }
      action={
        !inv ? (
          <button type="button" onClick={w.create} disabled={w.creating} className={btn("secondary", "sm")}>
            {w.creating ? <Loader2 size={15} className="animate-spin" /> : <Heart size={15} />} Tạo thiệp cưới
          </button>
        ) : undefined
      }
    >
      {!inv && (
        <div className="rounded-[12px] px-3 py-1" style={{ background: "var(--sf2)" }}>
          <Switch
            checked={w.autoOn}
            disabled={w.savingGift}
            onChange={() => w.toggleGift()}
            label={
              combo
                ? "Khách chưa mở Quà cưới thì khoảng 1 tháng trước ngày cưới tự tạo thiệp & gửi link Quà cưới"
                : "Tự tạo & gửi thiệp cho khách khoảng 1 tháng trước ngày cưới"
            }
            desc={`${
              reportage
                ? "Gói phóng sự cưới — được tặng sẵn. Tắt nếu không muốn tặng hợp đồng này."
                : "Gói này không phải phóng sự cưới — bật để tặng thiệp cho khách."
            } Gửi link sửa qua Zalo, chưa nối Zalo thì gửi email. Đổi số ngày hoặc tắt cho mọi hợp đồng ở Dịch vụ → Việc tự động.`}
          />
        </div>
      )}
      {w.err && <Callout tone="red">{w.err}</Callout>}
      {inv && (
        <>
          {combo ? (
            <LinkRow icon={Pencil} label="Khách sửa trong trang Quà cưới" url={w.editUrl}>
              <a href={w.editUrl} target="_blank" rel="noreferrer" className={btn("secondary", "sm")}>
                <ExternalLink size={15} /> Mở trình sửa
              </a>
            </LinkRow>
          ) : (
            <LinkRow icon={Pencil} label="Link cho khách sửa" url={w.editUrl}>
              <MessengerButton link={clientMessenger} label="Gửi khách sửa" message={weddingEditMessage(w.editUrl)} className={btn("secondary", "sm")} />
              <button type="button" onClick={() => w.copy(weddingEditMessage(w.editUrl), "edit")} className={btn("ghost", "sm")}>
                {w.copied === "edit" ? <Check size={15} style={{ color: "var(--gn)" }} /> : <Copy size={15} />} {w.copied === "edit" ? "Đã chép" : "Chép kèm lời nhắn"}
              </button>
            </LinkRow>
          )}
          <LinkRow icon={ExternalLink} label="Link xem thiệp" url={w.viewUrl} href={w.viewUrl}>
            <button type="button" onClick={() => w.copy(w.viewUrl, "view")} className={btn("ghost", "sm")}>
              {w.copied === "view" ? <Check size={15} style={{ color: "var(--gn)" }} /> : <Copy size={15} />} {w.copied === "view" ? "Đã chép" : "Chép link xem"}
            </button>
          </LinkRow>
        </>
      )}
    </GiftBlock>
  );
}
