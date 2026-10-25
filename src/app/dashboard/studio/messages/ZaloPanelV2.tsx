"use client";

import { AlertTriangle, BadgeCheck, Check, ExternalLink, Loader2, MessageCircle, QrCode, Send, Unplug, X, Zap } from "lucide-react";
import { Badge, Callout, Field, Section, btn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import { eventCfg } from "@/lib/zalo/events";
import { EVENTS, qrSrc, useZalo } from "./useZalo";

/* ═══════════════════════════════════════════════════════════════════════════
   TỰ ĐỘNG NHẮN TIN ZALO — giao diện mới (tab 2 của MessagesV2). Cùng logic với
   ZaloPanel (./useZalo). Ba khối xếp theo thứ tự làm việc:
     1. Kết nối: chọn kênh (OA / cá nhân, khi máy chủ bật OA), cảnh báo rủi ro
        của kênh cá nhân, đăng nhập QR hoặc cấp quyền OA, ngắt kết nối.
     2. Tự động gửi theo mốc: mỗi mốc một dòng, hai công tắc Gửi khách / Gửi thợ
        (bật/tắt là lưu ngay — như bản cũ).
     3. Gửi thử (khi đã kết nối).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ZaloPanelV2() {
  const z = useZalo();
  const { st } = z;

  return (
    <div className="flex flex-col gap-4">
      {z.ketQuaOA === "ok" ? (
        <Callout tone="green" icon={Check}>Đã kết nối Official Account. Từ giờ tin tự động gửi qua kênh chính thống.</Callout>
      ) : null}
      {z.ketQuaOA === "loi" ? (
        <Callout tone="red" icon={X}>
          Chưa cấp quyền được cho Official Account. Thử lại, hoặc kiểm tra xem tài khoản Zalo đang đăng nhập có phải quản trị viên của OA không.
        </Callout>
      ) : null}

      <Section
        icon={MessageCircle}
        title="Kết nối Zalo"
        desc="Tự động nhắn khách và thợ ở các mốc hợp đồng. Chỉ dùng được với gói Studio."
        actions={st?.connected ? <Badge tone="green" dot>Đã kết nối</Badge> : <Badge tone="gray" dot>Chưa kết nối</Badge>}
      >
        <div className="flex flex-col gap-4">
          {/* Chọn kênh — CHỈ khi máy chủ đã bật OA, như bản cũ. */}
          {z.coOA ? (
            <div role="radiogroup" aria-label="Kênh gửi" className="grid gap-2 sm:grid-cols-2">
              {([
                { id: "oa" as const, ten: "Official Account", mo: "Chính thống, không lo bị khoá. Gửi theo mẫu ZNS đã duyệt.", Icon: BadgeCheck },
                { id: "personal" as const, ten: "Tài khoản cá nhân", mo: "Đăng nhập bằng QR. Nhắn tự do nhưng có rủi ro bị Zalo tạm khoá.", Icon: QrCode },
              ]).map(({ id, ten, mo, Icon }) => {
                const on = z.kenh === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => void z.doiKenh(id)}
                    className="flex items-start gap-3 rounded-[12px] px-3.5 py-3 text-left transition-colors"
                    style={on ? { background: "var(--blS)", border: "1px solid var(--bl)" } : { background: "var(--sf)", border: "1px solid var(--bd)" }}
                  >
                    <Icon size={18} className="mt-0.5 flex-none" style={{ color: on ? "var(--bl)" : "var(--tx3)" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{ten}</span>
                      <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>{mo}</span>
                    </span>
                    {on ? <Check size={16} className="flex-none" style={{ color: "var(--bl)" }} /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {z.kenh === "personal" ? (
            <Callout tone="amber" icon={AlertTriangle} title="Kênh tài khoản cá nhân — không chính thống">
              Gửi tin tự động có thể khiến Zalo <b>tạm khoá tài khoản</b> nếu gửi quá nhiều hoặc cho người lạ. Chỉ nên nhắn khách/thợ <b>đã kết bạn</b>,
              số lượng vừa phải. Studio tự chịu trách nhiệm khi bật.
            </Callout>
          ) : null}

          {/* Trạng thái / nút kết nối — OA đi đường OAuth, cá nhân đi QR. */}
          <div className="flex flex-wrap items-center gap-3 rounded-[12px] px-4 py-3" style={{ background: "var(--sf2)" }}>
            {z.coOA && z.kenh === "oa" ? (
              st?.connected ? (
                <>
                  <BadgeCheck size={20} className="flex-none" style={{ color: "var(--bl)" }} />
                  <p className="min-w-0 flex-1 text-[14px]">
                    Official Account: <b>{st.displayName || st.oaId || "đã kết nối"}</b>
                  </p>
                  <button type="button" onClick={() => void z.ngatOA()} className={btn("danger", "sm")}>
                    <Unplug size={15} /> Ngắt kết nối
                  </button>
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 basis-[220px] text-[13px]" style={{ color: "var(--tx2)" }}>
                    Sang Zalo cấp quyền rồi tự quay lại đây. Cần là quản trị viên của OA.
                  </p>
                  <button type="button" onClick={z.noiOA} className={btn("primary")}>
                    <ExternalLink size={16} /> Kết nối Official Account
                  </button>
                </>
              )
            ) : st?.connected ? (
              <>
                {st.self?.avatar ? (
                  <img src={st.self.avatar} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
                ) : (
                  <MessageCircle size={20} className="flex-none" style={{ color: "var(--bl)" }} />
                )}
                <p className="min-w-0 flex-1 text-[14px]">
                  Tài khoản: <b>{st.displayName || st.self?.name || "đã kết nối"}</b>
                </p>
                <button type="button" onClick={() => void z.disconnect()} className={btn("danger", "sm")}>
                  <Unplug size={15} /> Ngắt kết nối
                </button>
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 basis-[220px] text-[13px]" style={{ color: "var(--tx2)" }}>
                  {st?.personalAvailable === false
                    ? "Máy chủ chưa cài zca-js — liên hệ hỗ trợ để bật."
                    : "Mở Zalo trên điện thoại để quét mã — giữ trang mở tới khi kết nối xong."}
                </p>
                <button
                  type="button"
                  onClick={() => void z.connectPersonal()}
                  disabled={z.connecting || st?.personalAvailable === false}
                  className={btn("primary")}
                >
                  {z.connecting ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                  {z.connecting ? "Đang chờ quét…" : "Đăng nhập Zalo bằng QR"}
                </button>
              </>
            )}
            {st?.lastError && !st.connected && !z.connecting ? (
              <p className="w-full text-[12.5px]" style={{ color: "var(--rd)" }}>Lỗi: {st.lastError}</p>
            ) : null}
          </div>

          {z.kenh === "personal" && z.connecting && !st?.connected ? (
            <div className="flex flex-col items-center gap-2 rounded-[14px] px-5 py-6" style={{ border: "1px dashed var(--bdS)" }}>
              {z.scanned ? (
                <>
                  <Loader2 size={28} className="animate-spin" style={{ color: "var(--gn)" }} />
                  <p className="text-[14px]" style={{ color: "var(--gn)" }}>Đã quét — đang hoàn tất đăng nhập…</p>
                </>
              ) : z.qr ? (
                <>
                  <img src={qrSrc(z.qr)} alt="Mã QR đăng nhập Zalo" className="h-52 w-52 rounded-[12px] bg-white p-2" />
                  <p className="max-w-[340px] text-center text-[12.5px]" style={{ color: "var(--tx2)" }}>
                    Mở Zalo trên điện thoại → <b>Cá nhân</b> → biểu tượng quét mã → quét QR này.
                  </p>
                </>
              ) : (
                <>
                  <Loader2 size={28} className="animate-spin" style={{ color: "var(--tx3)" }} />
                  <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Đang tạo mã QR…</p>
                </>
              )}
            </div>
          ) : null}
        </div>
      </Section>

      <Section
        icon={Zap}
        title="Tự động gửi theo mốc"
        desc={
          z.kenh === "oa"
            ? "Gửi theo mẫu ZNS đã được Zalo duyệt. Nhắc lịch chụp chạy hằng ngày; mốc khác gửi khi bạn thao tác trên hợp đồng."
            : "Chỉ gửi được cho người đã kết bạn Zalo. Nhắc lịch chụp chạy hằng ngày; mốc khác gửi khi bạn thao tác trên hợp đồng."
        }
        flush
        actions={
          z.savingEvt ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              <Loader2 size={14} className="animate-spin" /> Đang lưu…
            </span>
          ) : null
        }
      >
        <div
          className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-4 py-2.5 text-[12px] font-semibold sm:grid-cols-[minmax(0,1fr)_110px_110px] sm:px-5"
          style={{ background: "var(--sf2)", color: "var(--tx3)", borderBottom: "1px solid var(--bd)" }}
        >
          <span>Mốc</span>
          <span className="text-center">Gửi khách</span>
          <span className="text-center">Gửi thợ</span>
        </div>
        {EVENTS.map((e) => {
          const cfg = eventCfg(z.autoEvents, e.key);
          return (
            <div
              key={e.key}
              className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_110px_110px] sm:px-5"
              style={{ borderBottom: "1px solid var(--bd2)" }}
            >
              <span className="text-[13.5px]">{e.label}</span>
              {(["client", "crew"] as const).map((aud) => (
                <span key={aud} className="flex justify-center">
                  {e.audiences.includes(aud) ? (
                    <Switch checked={!!cfg[aud]} onChange={() => z.toggle(e.key, aud)} />
                  ) : (
                    <span style={{ color: "var(--tx3)" }} aria-label="Không áp dụng">—</span>
                  )}
                </span>
              ))}
            </div>
          );
        })}
      </Section>

      {st?.connected ? (
        <Section icon={Send} title="Gửi thử" desc="Kiểm tra kết nối bằng một tin tới số đã kết bạn Zalo.">
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Field label="Số điện thoại">
                <input className={inputCls} type="tel" value={z.testPhone} onChange={(e) => z.setTestPhone(e.target.value)} placeholder="Số đã kết bạn Zalo" />
              </Field>
              <button type="button" onClick={() => void z.sendTest()} disabled={z.testState === "sending" || !z.testPhone.trim()} className={btn("secondary")}>
                {z.testState === "sending" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Gửi thử
              </button>
            </div>
            <Field label="Nội dung">
              <textarea className={inputCls} rows={2} value={z.testMsg} onChange={(e) => z.setTestMsg(e.target.value)} />
            </Field>
            {z.testState === "ok" ? <Callout tone="green" icon={Check}>Đã gửi.</Callout> : null}
            {z.testState === "fail" ? <Callout tone="red" icon={X}>Lỗi: {z.testErr}</Callout> : null}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
