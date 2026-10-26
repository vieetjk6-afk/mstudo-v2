"use client";

import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { todayVN } from "@/lib/date";
import WeddingEditor from "@/app/thiep/sua/[token]/WeddingEditor";
import PlannerView from "./PlannerView";
import { useWeddingPlanner } from "./usePlanner";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI — trang thật: cổng SĐT, tải dữ liệu, lưu từng thao tác.

   Cổng SĐT giống hệt /portal/<token> và dùng chung số đã nhớ trên máy: khách
   bấm từ trang hợp đồng sang thì vào thẳng, không phải gõ lại số.

   Lưu: mỗi thao tác hiện NGAY (áp `applyPlanOp` lên bản máy chủ), rồi gửi lên
   lần lượt từng cái một. Gửi song song thì phản hồi về lệch thứ tự và bản cũ
   đè lên bản mới. Mỗi phản hồi là bản máy chủ mới nhất; các thao tác còn chờ
   được áp lại lên trên nó — nên hai máy cùng sửa vẫn thấy việc của nhau.

   Chế độ Quà cưới: thiệp cưới sửa NGAY trong trang này — "#thiep" thay cả
   trang bằng trình sửa thiệp (cùng trình sửa của /thiep/sua/<mã>, chạy chế độ
   nhúng). Nút quay lại của trình duyệt đưa về kế hoạch; link "#thiep" gửi khách
   (luật tự tặng thiệp) mở thẳng vào thiệp.
   ═══════════════════════════════════════════════════════════════════════════ */

const card: React.CSSProperties = { background: "var(--sf)", border: "1px solid var(--bd)" };

export default function WeddingPlanner({ token }: { token: string }) {
  // Cổng SĐT, hàng đợi lưu, trình sửa thiệp nhúng — dùng chung với bản giao
  // diện mới (./usePlanner).
  const {
    phone, setPhone, data, plan, err, loading, autoTrying, saving, toastNode, view, returnTab,
    unlock, onOp, openInvite, closeInvite, onEditorDirty, setTab,
  } = useWeddingPlanner(token);

  if (!data || !plan) {
    if (autoTrying) {
      return (
        <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
          <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Đang mở kế hoạch cưới của bạn…</p>
        </div>
      );
    }
    return (
      <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
        <form onSubmit={unlock} className="w-full max-w-[400px] rounded-[16px] px-7 py-8 text-center" style={card}>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <CalendarHeart size={21} />
          </span>
          <h1 className="mt-3.5 text-[21px] font-bold" style={{ letterSpacing: "-.5px" }}>Kế hoạch cưới của bạn</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
            Nhập số điện thoại đã đăng ký với studio để mở việc cần làm, ngân sách và lịch trình ngày cưới.
          </p>
          <input
            className="mt-5 w-full rounded-[11px] px-3.5 py-3 text-center text-[15px] font-semibold tracking-wide"
            style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
            inputMode="numeric"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {err && <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-3.5 w-full rounded-[11px] py-3 text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            {loading ? "Đang mở…" : "Mở kế hoạch cưới"}
          </button>
          <Link href={`/portal/${token}`} className="mt-3 block text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            ← Trang hợp đồng của bạn
          </Link>
        </form>
      </div>
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
      <PlannerView
        data={data}
        plan={plan}
        today={todayVN()}
        backHref={`/portal/${token}`}
        onOp={onOp}
        saving={saving}
        initialTab={returnTab}
        onTab={setTab}
        onOpenInvite={data.combo && data.invite ? openInvite : undefined}
      />
      {toastNode}
    </>
  );
}
