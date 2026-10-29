"use client";

import { useState } from "react";

/**
 * Ký phụ lục hợp đồng trên trang khách — dùng chung cho bản cũ (ClientAddenda)
 * và giao diện mới (ClientAddendaV2). Họ tên dùng chung cho mọi phụ lục chưa ký,
 * nhưng CHỮ KÝ giữ riêng theo từng phụ lục (mỗi phụ lục có khung ký riêng — dùng
 * chung thì vẽ ở khung A rồi bấm ký B sẽ ký B bằng nét của A). Ký xong gọi
 * onSigned để trang tải lại hợp đồng (máy chủ chép các dòng phụ lục thành hạng
 * mục, tổng tiền tự cộng).
 */
export function useAddendumSign({
  token,
  phone,
  lang,
  onSigned,
}: {
  token: string;
  phone: string;
  lang: "vi" | "en";
  onSigned: () => void;
}) {
  const vi = lang === "vi";
  const [name, setName] = useState("");
  const [signatures, setSignatures] = useState<Record<string, string | null>>({});
  const setSignatureFor = (id: string, v: string | null) => setSignatures((m) => ({ ...m, [id]: v }));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sign(id: string) {
    if (!name.trim()) {
      setErr(vi ? "Nhập họ tên người ký." : "Enter the signer's name.");
      return;
    }
    const signature = signatures[id] ?? null;
    if (!signature) {
      setErr(vi ? "Ký vào khung chữ ký trước nhé." : "Please sign in the signature box first.");
      return;
    }
    setErr(null);
    setBusyId(id);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign_addendum", phone, addendum_id: id, name: name.trim(), signature }),
    }).catch(() => null);
    setBusyId(null);
    if (res?.ok) onSigned();
    else setErr(vi ? "Có lỗi xảy ra, thử lại nhé." : "Something went wrong.");
  }

  return { vi, name, setName, setSignatureFor, busyId, err, sign };
}
