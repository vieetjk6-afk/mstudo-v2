"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SearchX, FileText, User, IdCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { commandItems, noAccent, type NavAccess, type NavItem } from "@/lib/studio-nav";

type Hit = {
  key: string;
  icon: NavItem["icon"];
  title: string;
  sub: string;
  href: string;
  tag: string;
  tagC: string;
  tagBg: string;
};

type ContractRow = { id: string; title: string; code: string | null; client_name: string | null; client_phone: string | null };
type CrewRow = { id: string; name: string; phone: string | null; role: string | null };

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Ô lệnh ⌘K — tính năng mới số 2 của bản thiết kế: một chỗ duy nhất để tới bất
 * kỳ màn nào, mở hợp đồng, khách hoặc nhân sự. Gõ KHÔNG DẤU cũng ra ("hop dong").
 *
 * Đây cũng là thứ giữ cho việc gộp sidebar xuống 24 mục không làm mất đường tới
 * những màn đã rời khỏi nav (lịch đội ngũ, nhân viên, mẫu hợp đồng, nén ảnh…).
 */
export default function StudioCommandK({ access }: { access: NavAccess }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Chỉ tìm dữ liệu người dùng được phép xem — cùng bộ luật với sidebar.
  const actions = useMemo(() => commandItems(access), [access]);
  const canSeeContracts = actions.some((a) => a.href === "/dashboard/studio/contracts");
  const canSeeClients = actions.some((a) => a.href === "/dashboard/studio/clients");
  const canSeeCrew = actions.some((a) => a.href === "/dashboard/studio/staff");

  // ⌘K / Ctrl+K mở, Escape đóng. Bắt ở window để bấm được từ mọi màn.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) { setQ(""); setContracts([]); setCrew([]); setCursor(0); return; }
    // autoFocus không dùng được vì ô nhập chỉ tồn tại khi mở.
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  // Tìm hợp đồng + nhân sự trên server, gõ xong 250ms mới hỏi.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setContracts([]); setCrew([]); return; }
    const safe = term.replace(/[%,()]/g, " ");
    let stale = false;
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const [c, k] = await Promise.all([
        canSeeContracts || canSeeClients
          ? supabase.from("studio_contracts")
              .select("id, title, code, client_name, client_phone")
              .or(`title.ilike.%${safe}%,client_name.ilike.%${safe}%,client_phone.ilike.%${safe}%,code.ilike.%${safe}%`)
              .order("created_at", { ascending: false })
              .limit(12)
          : Promise.resolve({ data: [] }),
        canSeeCrew
          ? supabase.from("studio_crew")
              .select("id, name, phone, role")
              .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
              .limit(6)
          : Promise.resolve({ data: [] }),
      ]);
      if (stale) return;
      setContracts((c.data ?? []) as ContractRow[]);
      setCrew((k.data ?? []) as CrewRow[]);
      setCursor(0);
    }, 250);
    return () => { stale = true; clearTimeout(handle); };
  }, [q, open, canSeeContracts, canSeeClients, canSeeCrew]);

  const hits = useMemo<Hit[]>(() => {
    const cq = noAccent(q.trim());
    const hit = (t: string) => !cq || noAccent(t).includes(cq);

    const acts: Hit[] = actions
      .filter((a) => hit(`${a.label} ${a.keywords ?? ""}`))
      .slice(0, cq ? 5 : 6)
      .map((a) => ({
        key: `a:${a.href}`, icon: a.icon, title: a.label, sub: a.sub || "Mở màn hình",
        href: a.href, tag: "Hành động", tagC: "var(--ac)", tagBg: "var(--acS)",
      }));

    const cts: Hit[] = !cq || !canSeeContracts ? [] : contracts.slice(0, 4).map((c) => ({
      key: `c:${c.id}`, icon: FileText, title: c.title,
      sub: [c.code, c.client_name, c.client_phone].filter(Boolean).join(" · ") || "Hợp đồng",
      href: `/dashboard/studio/contracts/${c.id}`, tag: "Hợp đồng", tagC: "var(--bl)", tagBg: "var(--blS)",
    }));

    // Khách hàng của repo là dữ liệu gộp từ hợp đồng (không có bảng riêng) —
    // gom theo số điện thoại đúng như màn Khách hàng đang làm.
    const seen = new Set<string>();
    const kls: Hit[] = !cq || !canSeeClients ? [] : contracts.reduce<Hit[]>((out, c) => {
      const phone = digits(c.client_phone);
      const key = phone || (c.client_name ?? "");
      if (!key || seen.has(key) || out.length >= 3) return out;
      if (!hit(`${c.client_name ?? ""} ${c.client_phone ?? ""}`)) return out;
      seen.add(key);
      out.push({
        key: `k:${key}`, icon: User, title: c.client_name || c.client_phone || "Khách",
        sub: c.client_phone || "Chưa có số điện thoại",
        href: `/dashboard/studio/clients/${encodeURIComponent(key)}`,
        tag: "Khách", tagC: "var(--gn)", tagBg: "var(--gnS)",
      });
      return out;
    }, []);

    // Kiểm `canSeeCrew` cho giống hai khối trên. Dữ liệu nhân sự vốn chỉ được
    // nạp khi có quyền, nên đây là lớp chặn thứ hai — nhưng thiếu nó thì hôm
    // nào đổi chỗ nạp dữ liệu là rò ngay mà không ai để ý.
    const crw: Hit[] = !cq || !canSeeCrew ? [] : crew.slice(0, 3).map((c) => ({
      key: `w:${c.id}`, icon: IdCard, title: c.name,
      sub: [c.role, c.phone].filter(Boolean).join(" · ") || "Nhân sự",
      href: "/dashboard/studio/staff?tab=crew", tag: "Nhân sự", tagC: "var(--am)", tagBg: "var(--amS)",
    }));

    return [...acts, ...cts, ...kls, ...crw];
  }, [q, actions, contracts, crew, canSeeContracts, canSeeClients, canSeeCrew]);

  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && hits[cursor]) { e.preventDefault(); go(hits[cursor].href); }
  }

  // Giữ dòng đang chọn nằm trong tầm nhìn khi đi bằng bàn phím.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <>
      {/* Ô mở lệnh trên topbar — desktop hiện cả ô, mobile chỉ nút kính lúp. */}
      <button
        onClick={() => setOpen(true)}
        className="ck-bar hidden min-w-0 items-center gap-2 rounded-[9px] px-[11px] py-2 text-left sm:flex"
        style={{ flex: "0 1 250px", border: "1px solid var(--bd)", background: "var(--sf2)" }}
        aria-label="Tìm hoặc chạy lệnh"
      >
        <Search size={16} style={{ flex: "none", color: "var(--tx3)" }} />
        <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>Tìm hoặc chạy lệnh…</span>
        <span className="flex flex-none gap-[2px]">
          <kbd className="ck-key">⌘</kbd>
          <kbd className="ck-key">K</kbd>
        </span>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] sm:hidden"
        style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx2)" }}
        aria-label="Tìm kiếm"
      >
        <Search size={17} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="ck-overlay fixed inset-0 z-[95] flex items-start justify-center px-6 pb-6"
          style={{ paddingTop: "12vh", background: "rgba(24,18,28,.42)", backdropFilter: "blur(3px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Ô lệnh nhanh"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ck-panel w-full overflow-hidden rounded-2xl"
            style={{ maxWidth: 600, background: "var(--sf)", boxShadow: "0 24px 70px rgba(20,15,25,.32)" }}
          >
            <div className="flex items-center gap-[11px] px-[18px] py-[15px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <Search size={20} style={{ flex: "none", color: "var(--tx3)" }} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Tìm khách, mã hợp đồng, hoặc gõ việc muốn làm…"
                className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium outline-none"
                style={{ color: "var(--tx)" }}
              />
              <kbd className="ck-key flex-none">ESC</kbd>
            </div>

            <div ref={listRef} className="overflow-y-auto p-1.5" style={{ maxHeight: "56vh" }}>
              {hits.map((h, i) => (
                <button
                  key={h.key}
                  data-i={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(h.href)}
                  className="ck-row flex w-full items-center gap-3 rounded-[10px] px-3 py-[11px] text-left"
                  style={{ background: i === cursor ? "var(--acS)" : "transparent" }}
                >
                  <span className="flex-none rounded-[9px] p-2" style={{ background: "var(--sf2)", color: "var(--tx2)", lineHeight: 0 }}>
                    <h.icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{h.title}</span>
                    <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{h.sub}</span>
                  </span>
                  <span
                    className="flex-none whitespace-nowrap rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-bold"
                    style={{ background: h.tagBg, color: h.tagC }}
                  >
                    {h.tag}
                  </span>
                </button>
              ))}
              {hits.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <SearchX size={30} style={{ color: "var(--tx3)", margin: "0 auto" }} />
                  <p className="mt-2 text-[13px]" style={{ color: "var(--tx2)" }}>Không tìm thấy gì khớp.</p>
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-3.5 px-4 py-[9px] text-[11px]"
              style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)", color: "var(--tx3)" }}
            >
              <span>↑↓ chọn</span>
              <span>↵ mở</span>
              <span className="ml-auto truncate">{q ? "" : "Gõ tên khách, mã hợp đồng, hoặc việc muốn làm"}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
