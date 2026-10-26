"use client";

import { Check, Clapperboard, Copy, ExternalLink, Loader2, Pencil } from "lucide-react";
import MessengerButton from "@/components/MessengerButton";
import { Badge, Callout, btn } from "@/components/v2/kit";
import { storyEditMessage } from "@/lib/share-messages";
import { useLoveStory, type LoveStoryProps } from "./LoveStoryCard";
import { GiftBlock, LinkRow } from "./ContractV2Shared";

/* Love Story tặng khách — giao diện mới (khối Quà tặng, tab Sản phẩm). Cùng
   logic với thẻ bản cũ (useLoveStory). */
export default function LoveStoryCardV2(props: LoveStoryProps) {
  const { clientMessenger, comingSoon = false } = props;
  const s = useLoveStory(props);

  if (comingSoon)
    return (
      <GiftBlock
        icon={Clapperboard}
        tone="violet"
        title="Trang Love Story tặng khách"
        badge={<Badge tone="brand">Sắp ra mắt</Badge>}
        desc="Tính năng đang được hoàn thiện, sẽ sớm có mặt."
        muted
      />
    );
  if (s.loading) return null;
  const { row } = s;

  return (
    <GiftBlock
      icon={Clapperboard}
      tone="violet"
      title="Trang Love Story tặng khách"
      badge={row ? <Badge tone={row.published ? "green" : "gray"} dot>{row.published ? "Đang hiển thị" : "Chưa xuất bản"}</Badge> : undefined}
      desc={
        row
          ? "Gửi link để khách tự điền nội dung & dán folder ảnh/video Google Drive của họ."
          : "Tạo trang chia sẻ khoảnh khắc — ảnh/video lấy từ Drive của khách, kèm sổ lời chúc."
      }
      action={
        !row ? (
          <button type="button" onClick={s.create} disabled={s.creating} className={btn("secondary", "sm")}>
            {s.creating ? <Loader2 size={15} className="animate-spin" /> : <Clapperboard size={15} />} Tạo Love Story
          </button>
        ) : undefined
      }
    >
      {s.err && <Callout tone="red">{s.err}</Callout>}
      {row && (
        <>
          <LinkRow icon={Pencil} label="Link cho khách sửa" url={s.editUrl}>
            <MessengerButton link={clientMessenger} label="Gửi khách sửa" message={storyEditMessage(s.editUrl)} className={btn("secondary", "sm")} />
            <button type="button" onClick={() => s.copy(storyEditMessage(s.editUrl), "edit")} className={btn("ghost", "sm")}>
              {s.copied === "edit" ? <Check size={15} style={{ color: "var(--gn)" }} /> : <Copy size={15} />} {s.copied === "edit" ? "Đã chép" : "Chép kèm lời nhắn"}
            </button>
          </LinkRow>
          <LinkRow icon={ExternalLink} label="Link xem" url={s.viewUrl} href={s.viewUrl}>
            <button type="button" onClick={() => s.copy(s.viewUrl, "view")} className={btn("ghost", "sm")}>
              {s.copied === "view" ? <Check size={15} style={{ color: "var(--gn)" }} /> : <Copy size={15} />} {s.copied === "view" ? "Đã chép" : "Chép link xem"}
            </button>
          </LinkRow>
        </>
      )}
    </GiftBlock>
  );
}
