"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Link as LinkIcon, Copy, Check, Eye, EyeOff, Sparkles, Pencil, X, Home, GripVertical, FileEdit, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import LogoUpload from "@/components/LogoUpload";
import { PRICE_LISTS, WEDDING_SEED, ENGAGEMENT_SEED, type SeedItem } from "@/lib/pricelist-seeds";
import { nextQuoteCode, newShareToken } from "@/lib/contract-code";
import { fmtDate } from "@/lib/date";
import { BANKS } from "@/lib/banks";
import { VietQR } from "@/components/VietQR";
import { vnd, type PricelistItem } from "@/lib/types";

type Contact = { pl_phone: string; pl_facebook: string; pl_bank_holder: string; pl_bank_account: string; pl_bank_name: string; pl_bank_bin: string };
type Appearance = { pl_bg: string; pl_text: string; pl_accent: string; pl_logo_url: string };

const DEFAULT_APPEARANCE: Appearance = { pl_bg: "#e7ebdf", pl_text: "#23402c", pl_accent: "#2f6b3e", pl_logo_url: "" };

export default function PricingManager({
  ownerId,
  initial,
  hiddenLists: initialHidden = [],
  listLabels: initialListLabels = {},
  shareUrl,
  contact,
  appearance,
  services = [],
  showClauses: initialShowClauses = false,
  canQuote = false,
}: {
  ownerId: string;
  initial: PricelistItem[];
  hiddenLists?: string[];
  listLabels?: Record<string, string>;
  shareUrl: string; // base /gia/<token>
  contact: Contact;
  appearance: Appearance;
  services?: { id: string; name: string }[];
  showClauses?: boolean;
  canQuote?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [list, setList] = useState<PricelistItem[]>(initial);
  // Báo giá nhanh từ bảng giá (gộp tính năng báo giá vào bảng giá cho gọn).
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePicks, setQuotePicks] = useState<Set<string>>(new Set());
  const [quoteClient, setQuoteClient] = useState({ name: "", phone: "" });
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  // Built-in lists the studio has hidden (e.g. removed "Cưới" / "Đính hôn").
  const [hiddenLists, setHiddenLists] = useState<string[]>(initialHidden);
  const visibleBuiltIns = PRICE_LISTS.filter((l) => !hiddenLists.includes(l.key));
  const [activeList, setActiveList] = useState((visibleBuiltIns[0] ?? PRICE_LISTS[0]).key);
  const [f, setF] = useState({ name: "", price: 0, unit: "", category: "", description: "" });
  const [c, setC] = useState<Contact>(contact);
  const [savedContact, setSavedContact] = useState(false);
  const [ap, setAp] = useState<Appearance>(appearance);
  const [savedAppear, setSavedAppear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", price: 0, unit: "", category: "", description: "" });
  const [note, setNote] = useState({ name: "", description: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  // Custom list types (beyond the built-in 2). Stored in localStorage + synced to profiles.
  const [customLists, setCustomLists] = useState<{ key: string; label: string; title: string }[]>([]);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  // Per-key label overrides (both built-in and custom lists).
  const [listLabels, setListLabels] = useState<Record<string, string>>(initialListLabels);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [showClauses, setShowClauses] = useState(initialShowClauses);

  async function toggleShowClauses() {
    const next = !showClauses;
    setShowClauses(next);
    await supabase.from("profiles").update({ pl_show_clauses: next }).eq("id", ownerId);
  }

  // Load custom lists from localStorage on mount. Lists created before labels
  // were stored in the DB only have their readable name in localStorage, so the
  // public page would show the bare slug (e.g. "k-yu" for "Kỷ yếu"). Back-fill
  // any missing labels into pl_list_labels so the public page shows them too.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pl_custom_lists_${ownerId}`);
      const parsed = raw ? (JSON.parse(raw) as { key: string; label: string; title: string }[]) : [];
      // Studio services are the price-list categories: ensure each active service
      // has a list entry (key = service id, label = service name). Existing
      // built-in/custom lists with data are preserved untouched.
      const byKey = new Map(parsed.map((l) => [l.key, l]));
      for (const s of services) {
        byKey.set(s.id, { key: s.id, label: s.name, title: `Bảng giá ${s.name}` });
      }
      const merged = Array.from(byKey.values());
      setCustomLists(merged);
      localStorage.setItem(`pl_custom_lists_${ownerId}`, JSON.stringify(merged));
      // Back-fill readable labels into the DB so the public page shows names.
      const missing: Record<string, string> = {};
      for (const l of merged) {
        if (l.label && l.label !== l.key && initialListLabels[l.key] !== l.label) missing[l.key] = l.label;
      }
      if (Object.keys(missing).length) {
        const nextLabels = { ...initialListLabels, ...missing };
        setListLabels(nextLabels);
        supabase.from("profiles").update({ pl_list_labels: nextLabels }).eq("id", ownerId);
      }
      // Prefer a service tab as the default active list.
      if (services[0]) setActiveList((cur) => (byKey.has(cur) ? cur : services[0].id));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const allLists = [...visibleBuiltIns, ...customLists];

  function saveCustomLists(next: typeof customLists) {
    setCustomLists(next);
    localStorage.setItem(`pl_custom_lists_${ownerId}`, JSON.stringify(next));
  }

  async function saveHiddenLists(next: string[]) {
    setHiddenLists(next);
    await supabase.from("profiles").update({ pl_hidden_lists: next }).eq("id", ownerId);
  }

  // "Delete" a built-in list (Cưới / Đính hôn): hide its tab everywhere
  // (dashboard + public). Reversible via "restore". Items are kept so nothing
  // is lost; an empty hidden list simply never shows.
  async function removeBuiltinList(key: string) {
    const label = PRICE_LISTS.find((l) => l.key === key)?.label ?? key;
    if (!confirm(`Xóa bảng giá "${label}"? Bạn có thể khôi phục lại sau.`)) return;
    const next = [...new Set([...hiddenLists, key])];
    await saveHiddenLists(next);
    if (activeList === key) {
      const remaining = [...PRICE_LISTS.filter((l) => !next.includes(l.key)), ...customLists];
      setActiveList((remaining[0] ?? PRICE_LISTS[0]).key);
    }
  }

  async function restoreBuiltinList(key: string) {
    await saveHiddenLists(hiddenLists.filter((k) => k !== key));
    setActiveList(key);
  }

  function getLabel(key: string, fallback: string) {
    return listLabels[key] || fallback;
  }

  function startRename(key: string, currentLabel: string) {
    setRenamingKey(key);
    setRenameVal(listLabels[key] || currentLabel);
  }

  async function saveRename(key: string) {
    const label = renameVal.trim();
    if (!label) { setRenamingKey(null); return; }
    const next = { ...listLabels, [key]: label };
    setListLabels(next);
    setRenamingKey(null);
    await supabase.from("profiles").update({ pl_list_labels: next }).eq("id", ownerId);
  }

  async function addCustomList() {
    const label = newListName.trim();
    if (!label) return;
    // Slugify for the URL/list_key. Vietnamese chars are stripped here, so the
    // human-readable label is stored separately in pl_list_labels (and shown on
    // both dashboard and the public price page).
    const base = label
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D")
      .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const key = base || `loai-${Object.keys(listLabels).length + customLists.length + 1}`;
    if (allLists.some((l) => l.key === key)) return;
    const entry = { key, label, title: `Bảng giá ${label}` };
    saveCustomLists([...customLists, entry]);
    // Persist the readable label so the public page shows it (not the slug).
    const nextLabels = { ...listLabels, [key]: label };
    setListLabels(nextLabels);
    setActiveList(key);
    setNewListName("");
    setShowNewList(false);
    await supabase.from("profiles").update({ pl_list_labels: nextLabels }).eq("id", ownerId);
  }

  function removeCustomList(key: string) {
    saveCustomLists(customLists.filter((l) => l.key !== key));
    if (activeList === key) setActiveList(PRICE_LISTS[0].key);
  }

  function startEdit(it: PricelistItem) {
    setEditId(it.id);
    setEdit({ name: it.name, price: it.price, unit: it.unit || "", category: it.category || "", description: it.description || "" });
  }
  async function saveEdit(id: string) {
    const patch = {
      name: edit.name.trim() || "(chưa đặt tên)",
      price: Math.max(0, Math.round(Number(edit.price) || 0)),
      unit: edit.unit.trim() || null,
      category: edit.category.trim() || null,
      description: edit.description.trim() || null,
    };
    await supabase.from("studio_pricelist").update(patch).eq("id", id);
    setList((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setEditId(null);
  }

  async function saveAppearance() {
    await supabase.from("profiles").update({
      pl_bg: ap.pl_bg || null,
      pl_text: ap.pl_text || null,
      pl_accent: ap.pl_accent || null,
      pl_logo_url: ap.pl_logo_url.trim() || null,
    }).eq("id", ownerId);
    setSavedAppear(true);
    setTimeout(() => setSavedAppear(false), 1500);
  }

  // Unique categories from the current list for quick-select datalist
  const categoryOptions = [...new Set(
    list
      .filter((it) => (it.list_key || "cuoi") === activeList && it.category)
      .map((it) => it.category as string)
  )];

  const visible = list.filter((it) => (it.list_key || "cuoi") === activeList);
  const pkgs = visible.filter((it) => it.price > 0).sort((a, b) => a.position - b.position);
  const notes = visible.filter((it) => it.price === 0).sort((a, b) => a.position - b.position);
  const listUrl = shareUrl ? `${shareUrl}?list=${activeList}` : "";

  // Drag-to-reorder packages within the active list. Reorders the package cards
  // and reassigns the same set of position slots so notes/other lists stay put.
  async function reorderPkg(targetId: string) {
    const src = dragId;
    setDragId(null);
    if (!src || src === targetId) return;
    const from = pkgs.findIndex((p) => p.id === src);
    const to = pkgs.findIndex((p) => p.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...pkgs];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const slots = pkgs.map((p) => p.position).sort((a, b) => a - b);
    const updates = reordered
      .map((p, i) => ({ id: p.id, position: slots[i] }))
      .filter((u) => pkgs.find((p) => p.id === u.id)?.position !== u.position);
    if (updates.length === 0) return;
    setList((prev) => prev.map((x) => { const u = updates.find((y) => y.id === x.id); return u ? { ...x, position: u.position } : x; }));
    await Promise.all(updates.map((u) => supabase.from("studio_pricelist").update({ position: u.position }).eq("id", u.id)));
  }

  async function seedActive() {
    const rows: SeedItem[] = activeList === "dinh-hon" ? ENGAGEMENT_SEED : WEDDING_SEED;
    setBusy(true);
    const payload = rows.map((s, i) => ({ ...s, owner_id: ownerId, list_key: activeList, position: list.length + i }));
    const { data, error } = await supabase.from("studio_pricelist").insert(payload).select("*");
    setBusy(false);
    if (!error && data) setList((p) => [...p, ...(data as PricelistItem[])]);
  }

  async function saveContact() {
    await supabase.from("profiles").update(c).eq("id", ownerId);
    setSavedContact(true);
    setTimeout(() => setSavedContact(false), 1500);
  }

  async function add() {
    if (!f.name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_pricelist")
      .insert({
        owner_id: ownerId,
        list_key: activeList,
        name: f.name.trim(),
        price: Math.max(0, Math.round(Number(f.price) || 0)),
        unit: f.unit.trim() || null,
        category: f.category.trim() || null,
        description: f.description.trim() || null,
        position: list.length,
      })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setList((p) => [...p, data as PricelistItem]);
      setF({ name: "", price: 0, unit: "", category: "", description: "" });
    }
  }

  async function toggleActive(it: PricelistItem) {
    await supabase.from("studio_pricelist").update({ active: !it.active }).eq("id", it.id);
    setList((p) => p.map((x) => (x.id === it.id ? { ...x, active: !x.active } : x)));
  }
  async function toggleHome(it: PricelistItem) {
    const next = !it.show_on_home;
    await supabase.from("studio_pricelist").update({ show_on_home: next }).eq("id", it.id);
    setList((p) => p.map((x) => (x.id === it.id ? { ...x, show_on_home: next } : x)));
  }
  async function addNote() {
    if (!note.name.trim() && !note.description.trim()) return;
    const { data, error } = await supabase
      .from("studio_pricelist")
      .insert({ owner_id: ownerId, list_key: activeList, name: note.name.trim() || "Ghi chú", price: 0, category: note.name.trim() || "Ghi chú", description: note.description.trim() || null, position: list.length })
      .select("*")
      .single();
    if (!error && data) {
      setList((p) => [...p, data as PricelistItem]);
      setNote({ name: "", description: "" });
    }
  }
  async function remove(id: string) {
    await supabase.from("studio_pricelist").delete().eq("id", id);
    setList((p) => p.filter((x) => x.id !== id));
  }

  function toggleQuoteOpen() {
    setQuoteErr(null);
    setQuoteOpen((o) => {
      const next = !o;
      // Mở lần đầu → chọn sẵn tất cả gói của bảng giá đang xem.
      if (next) setQuotePicks(new Set(pkgs.map((p) => p.id)));
      return next;
    });
  }
  function toggleQuotePick(id: string) {
    setQuotePicks((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  // Tạo một báo giá từ các gói đã chọn trong bảng giá, rồi mở trình sửa báo giá.
  async function createQuoteFromList() {
    const picked = pkgs.filter((p) => quotePicks.has(p.id));
    if (picked.length === 0) { setQuoteErr("Chọn ít nhất 1 gói để báo giá."); return; }
    setQuoteBusy(true);
    setQuoteErr(null);
    try {
      const code = await nextQuoteCode(supabase, ownerId);
      const token = newShareToken();
      const listLabel = getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "");
      // Nếu tab bảng giá là một dịch vụ (key = service id) thì gắn điều khoản dịch vụ đó.
      const svcId = services.find((s) => s.id === activeList)?.id;
      const { data: quote, error: qErr } = await supabase
        .from("studio_quotes")
        .insert({
          owner_id: ownerId,
          code,
          title: `Báo giá ${listLabel} ${fmtDate(new Date())}`.trim(),
          client_name: quoteClient.name.trim() || null,
          client_phone: quoteClient.phone.trim() || null,
          ...(svcId ? { service_id: svcId } : {}),
          client_token: token,
          status: "draft",
        })
        .select("id")
        .single();
      if (qErr || !quote) throw new Error(qErr?.message || "Không tạo được báo giá.");
      const rows = picked.map((p, idx) => ({
        quote_id: quote.id,
        name: p.name,
        description: p.description || null,
        qty: 1,
        unit_price: p.price || 0,
        is_optional: false,
        is_discount: false,
        selected: true,
        position: idx,
      }));
      const { error: iErr } = await supabase.from("quote_items").insert(rows);
      if (iErr) throw new Error(iErr.message);
      router.push(`/dashboard/studio/quotes/${quote.id}`);
    } catch (e) {
      setQuoteErr(e instanceof Error ? e.message : "Lỗi không xác định.");
      setQuoteBusy(false);
    }
  }

  return (
    <div className="page-in">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Mỗi loại dịch vụ có một bảng giá và link riêng để gửi khách.
      </p>

      {/* List tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {allLists.map((l) => {
          const isCustom = customLists.some((c) => c.key === l.key);
          const displayLabel = getLabel(l.key, l.label);
          return (
            <div key={l.key} className="relative flex items-center">
              {renamingKey === l.key ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    className="input h-9 w-36 rounded-full px-3 text-sm"
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRename(l.key); if (e.key === "Escape") setRenamingKey(null); }}
                  />
                  <button onClick={() => saveRename(l.key)} className="btn-primary rounded-full px-2 py-1.5 text-xs"><Check size={13} /></button>
                  <button onClick={() => setRenamingKey(null)} className="btn-ghost rounded-full px-2 py-1.5 text-xs"><X size={13} /></button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setActiveList(l.key)}
                    className="rounded-[9px] px-4 py-2 text-[12.5px] font-semibold"
                    style={{
                      background: activeList === l.key ? "var(--acS)" : "var(--sf)",
                      border: `1px solid ${activeList === l.key ? "var(--acM)" : "var(--bd)"}`,
                      color: activeList === l.key ? "var(--ac)" : "var(--tx2)",
                      paddingRight: 48,
                    }}
                  >
                    Bảng giá {displayLabel}
                  </button>
                  <button
                    onClick={() => startRename(l.key, l.label)}
                    className="absolute right-7 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ color: "var(--text3)" }}
                    title="Đổi tên bảng giá"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={() => (isCustom ? removeCustomList(l.key) : removeBuiltinList(l.key))}
                    className="absolute right-1 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ color: "var(--text3)" }}
                    title="Xoá bảng giá này"
                  >
                    <X size={11} />
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* Add new list type */}
        {showNewList ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input h-9 w-36 rounded-full px-3 text-sm"
              placeholder="Tên loại mới…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCustomList(); if (e.key === "Escape") setShowNewList(false); }}
            />
            <button onClick={addCustomList} className="btn-primary rounded-full px-3 py-1.5 text-xs"><Check size={13} /></button>
            <button onClick={() => setShowNewList(false)} className="btn-ghost rounded-full px-3 py-1.5 text-xs"><X size={13} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewList(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
            style={{ border: "1px dashed var(--border2)", color: "var(--text3)" }}
          >
            <Plus size={13} /> Thêm loại mới
          </button>
        )}
      </div>

      {/* Restore hidden built-in lists */}
      {PRICE_LISTS.some((l) => hiddenLists.includes(l.key)) && (
        <div className="mb-6 -mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text3)" }}>
          <span>Đã ẩn:</span>
          {PRICE_LISTS.filter((l) => hiddenLists.includes(l.key)).map((l) => (
            <button
              key={l.key}
              onClick={() => restoreBuiltinList(l.key)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ border: "1px dashed var(--border2)" }}
              title="Khôi phục bảng giá"
            >
              <Plus size={11} /> {l.label}
            </button>
          ))}
        </div>
      )}

      {listUrl && (
        <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <LinkIcon size={16} style={{ color: "var(--text3)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>Link bảng giá {getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "")} gửi khách</p>
            <p className="truncate text-sm" style={{ color: "var(--text2)" }}>{listUrl}</p>
          </div>
          <a href={listUrl} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs">Xem thử</a>
          <button onClick={() => { navigator.clipboard?.writeText(listUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost px-3 py-2 text-xs">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép link"}
          </button>
        </div>
      )}

      {/* Báo giá nhanh — gộp tính năng báo giá vào bảng giá cho gọn */}
      {canQuote && (
      <div className="card mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FileEdit size={16} style={{ color: "var(--accent)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Báo giá cho khách</p>
            <p className="text-[12px]" style={{ color: "var(--text3)" }}>Chọn gói từ bảng giá này để tạo báo giá gửi khách — không cần nhập lại.</p>
          </div>
          <Link href="/dashboard/studio/quotes" className="btn-ghost px-3 py-2 text-xs">Danh sách báo giá</Link>
          <button onClick={toggleQuoteOpen} className="btn-primary px-3 py-2 text-xs">
            <ChevronDown size={14} className="transition-transform" style={{ transform: quoteOpen ? "rotate(180deg)" : "none" }} /> Tạo báo giá
          </button>
        </div>

        {quoteOpen && (
          <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {pkgs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text3)" }}>Bảng giá này chưa có gói nào. Thêm gói bên dưới rồi tạo báo giá.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pkgs.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface2)" }}>
                      <input type="checkbox" checked={quotePicks.has(p.id)} onChange={() => toggleQuotePick(p.id)} />
                      <span className="min-w-0 flex-1 truncate">{p.name}{p.category ? <span className="text-[11px]" style={{ color: "var(--text3)" }}> · {p.category}</span> : null}</span>
                      <span className="font-medium">{vnd(p.price)}</span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="field"><label className="label">Tên khách (tuỳ chọn)</label><input className="input" value={quoteClient.name} onChange={(e) => setQuoteClient((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div className="field"><label className="label">SĐT khách (tuỳ chọn)</label><input className="input" inputMode="numeric" value={quoteClient.phone} onChange={(e) => setQuoteClient((p) => ({ ...p, phone: e.target.value }))} /></div>
                </div>
                {quoteErr && <p className="text-sm" style={{ color: "var(--danger)" }}>{quoteErr}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={createQuoteFromList} disabled={quoteBusy} className="btn-primary">
                    {quoteBusy ? "Đang tạo…" : `Tạo báo giá (${quotePicks.size} gói)`}
                  </button>
                  <span className="text-xs" style={{ color: "var(--text3)" }}>
                    Tạm tính: <b style={{ color: "var(--text2)" }}>{vnd(pkgs.filter((p) => quotePicks.has(p.id)).reduce((s, p) => s + (p.price || 0), 0))}</b>
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* Contact + bank (shared across both lists) */}
      <div className="card mb-6 p-6">
        <h2 className="mb-4 font-serif text-lg font-medium">Liên hệ &amp; chuyển khoản (hiện trên bảng giá)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field"><label className="label">Số điện thoại</label><input className="input" value={c.pl_phone} onChange={(e) => setC((p) => ({ ...p, pl_phone: e.target.value }))} /></div>
          <div className="field"><label className="label">Facebook</label><input className="input" placeholder="fb.com/…" value={c.pl_facebook} onChange={(e) => setC((p) => ({ ...p, pl_facebook: e.target.value }))} /></div>
          <div className="field"><label className="label">Chủ tài khoản</label><input className="input" value={c.pl_bank_holder} onChange={(e) => setC((p) => ({ ...p, pl_bank_holder: e.target.value }))} /></div>
          <div className="field"><label className="label">Số tài khoản</label><input className="input" value={c.pl_bank_account} onChange={(e) => setC((p) => ({ ...p, pl_bank_account: e.target.value }))} /></div>
          <div className="field">
            <label className="label">Ngân hàng</label>
            <select
              className="input"
              value={c.pl_bank_bin}
              onChange={(e) => {
                const b = BANKS.find((x) => x.bin === e.target.value);
                setC((p) => ({ ...p, pl_bank_bin: e.target.value, pl_bank_name: b ? b.name : p.pl_bank_name }));
              }}
            >
              <option value="">— Chọn ngân hàng (để tạo mã QR) —</option>
              {BANKS.map((b) => (
                <option key={b.bin} value={b.bin}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={saveContact} className="btn-primary mt-4">{savedContact ? <Check size={15} /> : null} {savedContact ? "Đã lưu" : "Lưu liên hệ"}</button>

        {/* QR preview — confirms the bank config works; this is the studio's open QR. */}
        <div className="mt-6 border-t pt-6" style={{ borderColor: "var(--border)" }}>
          <h3 className="mb-3 text-sm font-medium">Mã QR chuyển khoản (xem trước)</h3>
          {c.pl_bank_bin && c.pl_bank_account ? (
            <>
              <VietQR bank={{ bin: c.pl_bank_bin, account: c.pl_bank_account, holder: c.pl_bank_holder, name: c.pl_bank_name }} amount={0} addInfo="" />
              <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text3)" }}>Mã mở (khách tự nhập số tiền). Trong hợp đồng / công nợ, QR sẽ tự điền sẵn số tiền.</p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--text3)" }}>Chọn <b>Ngân hàng</b> + nhập <b>Số tài khoản</b> rồi bấm <b>Lưu liên hệ</b> để xem mã QR.</p>
          )}
        </div>
      </div>

      {/* Appearance: background / text / accent colours + logo on the public poster */}
      <div className="card mb-6 p-6">
        <h2 className="mb-1 font-serif text-lg font-medium">Giao diện bảng giá</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text2)" }}>Chọn màu nền, màu chữ, màu nhấn và logo hiển thị trên bảng giá gửi khách.</p>
        <label className="mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
          <input type="checkbox" checked={showClauses} onChange={toggleShowClauses} />
          Hiện điều khoản của dịch vụ trên bảng giá công khai
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["pl_bg", "Màu nền"],
            ["pl_text", "Màu chữ"],
            ["pl_accent", "Màu nhấn"],
          ] as [keyof Appearance, string][]).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={ap[key] || DEFAULT_APPEARANCE[key]} onChange={(e) => setAp((p) => ({ ...p, [key]: e.target.value }))} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg" style={{ border: "1px solid var(--border)", background: "transparent" }} />
                <input className="input" value={ap[key]} placeholder={DEFAULT_APPEARANCE[key]} onChange={(e) => setAp((p) => ({ ...p, [key]: e.target.value }))} />
              </div>
            </div>
          ))}
          <div className="field">
            <LogoUpload
              ownerId={ownerId}
              value={ap.pl_logo_url}
              onChange={(url) => setAp((p) => ({ ...p, pl_logo_url: url }))}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={saveAppearance} className="btn-primary">{savedAppear ? <Check size={15} /> : null} {savedAppear ? "Đã lưu" : "Lưu giao diện"}</button>
          <button onClick={() => setAp(DEFAULT_APPEARANCE)} className="btn-ghost px-3 py-2 text-xs">Khôi phục mặc định</button>
          {/* Live preview swatch */}
          <span className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm" style={{ background: ap.pl_bg || DEFAULT_APPEARANCE.pl_bg, color: ap.pl_text || DEFAULT_APPEARANCE.pl_text, border: "1px solid var(--border)" }}>
            {ap.pl_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ap.pl_logo_url} alt="logo" className="h-5 w-5 rounded object-contain" />
            ) : null}
            Xem trước · <b style={{ color: ap.pl_accent || DEFAULT_APPEARANCE.pl_accent }}>10.000.000đ</b>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-fit p-6">
          <h2 className="mb-4 font-serif text-lg font-medium">Thêm mục</h2>
          <div className="space-y-3">
            <div className="field"><label className="label">Tên dịch vụ</label><input className="input" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Giá</label><MoneyInput value={f.price} onChange={(n) => setF((p) => ({ ...p, price: n }))} /></div>
              <div className="field"><label className="label">Đơn vị</label><input className="input" placeholder="/ gói" value={f.unit} onChange={(e) => setF((p) => ({ ...p, unit: e.target.value }))} /></div>
            </div>
            <div className="field">
              <label className="label">Nhóm</label>
              <input
                className="input"
                placeholder="Gói chụp / Gói quay…"
                value={f.category}
                list="category-options"
                onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
              />
              <datalist id="category-options">
                {categoryOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="field field-top"><label className="label">Mô tả (mỗi dòng 1 ý)</label><textarea className="input min-h-[70px]" value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} /></div>
            <button onClick={add} disabled={busy} className="btn-primary w-full"><Plus size={15} /> {busy ? "Đang thêm…" : "Thêm vào bảng giá"}</button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {visible.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-4 py-16 text-center text-sm" style={{ color: "var(--text3)" }}>
              <p>Bảng giá {getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "")} đang trống.</p>
              <button onClick={seedActive} disabled={busy} className="btn-primary"><Sparkles size={15} /> Dùng mẫu giá {getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "")}</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="font-serif text-lg font-medium">Các gói dịch vụ</h2>
                {pkgs.length > 1 && <p className="text-xs" style={{ color: "var(--text3)" }}>Kéo thả <GripVertical size={12} className="inline" /> để đổi vị trí các gói.</p>}
                {pkgs.length === 0 && <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có gói nào.</p>}
                {pkgs.map((it) =>
                  editId === it.id ? (
                    <div key={it.id} className="card space-y-2 p-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="input" placeholder="Tên" value={edit.name} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <MoneyInput placeholder="Giá" value={edit.price} onChange={(n) => setEdit((p) => ({ ...p, price: n }))} />
                          <input className="input" placeholder="Đơn vị" value={edit.unit} onChange={(e) => setEdit((p) => ({ ...p, unit: e.target.value }))} />
                        </div>
                      </div>
                      <input className="input" placeholder="Nhóm" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value }))} />
                      <textarea className="input min-h-[70px]" placeholder="Mô tả (mỗi dòng 1 ý)" value={edit.description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(it.id)} className="btn-primary px-3 py-1.5 text-xs"><Check size={14} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className="btn-ghost px-3 py-1.5 text-xs"><X size={14} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={() => setDragId(it.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => reorderPkg(it.id)}
                      onDragEnd={() => setDragId(null)}
                      className="card flex items-start gap-3 p-4"
                      style={{ opacity: dragId === it.id ? 0.4 : it.active ? 1 : 0.5, cursor: "grab" }}
                    >
                      <GripVertical size={16} className="mt-0.5 shrink-0" style={{ color: "var(--text3)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {it.name} {it.category && <span className="text-[11px]" style={{ color: "var(--text3)" }}>· {it.category}</span>}
                        </p>
                        <p className="font-serif text-lg font-medium" style={{ color: "var(--accent)" }}>{vnd(it.price)}<span className="text-xs" style={{ color: "var(--text3)" }}>{it.unit ? ` ${it.unit}` : ""}</span></p>
                        {it.description && <p className="whitespace-pre-line text-xs" style={{ color: "var(--text3)" }}>{it.description}</p>}
                        {!it.show_on_home && <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Ẩn ở trang chủ</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => toggleHome(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title={it.show_on_home ? "Đang hiện ở trang chủ — bấm để ẩn" : "Đang ẩn ở trang chủ — bấm để hiện"} style={{ color: it.show_on_home ? "var(--accent)" : "var(--text3)" }}>
                          <Home size={14} />
                        </button>
                        <button onClick={() => startEdit(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title="Sửa"><Pencil size={14} /></button>
                        <button onClick={() => toggleActive(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title={it.active ? "Đang hiện" : "Đang ẩn"}>
                          {it.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => remove(it.id)} className="btn-ghost px-2.5 py-1.5 text-xs"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-lg font-medium">Chi phí phát sinh &amp; lưu ý</h2>
                <p className="text-xs" style={{ color: "var(--text3)" }}>Các mục ghi chú riêng, hiển thị tách khỏi gói ở cuối bảng giá.</p>
                {notes.map((it) =>
                  editId === it.id ? (
                    <div key={it.id} className="card space-y-2 p-4">
                      <input className="input" placeholder="Tiêu đề (vd: Phát sinh thêm)" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value, name: e.target.value }))} />
                      <textarea className="input min-h-[70px]" placeholder="Nội dung (mỗi dòng 1 ý)" value={edit.description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(it.id)} className="btn-primary px-3 py-1.5 text-xs"><Check size={14} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className="btn-ghost px-3 py-1.5 text-xs"><X size={14} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <div key={it.id} className="card flex items-start justify-between gap-3 p-4" style={{ opacity: it.active ? 1 : 0.5 }}>
                      <div>
                        <p className="font-medium">{it.category || it.name}</p>
                        {it.description && <p className="whitespace-pre-line text-xs" style={{ color: "var(--text3)" }}>{it.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => startEdit(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title="Sửa"><Pencil size={14} /></button>
                        <button onClick={() => toggleActive(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title={it.active ? "Đang hiện" : "Đang ẩn"}>
                          {it.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => remove(it.id)} className="btn-ghost px-2.5 py-1.5 text-xs"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
                <div className="card space-y-2 p-4">
                  <input className="input" placeholder="Tiêu đề mục (vd: Phát sinh thêm, Lưu ý…)" value={note.name} onChange={(e) => setNote((p) => ({ ...p, name: e.target.value }))} />
                  <textarea className="input min-h-[60px]" placeholder="Nội dung (mỗi dòng 1 ý)" value={note.description} onChange={(e) => setNote((p) => ({ ...p, description: e.target.value }))} />
                  <button onClick={addNote} className="btn-ghost w-full px-3 py-2 text-xs"><Plus size={14} /> Thêm mục ghi chú</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
