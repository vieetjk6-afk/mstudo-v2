"use client";

import { AlertCircle, Check, Loader2, MessageCircle, Users } from "lucide-react";
import { Avatar, btn, inputCls } from "@/components/v2/kit";
import { PopLayer, SearchInput, popStyle, useAnchoredPop } from "@/components/v2/kit-client";
import { useZaloSend, type ZaloSendProps } from "./useZaloSend";

/* ═══════════════════════════════════════════════════════════════════════════
   NÚT "GỬI ZALO" — giao diện mới. Cùng logic với ZaloSendButton (./useZaloSend):
   gửi theo SĐT, nhập SĐT tay, chọn bạn Zalo, nhớ người nhận. Khác ở hình:
     • Không truyền `className` thì là nút phụ cỡ "sm" của bộ khối.
     • Chữ theo màu chữ thường; chỉ icon mang màu xanh (thông tin) — không còn
       chữ xanh mã cứng chen giữa hàng nút phụ.
     • Bảng chọn bạn dùng khung menu ⋯ + ô tìm của bộ khối.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ZaloSendButtonV2(props: ZaloSendProps) {
  const z = useZaloSend(props, btn("secondary", "sm"));
  const { state, show } = z;
  // Bảng chọn bạn nổi qua portal: nằm trong thẻ overflow-hidden / thân hộp thoại vẫn không bị cắt.
  const pos = useAnchoredPop(z.pickOpen, z.wrapRef, z.popRef, 280, "left");

  const icon =
    state === "sending" ? <Loader2 size={15} className="flex-none animate-spin" />
    : state === "ok" ? <Check size={15} className="flex-none" style={{ color: "var(--gn)" }} />
    : state === "fail" ? <AlertCircle size={15} className="flex-none" style={{ color: "var(--rd)" }} />
    : <MessageCircle size={15} className="flex-none" style={{ color: "var(--bl)" }} />;

  return (
    <span ref={z.wrapRef} className={`relative inline-flex flex-col items-stretch gap-1 ${z.wrapClassName}`}>
      <span className="flex flex-wrap items-center gap-1.5">
        {z.inputMode && show !== "friends" && (
          <input
            value={z.manualPhone}
            onChange={(e) => z.setManualPhone(e.target.value)}
            placeholder="SĐT khách"
            inputMode="tel"
            aria-label="Số điện thoại khách"
            className={`${inputCls} min-w-[110px] flex-1`}
            style={{ height: 32 }}
          />
        )}
        {show !== "friends" && (
          <button type="button" onClick={z.sendByPhone} disabled={state === "sending"} className={z.className} title="Gửi tự động qua Zalo studio">
            {icon} {state === "ok" ? "Đã gửi" : z.mainLabel}
          </button>
        )}
        {show !== "friends" && z.remembered && (
          <button
            type="button"
            onClick={z.togglePicker}
            className="rounded-[7px] px-1 text-[12px] font-medium underline-offset-2 hover:underline"
            title="Chọn người nhận Zalo khác cho hợp đồng/album này"
            style={{ color: "var(--tx3)" }}
          >
            đổi người
          </button>
        )}
        {show !== "send" && (
          <button
            type="button"
            onClick={z.togglePicker}
            className={show === "friends" ? z.className : z.friendsClass}
            title="Chọn từ danh sách bạn Zalo (gửi được dù người nhận tắt tìm-bằng-SĐT)"
            aria-label={z.friendsLabel ? undefined : "Chọn bạn Zalo"}
            aria-expanded={z.pickOpen}
          >
            <Users size={15} className="flex-none" style={{ color: "var(--bl)" }} />
            {z.friendsLabel ? ` ${z.friendsLabel}` : ""}
          </button>
        )}
      </span>

      {z.pickOpen && pos && (
        <PopLayer pos={pos}>
          <div ref={z.popRef} className="v2-menu-pop" style={popStyle(pos)}>
            {z.pickHint && (
              <p className="mb-1.5 px-1.5 text-[12px] font-medium" style={{ color: "var(--am)" }}>{z.pickHint}</p>
            )}
            <SearchInput value={z.q} onChange={z.setQ} placeholder="Tìm bạn theo tên…" autoFocus />
            <div className="mt-1.5 max-h-56 overflow-y-auto">
              {z.loadingFriends ? (
                <div className="flex items-center gap-2 px-2 py-3 text-[13px]" style={{ color: "var(--tx3)" }}>
                  <Loader2 size={14} className="animate-spin" /> Đang tải bạn bè…
                </div>
              ) : z.friendsErr ? (
                <div className="px-2 py-3 text-[13px]" style={{ color: "var(--rd)" }}>{z.friendsErr}</div>
              ) : z.shown.length === 0 ? (
                <div className="px-2 py-3 text-[13px]" style={{ color: "var(--tx3)" }}>{z.friends.length ? "Không khớp." : "Chưa có bạn bè."}</div>
              ) : (
                z.shown.slice(0, 200).map((f) => (
                  <button key={f.uid} type="button" onClick={() => z.pickFriend(f)} className="v2-menu-item">
                    {f.avatar ? (
                      <img src={f.avatar} alt="" className="h-7 w-7 flex-none rounded-full object-cover" />
                    ) : (
                      <Avatar name={f.name} size={28} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </PopLayer>
      )}

      {state === "fail" && z.err && (
        <span className="text-[12px]" style={{ color: "var(--rd)" }}>{z.err}</span>
      )}
      {z.imgWarn && (
        <span className="text-[12px]" style={{ color: "var(--am)" }}>{z.imgWarn}</span>
      )}
    </span>
  );
}
