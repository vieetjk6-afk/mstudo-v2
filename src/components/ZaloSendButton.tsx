"use client";

import dynamic from "next/dynamic";
import { MessageCircle, Check, Loader2, AlertCircle, Users, Search } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useZaloSend, type ZaloSendProps } from "./useZaloSend";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const ZaloSendButtonV2 = dynamic(() => import("./ZaloSendButtonV2"));

/**
 * Nút "Gửi Zalo" — gửi tin qua tài khoản Zalo studio ĐÃ kết nối (kênh cá nhân),
 * gọi /api/studio/zalo/send. Gửi TỰ ĐỘNG (khác MessengerButton mở app + copy tay).
 *
 * 3 cách xác định người nhận:
 *  - `phone` có sẵn (album/HĐ kèm khách) → gửi thẳng.
 *  - `askPhone` + không có số → hiện ô nhập SĐT.
 *  - "Chọn bạn Zalo" → chọn trực tiếp từ danh sách bạn bè (gửi theo uid, KHÔNG
 *    phụ thuộc quyền "tìm bằng SĐT" của người nhận → gửi được cho bạn bè dù họ
 *    tắt tìm-bằng-SĐT).
 *
 * Nhớ người nhận (tin gửi KHÁCH có contractId/albumId): người chọn từ danh sách
 * bạn được máy chủ lưu lên hợp đồng/album → lần sau nút thành "Gửi Zalo cho
 * <tên>", bấm một cái là tới đúng người (máy chủ tự dùng uid đã lưu), kèm nút
 * nhỏ "đổi người" để chọn lại. Chỉ kênh cá nhân mới nhớ — kênh OA/chưa kết nối
 * thì máy chủ không trả `saved`, nút giữ nguyên như cũ.
 */
export default function ZaloSendButton(props: ZaloSendProps) {
  return useUiV2() ? <ZaloSendButtonV2 {...props} /> : <ZaloSendButtonV1 {...props} />;
}

function ZaloSendButtonV1(props: ZaloSendProps) {
  const {
    state, err, imgWarn, manualPhone, setManualPhone, pickHint, pickOpen, loadingFriends, friendsErr, q, setQ,
    wrapRef, popRef, popLeft, remembered, mainLabel, inputMode, friendsClass, sendByPhone, togglePicker, pickFriend, shown,
    className, show, friendsLabel, wrapClassName, friends,
  } = useZaloSend(props, "btn-ghost px-2.5 py-1.5 text-xs");

  const icon =
    state === "sending" ? <Loader2 size={14} className="inline animate-spin" />
    : state === "ok" ? <Check size={14} className="inline" />
    : state === "fail" ? <AlertCircle size={14} className="inline" />
    : <MessageCircle size={14} className="inline" />;

  return (
    // w-full + flex-wrap ở hàng trong: cụm này gồm tới 3 phần (ô số điện thoại,
    // nút gửi, nút chọn bạn Zalo). Trước đây ô nhập cứng 120px và nút chọn bạn
    // dùng cỡ khác hẳn hai cái kia, nên trên điện thoại cụm vỡ thành 3 dòng lệch
    // nhau — mỗi dòng một chiều rộng. Giờ ô nhập giãn theo chỗ còn lại, hai nút
    // đứng cạnh nhau và cao bằng nhau.
    <span ref={wrapRef} className={`relative inline-flex flex-col items-stretch gap-0.5 ${wrapClassName}`}>
      <span className="flex flex-wrap items-center gap-1.5">
        {inputMode && show !== "friends" && (
          <input
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            placeholder="SĐT khách"
            inputMode="tel"
            className="input min-w-[110px] flex-1 px-2 py-1.5 text-xs"
          />
        )}
        {show !== "friends" && (
          <button
            type="button"
            onClick={sendByPhone}
            disabled={state === "sending"}
            className={className}
            title="Gửi tự động qua Zalo studio"
            style={{ color: "#0068FF" }}
          >
            {icon} {state === "ok" ? "Đã gửi" : mainLabel}
          </button>
        )}
        {show !== "friends" && remembered && (
          <button
            type="button"
            onClick={togglePicker}
            className="text-[11px] underline-offset-2 hover:underline"
            title="Chọn người nhận Zalo khác cho hợp đồng/album này"
            style={{ color: "var(--text3)" }}
          >
            đổi người
          </button>
        )}
        {show !== "send" && (
          <button
            type="button"
            onClick={togglePicker}
            className={show === "friends" ? className : friendsClass}
            title="Chọn từ danh sách bạn Zalo (gửi được dù người nhận tắt tìm-bằng-SĐT)"
            style={{ color: "#0068FF" }}
          >
            <Users size={14} className="inline" />
            {friendsLabel ? ` ${friendsLabel}` : ""}
          </button>
        )}
      </span>

      {pickOpen && (
        <div
          ref={popRef}
          className="absolute z-50 mt-1 w-[260px] max-w-[calc(100vw-1.5rem)] rounded-xl border p-2 shadow-xl"
          style={{ top: "100%", left: popLeft, background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {pickHint && (
            <div className="mb-1.5 px-1 text-[11px]" style={{ color: "var(--s-amber)" }}>{pickHint}</div>
          )}
          <div className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: "var(--surface2)" }}>
            <Search size={13} style={{ color: "var(--text3)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm bạn theo tên…"
              className="w-full bg-transparent text-xs outline-none"
              autoFocus
            />
          </div>
          <div className="mt-1.5 max-h-56 overflow-y-auto">
            {loadingFriends ? (
              <div className="flex items-center gap-2 px-2 py-3 text-xs opacity-70">
                <Loader2 size={13} className="animate-spin" /> Đang tải bạn bè…
              </div>
            ) : friendsErr ? (
              <div className="px-2 py-3 text-xs" style={{ color: "var(--s-red)" }}>{friendsErr}</div>
            ) : shown.length === 0 ? (
              <div className="px-2 py-3 text-xs opacity-60">{friends.length ? "Không khớp." : "Chưa có bạn bè."}</div>
            ) : (
              shown.slice(0, 200).map((f) => (
                <button
                  key={f.uid}
                  type="button"
                  onClick={() => pickFriend(f)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5"
                >
                  {f.avatar ? (
                    <img src={f.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px]">
                      {f.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="truncate">{f.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {state === "fail" && err && (
        <span className="text-[10px]" style={{ color: "var(--s-red)" }}>{err}</span>
      )}
      {imgWarn && (
        <span className="text-[10px]" style={{ color: "var(--s-amber)" }}>{imgWarn}</span>
      )}
    </span>
  );
}
