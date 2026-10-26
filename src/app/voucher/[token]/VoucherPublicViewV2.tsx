"use client";

import { CalendarCheck, Check, CircleAlert, Copy, Download, Phone, Ticket } from "lucide-react";
import { VoucherTicket, type TicketData } from "@/components/voucher/VoucherTicket";
import { CustomerHeaderV2, CustomerMainV2 } from "@/components/v2/customer";
import { CustomerRootAuto } from "@/app/c/[token]/DocPartsV2";
import { Badge, Callout, Card, Section, Stack, btn, iconBtn } from "@/components/v2/kit";
import { useVoucherActions } from "./useVoucherActions";

/* ═══════════════════════════════════════════════════════════════════════════
   VOUCHER ƯU ĐÃI (khách quét QR) — giao diện mới. Cùng thao tác với bản cũ
   (./useVoucherActions). Tấm voucher giữ nguyên thiết kế riêng; phần khung
   quanh nó làm lại: thương hiệu studio, trạng thái còn dùng được hay không,
   mã chép một chạm, MỘT nút chính "Đặt lịch với voucher này".
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VoucherPublicViewV2({
  ticket,
  logo,
  bookUrl,
  studioPhone,
  usable,
}: {
  ticket: TicketData;
  logo: string | null;
  bookUrl: string | null;
  studioPhone: string | null;
  usable: boolean;
}) {
  const { saving, copied, save, copyCode } = useVoucherActions(ticket);
  const tel = studioPhone ? `tel:${studioPhone.replace(/[^\d+]/g, "")}` : null;

  return (
    <CustomerRootAuto>
      <CustomerHeaderV2
        brand={{ name: ticket.studio, logoUrl: logo }}
        sub="Voucher ưu đãi"
        right={
          tel ? (
            <a href={tel} className={iconBtn()} aria-label="Gọi studio" title="Gọi studio">
              <Phone size={18} />
            </a>
          ) : null
        }
      />
      <CustomerMainV2 width={520}>
        <Stack gap={16}>
          <header className="v2-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {usable ? (
                <Badge tone="green" dot>
                  Còn dùng được
                </Badge>
              ) : (
                <Badge tone="gray" dot>
                  {ticket.stateLabel || "Không còn dùng được"}
                </Badge>
              )}
              {ticket.expires && (
                <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  Hạn dùng đến {ticket.expires}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-[21px] font-bold leading-snug tracking-[-0.4px]" style={{ textWrap: "pretty" }}>
              {ticket.value}
            </h1>
            <p className="mt-0.5 text-[14px]" style={{ color: "var(--tx2)" }}>
              {ticket.title}
              {ticket.recipient ? ` · tặng ${ticket.recipient}` : ""}
            </p>

            <div className="mt-4 flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: "var(--sf2)", border: "1px dashed var(--bdS)" }}>
              <Ticket size={18} className="flex-none" style={{ color: "var(--ac)" }} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                  Mã voucher
                </p>
                <p className="truncate text-[18px] font-bold tracking-[0.06em]">{ticket.code}</p>
              </div>
              <button type="button" onClick={copyCode} className={btn(copied ? "soft" : "secondary", "sm")}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép mã" : "Chép mã"}
              </button>
            </div>

            {!usable && (
              <div className="mt-4">
                <Callout tone="amber" icon={CircleAlert}>
                  Voucher này không còn dùng được. Liên hệ studio nếu bạn cần hỗ trợ.
                </Callout>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2">
              {usable && bookUrl && (
                <a href={bookUrl} className={btn("primary", "lg", "w-full")}>
                  <CalendarCheck size={18} /> Đặt lịch ngay với voucher này
                </a>
              )}
              <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                <button type="button" onClick={save} disabled={saving} className={btn("secondary", "md", "w-full")}>
                  <Download size={16} className="flex-none" /> {saving ? "Đang tạo ảnh…" : "Lưu về máy"}
                </button>
                {tel ? (
                  <a href={tel} className={btn("secondary", "md", "w-full")}>
                    <Phone size={16} className="flex-none" /> Gọi studio
                  </a>
                ) : null}
              </div>
            </div>
          </header>

          {/* Tấm voucher — thiết kế riêng, giữ nguyên. */}
          <Card className="flex justify-center" style={{ background: "#efe6d8", color: "#2b2118" }}>
            <div className="w-full max-w-[400px]">
              <VoucherTicket d={ticket} />
            </div>
          </Card>

          <Section title="Cách dùng" desc={usable ? "Mỗi voucher dùng một lần." : undefined}>
            <ul className="flex flex-col gap-2">
              <li className="flex gap-2.5 text-[14px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                <Check size={16} className="mt-[3px] flex-none" style={{ color: "var(--ac)" }} />
                <span>
                  {usable
                    ? "Đặt lịch bằng nút ở trên, hoặc đọc mã voucher cho studio khi ký hợp đồng lần sau."
                    : "Voucher này không còn dùng được. Liên hệ studio nếu bạn cần hỗ trợ."}
                </span>
              </li>
              {(ticket.terms ?? []).map((t, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                  <Check size={16} className="mt-[3px] flex-none" style={{ color: "var(--ac)" }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Section>
        </Stack>
      </CustomerMainV2>
    </CustomerRootAuto>
  );
}
