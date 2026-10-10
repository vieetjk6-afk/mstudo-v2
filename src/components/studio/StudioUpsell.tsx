import Link from "next/link";
import { Crown, Gift, ExternalLink, type LucideIcon } from "lucide-react";
import { getProfileById, getSessionUser } from "@/lib/auth-guards";
import { effectivePlan, PLAN_LABEL } from "@/lib/plans";
import { ALBUMAI_GIFT_YEARS, ALBUMAI_HOST_LABEL, ALBUMAI_URL } from "@/lib/albumai";

/**
 * Màn MỜI NÂNG CẤP cho tính năng chỉ gói Studio có (thiết kế album, slide ảnh,
 * thiệp…). Hiện khi requireStudio() trả null — tức người dùng gói khác bấm vào
 * mục menu mang nhãn "Studio" (studio-nav `upsellFrom`) hoặc mở thẳng URL.
 *
 * Nói rõ ba điều: tính năng này cần gói Studio, gói hiện tại là gói gì, và nâng
 * lên Studio được gì thêm (1 năm bản quyền Album AI). Nhân viên không tự nâng
 * gói được nên không đưa nút nâng cấp cho họ — chỉ bảo nhờ chủ studio.
 */
type UpsellProps = {
  icon: LucideIcon;
  /** Tên tính năng, vd "Thiết kế album". */
  feature: string;
  /** Một câu tính năng làm được gì. */
  desc: string;
};

export default async function StudioUpsell(props: UpsellProps) {
  const user = await getSessionUser();
  const me = user ? await getProfileById(user.id) : null;
  const isStaff = !!me?.studio_owner_id;
  const plan = me && !isStaff ? effectivePlan(me.plan, me.plan_expires_at) : null;
  return <StudioUpsellView {...props} isStaff={isStaff} planLabel={plan ? PLAN_LABEL[plan] : null} />;
}

/** Phần hiển thị thuần (không đọc phiên) — để /uipreview dựng được bằng dữ liệu giả. */
export function StudioUpsellView({
  icon: Icon,
  feature,
  desc,
  isStaff,
  planLabel,
}: UpsellProps & { isStaff: boolean; planLabel: string | null }) {
  return (
    <div className="mx-auto max-w-[560px] py-4" data-testid="studio-upsell">
      <div className="rounded-[16px] px-6 py-7 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-[16px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <Icon size={26} />
          <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--am)", color: "#fff", border: "2px solid var(--sf)" }}>
            <Crown size={12} />
          </span>
        </span>

        <p className="mt-4 text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--am)" }}>
          Tính năng gói Studio
        </p>
        <h1 className="mt-1 text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>
          Nâng cấp gói để dùng {feature}
        </h1>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-[1.6]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
          {desc}{" "}
          {isStaff ? (
            <>Studio của bạn chưa ở gói Studio — nhờ chủ studio nâng cấp để cả đội dùng được.</>
          ) : (
            <>
              Gói hiện tại{planLabel ? <> (<b style={{ color: "var(--tx)" }}>{planLabel}</b>)</> : null} chưa có tính năng này — nâng
              cấp lên <b style={{ color: "var(--tx)" }}>gói Studio</b> để sử dụng.
            </>
          )}
        </p>

        <div className="mx-auto mt-4 flex max-w-[440px] gap-2.5 rounded-[12px] px-3.5 py-3 text-left" style={{ background: "var(--acS)" }}>
          <Gift size={18} style={{ flex: "none", marginTop: 1, color: "var(--ac)" }} />
          <p className="text-[12.5px] leading-[1.55]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            Gói Studio được <b style={{ color: "var(--tx)" }}>tặng {ALBUMAI_GIFT_YEARS} năm bản quyền phần mềm Album AI</b> ({ALBUMAI_HOST_LABEL}) — thiết kế
            album &amp; slide ảnh bằng AI. Phần mềm đang trong giai đoạn phát triển.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {!isStaff && (
            <Link
              href="/dashboard/upgrade"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-[15px] py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Crown size={16} /> Nâng cấp lên Studio
            </Link>
          )}
          <a
            href={ALBUMAI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
          >
            <ExternalLink size={16} /> Tìm hiểu Album AI
          </a>
        </div>
      </div>
    </div>
  );
}
