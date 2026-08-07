"use client";

import { useState } from "react";
import { Calendar, Check, X, Loader2, ExternalLink, Info } from "lucide-react";

interface Props {
  connected: boolean;
  gcalStatus: string | null;
  gcalMsg: string | null;
}

export default function GoogleCalendarConnect({ connected: initialConnected, gcalStatus, gcalMsg }: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/gcal/disconnect", { method: "POST" });
    setConnected(false);
    setDisconnecting(false);
  }

  return (
    <div className="page-in">
      <div className="mb-8">
        <p className="eyebrow mb-1.5">Tích hợp</p>
        <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-medium leading-none">Kết nối Google Calendar</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text2)" }}>
          Kết nối tài khoản Google để tự động đồng bộ lịch chụp — mỗi khi tạo hoặc cập nhật hợp đồng có ngày chụp, sự kiện sẽ hiện ngay trên Google Calendar của bạn mà không cần nhập tay.
        </p>
      </div>

      {/* Status banner from OAuth redirect */}
      {gcalStatus === "connected" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb,#3fb98a 12%,transparent)", border: "1px solid color-mix(in srgb,#3fb98a 30%,transparent)", color: "#3fb98a" }}>
          <Check size={16} /> Đã kết nối Google Calendar thành công!
        </div>
      )}
      {gcalStatus === "error" && (
        <div className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", color: "var(--danger)" }}>
          <X size={16} /> Kết nối thất bại{gcalMsg ? `: ${gcalMsg}` : ""}. Thử lại hoặc kiểm tra cài đặt Google OAuth.
        </div>
      )}

      {/* Google Calendar card */}
      <div className="card p-6 max-w-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb,#4285f4 15%,transparent)" }}>
            <Calendar size={20} style={{ color: "#4285f4" }} />
          </span>
          <div>
            <h2 className="font-medium">Google Calendar</h2>
            <p className="text-[12px]" style={{ color: connected ? "#3fb98a" : "var(--text3)" }}>
              {connected ? "✓ Đã kết nối" : "Chưa kết nối"}
            </p>
          </div>
        </div>

        <ul className="mb-5 space-y-2 text-[13.5px]" style={{ color: "var(--text2)" }}>
          {[
            "Tạo hợp đồng có ngày chụp → sự kiện tự thêm vào Google Calendar",
            "Tạo hoặc chỉnh sửa sự kiện trong Lịch studio → đồng bộ ngay lên Google Calendar",
            "Xoá sự kiện hoặc hợp đồng → tự xoá khỏi Google Calendar",
            "Dùng lịch chính (primary calendar) của tài khoản Google đã kết nối",
          ].map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--brand, #3fb98a)" }} />
              {f}
            </li>
          ))}
        </ul>

        {connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: "color-mix(in srgb,#3fb98a 10%,transparent)", border: "1px solid color-mix(in srgb,#3fb98a 25%,transparent)" }}>
              <Check size={15} style={{ color: "#3fb98a" }} />
              <span style={{ color: "#3fb98a" }}>Google Calendar đang đồng bộ tự động</span>
            </div>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="btn-ghost w-full py-2.5 text-sm"
              style={{ color: "var(--danger)" }}
            >
              {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              {disconnecting ? "Đang ngắt kết nối…" : "Ngắt kết nối"}
            </button>
          </div>
        ) : (
          <a
            href="/api/gcal/connect"
            className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm"
          >
            <ExternalLink size={14} />
            Kết nối Google Calendar
          </a>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-lg p-3 text-[12px]" style={{ background: "var(--surface2)", color: "var(--text3)" }}>
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Chỉ đồng bộ một chiều từ studio → Google Calendar. Sự kiện tạo trực tiếp trên Google Calendar sẽ không hiện trong studio.
          </span>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-8 card p-6 max-w-lg">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide" style={{ color: "var(--text2)" }}>
          Cách hoạt động
        </h3>
        <ol className="space-y-3 text-[13.5px]" style={{ color: "var(--text2)" }}>
          {[
            "Bấm \"Kết nối Google Calendar\" — trình duyệt chuyển sang trang đăng nhập Google",
            "Chọn tài khoản Google bạn muốn dùng → bấm \"Cho phép\" để cấp quyền quản lý sự kiện",
            "Quay lại studio — từ đây mọi hợp đồng có ngày chụp và sự kiện trong Lịch studio sẽ tự đồng bộ lên Google Calendar",
            "Cập nhật hoặc xoá trong studio → Google Calendar cũng tự thay đổi theo",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "var(--brand, #3fb98a)", color: "var(--brandFg, #06120c)" }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
