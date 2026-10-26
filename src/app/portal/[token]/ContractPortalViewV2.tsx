"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CloudOff, FileText, LogOut, Phone } from "lucide-react";
import { useToast } from "@/components/studio/Toast";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, Stack, btn, iconBtn } from "@/components/v2/kit";
import { Menu, type MenuItem } from "@/components/v2/kit-client";
import { snapshotAge } from "@/lib/portal-device";
import { todayVN } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import { contractTotal, sumAmounts } from "@/lib/types";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import AlbumViewV2, { type AlbumTabV2 } from "./AlbumViewV2";
import PaymentPanelV2, { PaymentQrModalV2 } from "./PaymentPanelV2";
import PortalHomeV2 from "./PortalHomeV2";
import {
  PORTAL_TAB_DEF, PORTAL_TAB_HASH, PortalGateV2, PortalLoadingV2, PortalTabBarV2, PortalTopTabsV2, type PortalTabKey,
} from "./PortalShellV2";
import type { GridPhoto } from "./PortalPhotoGrid";
import type { PortalPayload } from "./types";
import { forgetThisDevice, usePortalPayment, usePortalSession } from "./usePortal";

/* ═══════════════════════════════════════════════════════════════════════════
   CỔNG KHÁCH HÀNG — giao diện mới (/portal/<token>, khi customerUiV2 bật).

   Cùng cổng SĐT, cùng endpoint, cùng thao tác với ContractPortalView (logic ở
   ./usePortal). Khác ở cách sắp xếp, viết cho điện thoại trước:
     • Đầu trang thương hiệu studio; gọi studio + menu ⋯ (bản hợp đồng, thoát
       máy này) ở góc phải.
     • Bốn phần: Tổng quan · Thanh toán · Ảnh & video · Kế hoạch cưới (link sang
       /ke-hoach, chỉ khi hợp đồng có). Điện thoại: thanh tab đáy; máy tính:
       thanh tab dính dưới đầu trang. Tab nằm trên URL (#thanh-toan, #anh-video)
       để trang kế hoạch mở đúng tab.
     • Hợp đồng hoàn thành: mở thẳng phần Ảnh & video (bản cũ đổi hẳn sang
       trang album nền tối).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractPortalViewV2({ token, brand }: { token: string; brand: StudioBrandInfo }) {
  const s = usePortalSession(token);
  const { theme } = useTheme();

  if (!s.data) {
    if (s.autoTrying) return <PortalLoadingV2 brand={brand} theme={theme} text="Đang mở trang của bạn…" />;
    return (
      <PortalGateV2
        brand={brand}
        theme={theme}
        title="Trang hợp đồng của bạn"
        desc="Nhập số điện thoại đã đăng ký để xem lịch trình, thanh toán và sản phẩm."
        phone={s.phone}
        setPhone={s.setPhone}
        err={s.err}
        loading={s.loading}
        onSubmit={s.unlock}
        submitLabel="Mở trang của tôi"
        note="Máy này sẽ nhớ số của bạn trong 90 ngày để lần sau mở thẳng vào trang."
        footer={
          <Link href={`/c/${token}`} className={btn("ghost")}>
            <FileText size={16} /> Xem bản hợp đồng đầy đủ
          </Link>
        }
      />
    );
  }

  return <PortalAppV2 token={token} phone={s.unlocked} data={s.data} staleAt={s.staleAt} brand={brand} />;
}

/** Phần thân sau khi đã mở khoá — /uipreview dựng thẳng bằng dữ liệu giả. */
export function PortalAppV2({
  token, phone, data, staleAt, brand, initialTab, albumTab, imgSrc,
}: {
  token: string;
  phone: string;
  data: PortalPayload;
  /** Mốc (ms) của bản chụp đang đọc khi mất mạng; `null` = dữ liệu vừa lấy. */
  staleAt: number | null;
  brand: StudioBrandInfo;
  /** Chỉ màn xem trước: tab mở sẵn. */
  initialTab?: Exclude<PortalTabKey, "plan">;
  albumTab?: AlbumTabV2;
  imgSrc?: (p: GridPhoto, w: number) => string;
}) {
  const { theme } = useTheme();
  const { toast, toastNode } = useToast();
  const c = data.contract;
  const today = todayVN();
  const total = useMemo(() => contractTotal(data.items), [data.items]);
  const paid = useMemo(() => sumAmounts(data.payments), [data.payments]);
  const pay = usePortalPayment({ token, phone, total, paid, plan: data.plan, contractCode: c.code, toast });
  const completed = c.status === "completed";

  type Tab = Exclude<PortalTabKey, "plan">;
  const [tab, setTab] = useState<Tab>(() => initialTab ?? (completed ? "media" : "home"));

  // Mở bằng link có phần băm (#thanh-toan, #anh-video — tab đáy ở trang kế
  // hoạch) → vào đúng tab đó.
  useEffect(() => {
    if (initialTab) return;
    const h = window.location.hash;
    const hit = (Object.keys(PORTAL_TAB_HASH) as Tab[]).find((k) => PORTAL_TAB_HASH[k] && PORTAL_TAB_HASH[k] === h);
    if (hit) setTab(hit);
  }, [initialTab]);

  const go = useCallback((t: PortalTabKey) => {
    if (t === "plan") return;
    setTab(t);
    const h = PORTAL_TAB_HASH[t];
    window.history.replaceState(null, "", h || window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
  }, []);

  const b: StudioBrandInfo = { name: data.studio_name || brand.name, logoUrl: data.studio_logo ?? brand.logoUrl };
  const plannerHref = `/portal/${token}/ke-hoach`;

  const tabs: { key: PortalTabKey; label: string; short: string; icon: typeof PORTAL_TAB_DEF.home.icon; href?: string }[] = [
    { key: "home", ...PORTAL_TAB_DEF.home },
    { key: "pay", ...PORTAL_TAB_DEF.pay },
    { key: "media", ...PORTAL_TAB_DEF.media },
    ...(data.planner
      ? [{ key: "plan" as const, ...PORTAL_TAB_DEF.plan, label: data.planner.combo ? "Quà cưới" : PORTAL_TAB_DEF.plan.label, short: data.planner.combo ? "Quà cưới" : PORTAL_TAB_DEF.plan.short, href: plannerHref }]
      : []),
  ];

  const menu: MenuItem[] = [
    { label: "Bản hợp đồng đầy đủ", icon: FileText, href: `/c/${token}`, hint: c.client_signed_at ? "Đã ký" : "Mở để xem và ký" },
    ...(data.studio_phone
      ? [{ label: `Gọi ${data.studio_name}`, icon: Phone, hint: data.studio_phone, onClick: () => { window.location.href = `tel:${data.studio_phone}`; } }]
      : []),
    "divider",
    // Máy dùng chung (máy tính nhà, điện thoại đưa người khác xem ảnh): phải
    // có đường xoá số đã nhớ + bản chụp dữ liệu trên máy này.
    { label: "Thoát máy này", icon: LogOut, hint: "Xoá số điện thoại đã nhớ và bản lưu trên máy này", onClick: () => forgetThisDevice(token) },
  ];

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={b}
        sub={c.client_name ? `Trang của ${c.client_name}` : "Trang hợp đồng của bạn"}
        right={
          <>
            {data.studio_phone && (
              <a href={`tel:${data.studio_phone}`} className={iconBtn()} aria-label="Gọi studio" title={`Gọi ${data.studio_phone}`}>
                <Phone size={18} />
              </a>
            )}
            <Menu items={menu} width={250} />
          </>
        }
      />

      {/* Máy tính: thanh tab dính ngay dưới đầu trang. */}
      <div className="sticky top-[60px] z-20 hidden md:block" style={{ background: "var(--bg)" }}>
        <div className="mx-auto w-full max-w-[1080px] px-4">
          <PortalTopTabsV2
            items={tabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon, href: t.href, active: t.key === tab, onClick: t.href ? undefined : () => go(t.key) }))}
          />
        </div>
      </div>

      <CustomerMainV2>
        <Stack>
          {/* Đang đọc bản lưu (mất mạng) — không được im lặng: số tiền còn nợ
              trên một bản chụp cũ phải nói rõ là cũ bao lâu. */}
          {staleAt !== null && (
            <Callout
              tone="amber"
              icon={CloudOff}
              title="Đang mất mạng"
              action={<button type="button" onClick={() => location.reload()} className={btn("secondary", "sm")}>Thử lại</button>}
            >
              Bạn đang xem bản lưu {snapshotAge(staleAt, Date.now())}. Số liệu có thể đã thay đổi.
            </Callout>
          )}

          {tab === "home" && <PortalHomeV2 token={token} data={data} today={today} pay={pay} go={go} />}
          {tab === "pay" && (
            <PaymentPanelV2 pay={pay} total={total} paid={paid} plan={data.plan} payments={data.payments} bank={data.bank} studioName={data.studio_name} today={today} />
          )}
          {tab === "media" && <AlbumViewV2 token={token} phone={phone} data={data} toast={toast} initialTab={albumTab} imgSrc={imgSrc} />}
        </Stack>
      </CustomerMainV2>

      <PortalTabBarV2
        items={tabs.map((t) => ({ key: t.key, label: t.short, icon: t.icon, href: t.href, active: t.key === tab, onClick: t.href ? undefined : () => go(t.key) }))}
      />
      <PaymentQrModalV2 pay={pay} bank={data.bank} />
      {toastNode}
    </CustomerRootV2>
  );
}
