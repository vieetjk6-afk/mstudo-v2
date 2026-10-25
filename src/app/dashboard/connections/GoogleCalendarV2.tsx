"use client";

import { Calendar, Check, CheckCircle2, CircleAlert, ExternalLink, Info, ListOrdered, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Badge, Callout, PageHead, Section, Stack, btn } from "@/components/v2/kit";
import { GCAL_FEATURES, GCAL_STEPS, useGcalConnection, type GcalProps } from "./useGcalConnection";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾT NỐI GOOGLE CALENDAR — giao diện mới. Cùng logic với
   GoogleCalendarConnect (bản cũ, ở ./useGcalConnection); xếp thành:
     • Thẻ kết nối: nhãn trạng thái + MỘT nút (Kết nối / Ngắt kết nối).
     • Hai khối: "Đồng bộ những gì" và "Cách kết nối" (bước đánh số).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GoogleCalendarV2({ connected: initialConnected, gcalStatus, gcalMsg }: GcalProps) {
  const { connected, disconnecting, disconnect } = useGcalConnection(initialConnected);

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <Stack>
        <PageHead desc="Tự đồng bộ lịch chụp lên Google Calendar: mỗi khi tạo hoặc cập nhật hợp đồng có ngày chụp, sự kiện hiện ngay trên lịch Google của bạn mà không cần nhập tay." />

        {/* Kết quả quay về từ Google */}
        {gcalStatus === "connected" && (
          <Callout tone="green" icon={CheckCircle2}>Đã kết nối Google Calendar thành công!</Callout>
        )}
        {gcalStatus === "error" && (
          <Callout tone="red" icon={CircleAlert}>
            Kết nối thất bại{gcalMsg ? `: ${gcalMsg}` : ""}. Thử lại hoặc kiểm tra cài đặt Google OAuth.
          </Callout>
        )}

        <div className="v2-card overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <span
                className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px]"
                style={connected ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--blS)", color: "var(--bl)" }}
              >
                <Calendar size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold">Google Calendar</p>
                  {connected ? <Badge tone="green" dot>Đang đồng bộ tự động</Badge> : <Badge tone="gray" dot>Chưa kết nối</Badge>}
                </div>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>
                  Một chiều: studio → Google Calendar, trên lịch chính của tài khoản Google.
                </p>
              </div>
            </div>
            {connected ? (
              <button type="button" onClick={disconnect} disabled={disconnecting} className={btn("danger", "md", "w-full sm:w-auto")}>
                {disconnecting ? <Loader2 size={16} className="animate-spin" /> : <Unplug size={16} />}
                {disconnecting ? "Đang ngắt kết nối…" : "Ngắt kết nối"}
              </button>
            ) : (
              <a href="/api/gcal/connect" className={btn("primary", "md", "w-full sm:w-auto")}>
                <ExternalLink size={16} /> Kết nối Google Calendar
              </a>
            )}
          </div>
          <div className="flex items-start gap-2.5 px-4 py-3 text-[12.5px] sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)", color: "var(--tx2)" }}>
            <Info size={15} className="mt-px flex-none" style={{ color: "var(--tx3)" }} />
            <span>Sự kiện tạo trực tiếp trên Google Calendar sẽ không hiện trong studio.</span>
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Section icon={RefreshCw} title="Đồng bộ những gì">
            <ul className="flex flex-col gap-3">
              {GCAL_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                    <Check size={12} strokeWidth={2.8} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </Section>
          <Section icon={ListOrdered} title="Cách kết nối">
            <ol className="flex flex-col gap-3">
              {GCAL_STEPS.map((st, i) => (
                <li key={i} className="flex items-start gap-3 text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  <span
                    className="v2-num flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: "var(--acS)", color: "var(--ac)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">{st}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </Stack>
    </div>
  );
}
