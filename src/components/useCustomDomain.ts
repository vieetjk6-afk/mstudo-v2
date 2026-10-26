"use client";

import { useState } from "react";
import { apexOf, hostLabel, pointingRecords, type DnsRow } from "@/lib/domain-dns";

/**
 * Trạng thái + thao tác của ô "Tên miền riêng" — dùng chung cho bản cũ
 * (CustomDomain) và bản giao diện mới (CustomDomainV2). Cùng route
 * /api/site/domain, cùng câu báo.
 */
export function useCustomDomain(initialDomain: string | null, initialVerified: boolean) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [saved, setSaved] = useState(initialDomain ?? "");
  const [verified, setVerified] = useState(initialVerified);
  const [dns, setDns] = useState<DnsRow[]>([]);
  const [busy, setBusy] = useState<null | "set" | "verify" | "remove">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  // Hướng dẫn mở sẵn khi tên miền đã lưu mà chưa chạy — đó là lúc studio cần nó.
  const [guideOpen, setGuideOpen] = useState(!!initialDomain && !initialVerified);
  const [copied, setCopied] = useState<string | null>(null);

  // Bản ghi hiện ngay từ tên miền đã lưu (không phải chờ bấm "Kiểm tra"); máy
  // chủ trả về bản đầy đủ hơn (giá trị Vercel gợi ý riêng, TXT xác minh) thì dùng bản đó.
  const rows: DnsRow[] = dns.length ? dns : saved ? pointingRecords(saved) : [];

  function copy(v: string) {
    navigator.clipboard?.writeText(v).then(() => {
      setCopied(v);
      setTimeout(() => setCopied((c) => (c === v ? null : c)), 1500);
    }).catch(() => {});
  }

  async function call(action: string, extra?: Record<string, unknown>) {
    setBusy(action as typeof busy);
    setMsg(null);
    const res = await fetch("/api/site/domain", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg(d.hint || (d.error === "domain_taken" ? "Tên miền đã được dùng bởi tài khoản khác." : d.error === "bad_domain" ? "Tên miền không hợp lệ." : "Có lỗi, thử lại."));
      return null;
    }
    if (d.dns) setDns(d.dns);
    if (typeof d.configured === "boolean") setConfigured(d.configured);
    return d;
  }

  async function set() {
    const d = await call("set", { domain });
    if (!d) return;
    setSaved(d.custom_domain);
    setVerified(!!d.verified);
    setGuideOpen(!d.verified);
    // d.hint: lý do cụ thể khi Vercel từ chối (vd domain đang ở project khác) —
    // nói thẳng thay vì bảo studio đi trỏ DNS trong khi DNS không phải vấn đề.
    setMsg(d.verified ? "Đã kết nối tên miền!" : (d.hint as string) || "Đã lưu. Trỏ DNS theo hướng dẫn rồi bấm “Kiểm tra”.");
  }
  async function verify() {
    const d = await call("verify");
    if (!d) return;
    setVerified(!!d.verified);
    if (!d.verified) setGuideOpen(true);
    setMsg(d.verified
      ? "Tên miền đã xác minh — trang chạy trên domain của bạn."
      : (d.hint as string) || (d.ownershipOk === false && d.dnsOk
        ? "DNS đã trỏ đúng, còn thiếu bản ghi TXT xác minh bên dưới."
        : "Chưa thấy DNS trỏ về mstudo. Kiểm tra lại bản ghi bên dưới — DNS mới thường mất 5–30 phút, có khi tới vài giờ."));
  }
  async function remove() {
    if (!confirm("Gỡ tên miền riêng khỏi trang?")) return;
    const d = await call("remove");
    if (!d) return;
    setSaved(""); setDomain(""); setVerified(false); setDns([]);
    setMsg("Đã gỡ tên miền.");
  }

  return {
    domain, setDomain, saved, verified, rows, busy, msg, configured,
    guideOpen, setGuideOpen, copied, copy, set, verify, remove,
  };
}

export type CustomDomainState = ReturnType<typeof useCustomDomain>;

/** Bản còn lại của cặp "có www / không www" để nhắc studio chọn đúng một bản. */
export function hostLabelHint(domain: string): string {
  return hostLabel(domain) === "www" ? apexOf(domain) : hostLabel(domain) ? `www.${apexOf(domain)}` : `www.${domain}`;
}
