"use client";

import { Bell, BellOff, BellRing, Loader2, Send } from "lucide-react";
import { Callout, btn } from "@/components/v2/kit";
import { usePushToggle } from "./usePushToggle";

/* ═══════════════════════════════════════════════════════════════════════════
   THÔNG BÁO ĐẨY TRÊN THIẾT BỊ NÀY — giao diện mới. Cùng logic với PushToggle
   (./usePushToggle). Trạng thái chưa dùng được (iPhone chưa thêm ra màn hình
   chính, trình duyệt không hỗ trợ, đã chặn quyền) là <Callout> theo nghĩa màu;
   còn lại là một thẻ gọn: icon · tình trạng · nút bật / gửi thử / tắt.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PushToggleV2() {
  const { state, err, testing, test, enable, disable, sendTest } = usePushToggle();

  if (state === "ios-install") {
    return (
      <Callout tone="blue" icon={Bell} title="Bật thông báo trên iPhone">
        <p className="mt-0.5">iPhone chỉ cho phép thông báo đẩy khi mở từ icon ngoài màn hình chính (cần iOS 16.4 trở lên):</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5">
          <li>Mở trang này trong <b>Safari</b>, bấm nút Chia sẻ (ô vuông có mũi tên ↑).</li>
          <li>Chọn <b>“Thêm vào MH chính” / “Add to Home Screen”</b>.</li>
          <li><b>Đóng Safari</b>, mở app mstudo từ <b>icon ngoài màn hình chính</b>.</li>
          <li>Vào lại trang Thông báo và bấm <b>“Bật thông báo”</b>.</li>
        </ol>
      </Callout>
    );
  }

  if (state === "unsupported") {
    return (
      <Callout tone="gray" icon={BellOff} title="Chưa nhận được thông báo đẩy trên thiết bị này">
        Thiết bị/trình duyệt này chưa hỗ trợ thông báo đẩy. Trên iPhone, hãy &quot;Tạo Webapp&quot; (thêm ra màn hình chính) trước.
      </Callout>
    );
  }

  if (state === "denied") {
    return (
      <Callout tone="red" icon={BellOff} title="Bạn đã chặn thông báo">
        Vào cài đặt trình duyệt/điện thoại để bật lại quyền cho mstudo.
      </Callout>
    );
  }

  const on = state === "subscribed";
  return (
    <div className="v2-card flex flex-col gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]"
          style={on ? { background: "var(--acS)", color: "var(--ac)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
        >
          {on ? <BellRing size={19} /> : <Bell size={19} />}
        </span>
        <div className="min-w-0 flex-1 basis-[220px]">
          <p className="text-[14px] font-semibold">{on ? "Thông báo đẩy đang bật" : "Bật thông báo đẩy"}</p>
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {on
              ? "Bạn sẽ nhận thông báo trên thiết bị này khi có đặt lịch / hợp đồng mới."
              : "Nhận thông báo trên điện thoại kể cả khi không mở app."}
          </p>
          {err && <p className="mt-1 text-[12.5px]" style={{ color: "var(--rd)" }}>{err}</p>}
        </div>
        {on ? (
          <div className="flex flex-none items-center gap-2">
            <button type="button" onClick={sendTest} disabled={testing} className={btn("secondary", "sm")}>
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {testing ? "Đang gửi…" : "Gửi thử"}
            </button>
            <button type="button" onClick={disable} className={btn("ghost", "sm")}>Tắt</button>
          </div>
        ) : (
          <button type="button" onClick={enable} disabled={state === "loading"} className={btn("primary", "sm", "flex-none")}>
            {state === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            {state === "loading" ? "Đang xử lý…" : "Bật thông báo"}
          </button>
        )}
      </div>

      {test && (
        <Callout
          tone={test.ok ? "green" : "amber"}
          title={
            test.ok
              ? `Đã gửi tới ${test.sent}/${test.devices} thiết bị`
              : test.reason === "vapid_missing"
                ? "Máy chủ chưa cấu hình thông báo đẩy"
                : test.reason === "no_subscription"
                  ? "Thiết bị này chưa đăng ký"
                  : "Gửi không thành công"
          }
        >
          <p>{test.hint}</p>
          {/* Mã lỗi của từng dịch vụ push — phân biệt "khoá sai" với "máy đã gỡ đăng ký". */}
          {test.results && test.results.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {test.results.map((r, i) => (
                <li key={i}>
                  {r.ok ? "✓" : "✗"} {r.service}
                  {!r.ok && r.statusCode ? ` — lỗi ${r.statusCode}` : ""}
                  {r.pruned ? " (đăng ký đã hết hạn, vừa gỡ)" : ""}
                </li>
              ))}
            </ul>
          )}
        </Callout>
      )}
    </div>
  );
}
