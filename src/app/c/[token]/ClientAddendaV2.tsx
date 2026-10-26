"use client";

import { Check, FilePlus2, PenLine } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import { Badge, Field, Section, btn, inputCls } from "@/components/v2/kit";
import { vnd } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { addendumLabel, addendumTotal, type ContractAddendum } from "@/lib/contract-addenda";
import { useAddendumSign } from "./useAddendumSign";

/**
 * Phụ lục hợp đồng — giao diện mới. Cùng logic ký với bản cũ (./useAddendumSign):
 * phụ lục chưa ký hiện các dòng thêm/bớt + ô ký; ký xong máy chủ chép các dòng
 * thành hạng mục và trang tải lại.
 */
export default function ClientAddendaV2({
  token,
  phone,
  lang,
  addenda,
  onSigned,
  id,
}: {
  token: string;
  phone: string;
  lang: "vi" | "en";
  addenda: ContractAddendum[];
  onSigned: () => void;
  id?: string;
}) {
  const { vi, name, setName, setSignature, busyId, err, sign } = useAddendumSign({ token, phone, lang, onSigned });

  if (!addenda.length) return null;
  const waiting = addenda.filter((a) => !a.signed_at).length;

  return (
    <Section
      id={id}
      icon={FilePlus2}
      title={vi ? "Phụ lục hợp đồng" : "Contract addenda"}
      desc={
        waiting
          ? vi
            ? `${waiting} phụ lục chờ bạn ký — ký xong số tiền được cộng vào hợp đồng.`
            : `${waiting} addendum awaiting your signature.`
          : vi
            ? "Các thay đổi đã được hai bên xác nhận."
            : "All changes confirmed."
      }
    >
      <div className="flex flex-col gap-3" data-testid="client-addenda">
        {addenda.map((a) => {
          const total = addendumTotal(a.lines);
          return (
            <div key={a.id} className="rounded-[12px] p-4" style={{ border: "1px solid var(--bd)", background: a.signed_at ? "var(--sf)" : "var(--sf2)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold">{addendumLabel(a)}</p>
                  <div className="mt-1">
                    {a.signed_at ? (
                      <Badge tone="green" icon={Check}>
                        {vi ? "Đã xác nhận" : "Confirmed"}
                      </Badge>
                    ) : (
                      <Badge tone="amber" dot>
                        {vi ? "Chờ bạn ký" : "Awaiting signature"}
                      </Badge>
                    )}
                  </div>
                </div>
                <span className="flex-none whitespace-nowrap text-[16px] font-bold" style={{ fontVariantNumeric: "tabular-nums", color: total < 0 ? "var(--am)" : "var(--tx)" }}>
                  {total >= 0 ? "+" : ""}
                  {vnd(total)}
                </span>
              </div>
              <ul className="mt-3 flex flex-col">
                {a.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-[13.5px]" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
                    <span className="min-w-0" style={{ color: "var(--tx2)" }}>
                      {l.name}
                      {l.qty > 1 ? ` × ${l.qty}` : ""}
                    </span>
                    <span className="flex-none whitespace-nowrap font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {vnd(l.qty * l.unit_price)}
                    </span>
                  </li>
                ))}
              </ul>
              {a.note && (
                <p className="mt-2 text-[13px]" style={{ color: "var(--tx3)" }}>
                  {a.note}
                </p>
              )}
              {a.signed_at ? (
                <p className="mt-3 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--gn)" }}>
                  <Check size={15} /> {a.signed_name} · {fmtDateTime(a.signed_at)}
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-3 pt-4" style={{ borderTop: "1px solid var(--bd)" }}>
                  <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>
                    {vi
                      ? "Ký để đồng ý phụ lục này. Tổng hợp đồng sẽ cộng thêm số tiền trên."
                      : "Sign to agree with this addendum. The amount above is added to the contract total."}
                  </p>
                  <Field label={vi ? "Họ tên người ký" : "Signer's full name"}>
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={vi ? "Họ và tên" : "Full name"} />
                  </Field>
                  <Field label={vi ? "Chữ ký" : "Signature"}>
                    <div className="[&_canvas]:[border:1.5px_dashed_var(--bdS)]">
                      <SignaturePad onChange={setSignature} height={130} />
                    </div>
                  </Field>
                  {err && (
                    <p className="text-[13px] font-medium" style={{ color: "var(--rd)" }}>
                      {err}
                    </p>
                  )}
                  <button type="button" onClick={() => sign(a.id)} disabled={busyId === a.id} className={btn("primary", "lg", "w-full")}>
                    <PenLine size={17} /> {busyId === a.id ? (vi ? "Đang ký…" : "Signing…") : vi ? "Đồng ý & ký phụ lục" : "Agree & sign"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
