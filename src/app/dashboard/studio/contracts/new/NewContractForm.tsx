"use client";

import { useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Plus, Trash2, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SHOOT_TYPE_LABEL, SHOOT_TYPES, vnd, type ShootType } from "@/lib/types";
import { nextContractCode, DEFAULT_TASKS } from "@/lib/contract-code";
import { fullClauseText } from "@/lib/contract-clauses";
import { fmtDate } from "@/lib/date";

export type TemplateOption = {
  id: string;
  name: string;
  shoot_type: ShootType;
  note: string | null;
  contract_template_items: { name: string; qty: number; unit_price: number; position: number }[];
};

export type ServiceOption = { id: string; name: string; clauses: string };

/** Gói dịch vụ lấy từ bảng giá (studio_pricelist, price > 0). */
export type PackageOption = {
  id: string;
  list_key: string;
  name: string;
  price: number;
  unit: string | null;
  category: string | null;
};

/** Một mốc lịch thêm (lưu vào studio_events). */
type ExtraEvent = { label: string; date: string; time: string };

export default function NewContractForm({
  ownerId,
  assignTo,
  templates,
  services = [],
  packages = [],
}: {
  ownerId: string;
  assignTo: string | null;
  templates: TemplateOption[];
  services?: ServiceOption[];
  packages?: PackageOption[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [shootType, setShootType] = useState<ShootType>("photo");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [eventDate, setEventDate] = useState("");
  // Gói dịch vụ đã chọn (từ bảng giá) → mỗi gói thành 1 hạng mục hợp đồng.
  const [pickedPackages, setPickedPackages] = useState<PackageOption[]>([]);
  // Lịch thêm của hợp đồng (tuỳ chọn) → studio_events.
  const [extraEvents, setExtraEvents] = useState<ExtraEvent[]>([]);
  // Tuỳ chọn nâng cao (ẩn mặc định cho gọn).
  const [addChecklist, setAddChecklist] = useState(true);
  const [makePhoto, setMakePhoto] = useState(true);
  const [makeVideo, setMakeVideo] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId) || null;

  // Nhóm gói theo bảng giá (list_key) để dropdown gọn gàng.
  const packageGroups = useMemo(() => {
    const map = new Map<string, PackageOption[]>();
    for (const p of packages) {
      const key = p.list_key || "khac";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [packages]);

  const packagesTotal = pickedPackages.reduce((s, p) => s + (p.price || 0), 0);

  function addPackage(id: string) {
    const p = packages.find((x) => x.id === id);
    if (!p) return;
    setPickedPackages((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, p]));
  }
  function removePackage(id: string) {
    setPickedPackages((prev) => prev.filter((x) => x.id !== id));
  }

  function addExtraEvent() {
    setExtraEvents((prev) => [...prev, { label: "", date: "", time: "" }]);
  }
  function updateExtraEvent(i: number, patch: Partial<ExtraEvent>) {
    setExtraEvents((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function removeExtraEvent(i: number) {
    setExtraEvents((prev) => prev.filter((_, idx) => idx !== i));
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setShootType(t.shoot_type);
  }

  async function create() {
    setErr(null);
    if (!/^\d{10}$/.test(clientPhone.replace(/\D/g, ""))) {
      setErr("SĐT khách phải đủ 10 số (dùng làm mật khẩu để khách mở cổng hợp đồng).");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "")
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const tpl = templates.find((x) => x.id === templateId);
    const code = await nextContractCode(supabase, ownerId);
    // Điều khoản cố định theo dịch vụ; nếu không có thì lấy mẫu / bộ mặc định.
    const note = selectedService?.clauses || tpl?.note || fullClauseText();
    // Tên tự đặt: "Hợp đồng {loại dịch vụ} {ngày tạo}".
    const autoTitle = selectedService
      ? `Hợp đồng ${selectedService.name} ${fmtDate(new Date())}`
      : `Hợp đồng ${fmtDate(new Date())}`;
    const { data, error } = await supabase
      .from("studio_contracts")
      .insert({
        owner_id: ownerId,
        code,
        title: title.trim() || autoTitle,
        client_name: clientName.trim() || null,
        client_phone: clientPhone.replace(/\D/g, "") || null,
        shoot_type: shootType,
        ...(serviceId ? { service_id: serviceId } : {}),
        event_date: eventDate || null,
        note,
        client_token: token,
        drive_make_photo: makePhoto,
        drive_make_video: makeVideo,
        ...(assignTo ? { assigned_to: assignTo } : {}),
      })
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      setErr(error?.message || "Không tạo được hợp đồng.");
      return;
    }

    // Hạng mục: mẫu (nếu có) trước, rồi tới các gói dịch vụ đã chọn từ bảng giá.
    const itemRows: { contract_id: string; name: string; qty: number; unit_price: number; position: number }[] = [];
    if (tpl && tpl.contract_template_items?.length) {
      [...tpl.contract_template_items]
        .sort((a, b) => a.position - b.position)
        .forEach((i) => itemRows.push({ contract_id: data.id, name: i.name, qty: i.qty, unit_price: i.unit_price, position: itemRows.length }));
    }
    for (const p of pickedPackages) {
      itemRows.push({ contract_id: data.id, name: p.name, qty: 1, unit_price: p.price || 0, position: itemRows.length });
    }
    if (itemRows.length) await supabase.from("contract_items").insert(itemRows);

    // Lịch thêm → studio_events (chỉ những mốc đã có ngày).
    const evRows = extraEvents
      .filter((e) => e.date)
      .map((e) => ({
        owner_id: ownerId,
        contract_id: data.id,
        title: e.label.trim() || (title.trim() || autoTitle),
        event_date: e.date,
        event_time: e.time || null,
        remind: true,
      }));
    if (evRows.length) await supabase.from("studio_events").insert(evRows);

    // Checklist hậu kỳ mặc định.
    if (addChecklist) {
      await supabase.from("contract_tasks").insert(
        DEFAULT_TASKS.map((label, position) => ({ contract_id: data.id, label, position }))
      );
    }
    setSaving(false);
    // Đồng bộ Google Calendar nếu có ngày (fire-and-forget).
    if (eventDate) {
      fetch("/api/gcal/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "contract", id: data.id, action: "upsert" }),
      }).catch(() => {});
    }
    router.push(`/dashboard/studio/contracts/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl page-in">
      <Link href="/dashboard/studio/contracts" className="mb-6 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--text3)" }}>
        <ArrowLeft size={15} /> Hợp đồng
      </Link>
      <h1 className="flex items-center gap-2 font-serif text-3xl font-medium">
        <Sparkles size={22} style={{ color: "var(--brand)" }} /> Tạo hợp đồng nhanh
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>
        Chỉ nhập thông tin cần thiết — phần còn lại tự điền. Chỉnh chi tiết ở bước sau nếu cần.
      </p>

      <div className="card mt-6 space-y-4 p-6">
        <div className="field">
          <label className="label">Tên hợp đồng</label>
          <input
            className="input"
            placeholder={selectedService ? `Hợp đồng ${selectedService.name} ${fmtDate(new Date())}` : "Để trống để tự đặt tên"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Tên khách hàng</label>
          <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">SĐT khách</label>
          <input className="input" inputMode="numeric" maxLength={15} placeholder="0901234567" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
        </div>

        {services.length > 0 ? (
          <div className="field">
            <label className="label">Loại dịch vụ</label>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label className="label">Loại dịch vụ</label>
            <select className="input" value={shootType} onChange={(e) => setShootType(e.target.value as ShootType)}>
              {SHOOT_TYPES.map((k) => (
                <option key={k} value={k}>{SHOOT_TYPE_LABEL[k]}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="label">Ngày thực hiện</label>
          <DateInput value={eventDate} onChange={(v) => setEventDate(v)} />
        </div>

        {/* Gói dịch vụ — lấy từ bảng giá */}
        <div>
          <div className="field">
            <label className="label">Gói dịch vụ</label>
            {packages.length > 0 ? (
              <select
                className="input"
                value=""
                onChange={(e) => { if (e.target.value) addPackage(e.target.value); }}
              >
                <option value="">— Chọn gói từ bảng giá —</option>
                {packageGroups.map(([key, items]) => (
                  <optgroup key={key} label={key}>
                    {items.map((p) => (
                      <option key={p.id} value={p.id} disabled={pickedPackages.some((x) => x.id === p.id)}>
                        {p.name} · {vnd(p.price)}{p.unit ? ` ${p.unit}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <div className="input flex items-center" style={{ color: "var(--text3)" }}>
                Chưa có gói nào trong bảng giá.
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] sm:pl-32" style={{ color: "var(--text3)" }}>
            Gói lấy từ{" "}
            <Link href="/dashboard/studio/pricing" className="hover:underline" style={{ color: "var(--brand, var(--accent))" }}>bảng giá</Link>. Mỗi gói thành một hạng mục trong hợp đồng.
          </p>
          {pickedPackages.length > 0 && (
            <div className="mt-2 space-y-1.5 sm:pl-32">
              {pickedPackages.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface2)" }}>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="font-medium">{vnd(p.price)}</span>
                  <button type="button" onClick={() => removePackage(p.id)} className="shrink-0" style={{ color: "var(--text3)" }} aria-label="Bỏ gói">
                    <X size={15} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 pt-1 text-sm font-semibold">
                <span>Tạm tính</span>
                <span style={{ color: "var(--brand)" }}>{vnd(packagesTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Lịch thêm (tuỳ chọn) */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label" style={{ margin: 0 }}>Lịch thêm (tuỳ chọn)</label>
            <button type="button" onClick={addExtraEvent} className="btn-ghost px-2.5 py-1 text-xs">
              <Plus size={13} /> Thêm mốc
            </button>
          </div>
          {extraEvents.length === 0 ? (
            <p className="text-[11px]" style={{ color: "var(--text3)" }}>
              Ví dụ: thử váy, chụp ngoại cảnh, lễ ăn hỏi… mỗi mốc sẽ hiện trong lịch của hợp đồng.
            </p>
          ) : (
            <div className="space-y-2">
              {extraEvents.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: "var(--surface2)" }}>
                  <input
                    className="input flex-1 min-w-[120px]"
                    placeholder="Nội dung (vd: Thử váy)"
                    value={e.label}
                    onChange={(ev) => updateExtraEvent(i, { label: ev.target.value })}
                  />
                  <div className="w-[150px]">
                    <DateInput value={e.date} onChange={(v) => updateExtraEvent(i, { date: v })} />
                  </div>
                  <input
                    className="input w-[90px]"
                    type="time"
                    value={e.time}
                    onChange={(ev) => updateExtraEvent(i, { time: ev.target.value })}
                  />
                  <button type="button" onClick={() => removeExtraEvent(i)} style={{ color: "var(--text3)" }} aria-label="Xoá mốc">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tuỳ chọn nâng cao — thu gọn cho đỡ rối */}
        <details className="group rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium">
            <ChevronDown size={16} className="transition-transform group-open:rotate-180" style={{ color: "var(--text3)" }} />
            Tuỳ chọn thêm (mẫu HĐ · thư mục ảnh · checklist)
          </summary>
          <div className="space-y-4 px-3 pb-3 pt-1">
            {templates.length > 0 && (
              <div className="field">
                <label className="label">Tạo từ mẫu</label>
                <select className="input" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">— Không dùng mẫu —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.contract_template_items?.length || 0} hạng mục)</option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
              <input type="checkbox" checked={addChecklist} onChange={(e) => setAddChecklist(e.target.checked)} />
              Thêm checklist hậu kỳ mặc định ({DEFAULT_TASKS.join(" → ")})
            </label>

            <div className="rounded-xl p-3" style={{ background: "var(--surface2)" }}>
              <div className="text-sm font-medium">Thư mục ảnh/video (MStudo Desktop)</div>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
                  <input type="checkbox" checked={makePhoto} onChange={(e) => setMakePhoto(e.target.checked)} />
                  Tạo thư mục ảnh (Photo → JPG Goc · Raw · File ChinhSua)
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
                  <input type="checkbox" checked={makeVideo} onChange={(e) => setMakeVideo(e.target.checked)} />
                  Có quay phim — tạo thư mục Video (Video Goc · Video HoanThien)
                </label>
              </div>
            </div>
          </div>
        </details>

        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}

        <button onClick={create} disabled={saving} className="btn-primary w-full">
          {saving ? "Đang tạo…" : "Tạo hợp đồng"}
        </button>
      </div>
    </div>
  );
}
