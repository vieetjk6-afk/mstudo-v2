"use client";

import Link from "next/link";
import { ArrowLeft, CalendarHeart } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { todayVN } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import WeddingEditor from "@/app/thiep/sua/[token]/WeddingEditor";
import { PortalGateV2, PortalLoadingV2 } from "../PortalShellV2";
import PlannerViewV2 from "./PlannerViewV2";
import { useWeddingPlanner } from "./usePlanner";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI — trang thật, giao diện mới (/portal/<token>/ke-hoach khi
   customerUiV2 bật). Cùng cổng SĐT, cùng hàng đợi lưu, cùng trình sửa thiệp
   nhúng "#thiep" với WeddingPlanner (logic ở ./usePlanner) — chỉ khác phần vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WeddingPlannerV2({ token, brand }: { token: string; brand: StudioBrandInfo }) {
  const {
    phone, setPhone, data, plan, err, loading, autoTrying, saving, toastNode, view, returnTab,
    unlock, onOp, openInvite, closeInvite, onEditorDirty, setTab,
  } = useWeddingPlanner(token);
  const { theme } = useTheme();

  if (!data || !plan) {
    if (autoTrying) return <PortalLoadingV2 brand={brand} theme={theme} text="Đang mở kế hoạch cưới của bạn…" />;
    return (
      <PortalGateV2
        brand={brand}
        theme={theme}
        icon={CalendarHeart}
        title="Kế hoạch cưới của bạn"
        desc="Nhập số điện thoại đã đăng ký với studio để mở việc cần làm, ngân sách và lịch trình ngày cưới."
        phone={phone}
        setPhone={setPhone}
        err={err}
        loading={loading}
        onSubmit={unlock}
        submitLabel="Mở kế hoạch cưới"
        footer={
          <Link href={`/portal/${token}`} className={btn("ghost")}>
            <ArrowLeft size={16} /> Trang hợp đồng của bạn
          </Link>
        }
      />
    );
  }

  if (view === "invite" && data.combo && data.invite) {
    return (
      <>
        <WeddingEditor
          token={data.invite.token}
          embed={{
            onBack: () => closeInvite(),
            onOpenGuests: () => closeInvite("guests"),
            guestNames: plan.guests.map((g) => g.name),
            onDirty: onEditorDirty,
          }}
        />
        {toastNode}
      </>
    );
  }

  return (
    <>
      <PlannerViewV2
        data={data}
        plan={plan}
        today={todayVN()}
        backHref={`/portal/${token}`}
        onOp={onOp}
        saving={saving}
        initialTab={returnTab}
        onTab={setTab}
        onOpenInvite={data.combo && data.invite ? openInvite : undefined}
        brand={brand}
      />
      {toastNode}
    </>
  );
}
