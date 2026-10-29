"use client";

import dynamic from "next/dynamic";
import { Bell, BellOff, BellRing, Send } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { usePushToggle } from "./usePushToggle";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const PushToggleV2 = dynamic(() => import("./PushToggleV2"));

export default function PushToggle() {
  return useUiV2() ? <PushToggleV2 /> : <PushToggleV1 />;
}

function PushToggleV1() {
  const { state, err, testing, test, enable, disable, sendTest } = usePushToggle();

  if (state === "ios-install") {
    return (
      <div className="card p-4 text-sm" style={{ color: "var(--text2)" }}>
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Bell size={18} style={{ color: "var(--text2)" }} />
          Bật thông báo trên iPhone
        </div>
        <p className="mb-2 text-xs" style={{ color: "var(--text3)" }}>
          iPhone chỉ cho phép thông báo đẩy khi mở từ icon ngoài màn hình chính (cần iOS 16.4 trở lên):
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-xs" style={{ color: "var(--text2)" }}>
          <li>Mở trang này trong <b>Safari</b>, bấm nút Chia sẻ (ô vuông có mũi tên ↑).</li>
          <li>Chọn <b>“Thêm vào MH chính” / “Add to Home Screen”</b>.</li>
          <li><b>Đóng Safari</b>, mở app mstudo từ <b>icon ngoài màn hình chính</b>.</li>
          <li>Vào lại trang Thông báo và bấm <b>“Bật thông báo”</b>.</li>
        </ol>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="card flex items-center gap-3 p-4 text-sm" style={{ color: "var(--text3)" }}>
        <BellOff size={18} />
        Thiết bị/trình duyệt này chưa hỗ trợ thông báo đẩy. Trên iPhone, hãy &quot;Tạo Webapp&quot; (thêm ra màn hình chính) trước.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="card flex items-center gap-3 p-4 text-sm" style={{ color: "var(--text2)" }}>
        <BellOff size={18} style={{ color: "var(--danger)" }} />
        Bạn đã chặn thông báo. Vào cài đặt trình duyệt/điện thoại để bật lại quyền cho mstudo.
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      {state === "subscribed" ? (
        <BellRing size={20} style={{ color: "var(--accent)" }} />
      ) : (
        <Bell size={20} style={{ color: "var(--text2)" }} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {state === "subscribed" ? "Thông báo đẩy đang bật" : "Bật thông báo đẩy"}
        </p>
        <p className="text-xs" style={{ color: "var(--text3)" }}>
          {state === "subscribed"
            ? "Bạn sẽ nhận thông báo trên thiết bị này khi có đặt lịch / hợp đồng mới."
            : "Nhận thông báo trên điện thoại kể cả khi không mở app."}
        </p>
        {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
      </div>
      {state === "subscribed" ? (
        <>
          <button onClick={sendTest} disabled={testing} className="btn-ghost flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs">
            <Send size={13} /> {testing ? "Đang gửi…" : "Gửi thử"}
          </button>
          <button onClick={disable} className="btn-ghost shrink-0 px-3 py-2 text-xs">Tắt</button>
        </>
      ) : (
        <button onClick={enable} disabled={state === "loading"} className="btn-primary shrink-0 px-3 py-2 text-xs">
          {state === "loading" ? "Đang xử lý…" : "Bật thông báo"}
        </button>
      )}

      {test && (
        <div
          className="w-full rounded-[10px] px-3 py-2.5 text-xs"
          style={{
            background: test.ok ? "var(--gnS)" : "var(--amS)",
            color: test.ok ? "var(--gn)" : "var(--am)",
          }}
        >
          <p className="font-semibold">
            {test.ok
              ? `Đã gửi tới ${test.sent}/${test.devices} thiết bị`
              : test.reason === "vapid_missing"
                ? "Máy chủ chưa cấu hình thông báo đẩy"
                : test.reason === "no_subscription"
                  ? "Thiết bị này chưa đăng ký"
                  : "Gửi không thành công"}
          </p>
          <p className="mt-0.5" style={{ color: "var(--text2)" }}>{test.hint}</p>
          {/* Mã lỗi của từng dịch vụ push — thứ duy nhất phân biệt được "khoá
              sai" với "máy đã gỡ đăng ký" khi cần hỏi kỹ thuật. */}
          {test.results && test.results.length > 0 && (
            <ul className="mt-1.5 space-y-0.5" style={{ color: "var(--text2)" }}>
              {test.results.map((r, i) => (
                <li key={i}>
                  {r.ok ? "✓" : "✗"} {r.service}
                  {!r.ok && r.statusCode ? ` — lỗi ${r.statusCode}` : ""}
                  {r.pruned ? " (đăng ký đã hết hạn, vừa gỡ)" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
