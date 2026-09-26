"use client";

import { useState } from "react";
import { Check, PenLine } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import { vnd } from "@/lib/types";
import { fmtDateTime } from "@/lib/date";
import { addendumLabel, addendumTotal, type ContractAddendum } from "@/lib/contract-addenda";

/**
 * Phụ lục hợp đồng trên trang khách. Phụ lục chưa ký hiện nguyên văn các dòng
 * thêm/bớt + ô ký; ký xong thì các dòng vào bảng hạng mục phía trên và tổng
 * tiền tự cộng (máy chủ chép chúng thành hạng mục hợp đồng).
 */
export default function ClientAddenda({
  token,
  phone,
  lang,
  addenda,
  onSigned,
}: {
  token: string;
  phone: string;
  lang: "vi" | "en";
  addenda: ContractAddendum[];
  onSigned: () => void;
}) {
  const vi = lang === "vi";
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!addenda.length) return null;

  async function sign(id: string) {
    if (!name.trim()) {
      setErr(vi ? "Nhập họ tên người ký." : "Enter the signer's name.");
      return;
    }
    setErr(null);
    setBusyId(id);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign_addendum", phone, addendum_id: id, name: name.trim(), signature }),
    });
    setBusyId(null);
    if (res.ok) onSigned();
    else setErr(vi ? "Có lỗi xảy ra, thử lại nhé." : "Something went wrong.");
  }

  return (
    <div className="overflow-hidden rounded-[14px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }} data-testid="client-addenda">
      <div className="px-5 py-4 text-[10.5px] font-extrabold uppercase" style={{ letterSpacing: ".7px", color: "var(--tx3)", borderBottom: "1px solid var(--bd2)" }}>
        {vi ? "Phụ lục hợp đồng" : "Contract addenda"}
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        {addenda.map((a) => {
          const total = addendumTotal(a.lines);
          return (
            <div key={a.id} className="rounded-[11px] p-3.5" style={{ border: "1px solid var(--bd)", background: "var(--sf2)" }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13.5px] font-semibold">{addendumLabel(a)}</p>
                <span className="tnum flex-none text-[14px] font-bold">{total >= 0 ? "+" : ""}{vnd(total)}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                {a.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
                    <span className="tnum flex-none">{vnd(l.qty * l.unit_price)}</span>
                  </li>
                ))}
              </ul>
              {a.note && <p className="mt-2 text-[12px]" style={{ color: "var(--tx3)" }}>{a.note}</p>}
              {a.signed_at ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>
                  <Check size={15} /> {vi ? "Đã xác nhận" : "Confirmed"} · {a.signed_name} · {fmtDateTime(a.signed_at)}
                </p>
              ) : (
                <div className="mt-3">
                  <p className="mb-2 text-[12px]" style={{ color: "var(--tx2)" }}>
                    {vi ? "Ký để đồng ý phụ lục này. Tổng hợp đồng sẽ cộng thêm số tiền trên." : "Sign to agree with this addendum. The amount above is added to the contract total."}
                  </p>
                  <input
                    className="w-full rounded-[11px] px-3.5 py-3 text-[13.5px]"
                    style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx)" }}
                    placeholder={vi ? "Họ tên người ký" : "Signer's full name"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div className="mt-2.5">
                    <SignaturePad onChange={setSignature} height={130} />
                  </div>
                  {err && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
                  <button
                    onClick={() => sign(a.id)}
                    disabled={busyId === a.id}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[14px] font-bold disabled:opacity-60"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <PenLine size={17} /> {busyId === a.id ? (vi ? "Đang ký…" : "Signing…") : (vi ? "Đồng ý & ký phụ lục" : "Agree & sign")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
