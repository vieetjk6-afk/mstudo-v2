"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Lock, MapPin, CalendarDays, Check, Package, Images, MessagesSquare, LifeBuoy,
  FileText, Download, StickyNote, ArrowRight, Clock,
} from "lucide-react";
import { useToast } from "@/components/studio/Toast";
import { ProgressBar } from "@/components/studio/ui";
import { fmtDate, fmtDateLunar, todayVN } from "@/lib/date";
import { apptTimeRange, apptTitle, kindMeta } from "@/lib/appointments";
import {
  CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, PRODUCT_STATUS_LABEL, SHOOT_TYPE_LABEL,
  contractTotal, sumAmounts,
} from "@/lib/types";
import AlbumView from "./AlbumView";
import PaymentPanel from "./PaymentPanel";
import { PORTAL_STEPS, portalSteps, type PortalPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   CỔNG KHÁCH HÀNG — giai đoạn ĐANG THỰC HIỆN
   Hợp đồng đã hoàn thành thì cùng route chuyển sang <AlbumView> (nền tối).

   Chữ to hơn khu quản lý, không thuật ngữ nội bộ, không hiện tiền công ê-kíp
   hay ghi chú nội bộ — payload của /api/c/[token] đã lọc sẵn những thứ đó.
   ═══════════════════════════════════════════════════════════════════════════ */

const MONTH_SHORT = ["THG 1", "THG 2", "THG 3", "THG 4", "THG 5", "THG 6", "THG 7", "THG 8", "THG 9", "THG 10", "THG 11", "THG 12"];

const card: React.CSSProperties = { background: "var(--sf)", border: "1px solid var(--bd)" };

export default function ContractPortalView({ token }: { token: string }) {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  /** Số điện thoại đã mở khoá — giữ lại để gửi kèm mọi thao tác ghi sau đó
   *  (báo đã chuyển khoản, gửi đánh giá): endpoint kiểm SĐT ở MỌI lần gọi. */
  const [unlocked, setUnlocked] = useState("");

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(
        j.error === "wrong_phone"
          ? "Số điện thoại không khớp. Vui lòng kiểm tra lại."
          : j.error === "not_found"
            ? "Không tìm thấy hợp đồng."
            : "Có lỗi xảy ra, thử lại sau."
      );
      return;
    }
    setData((await res.json()) as PortalPayload);
    setUnlocked(phone);
  }

  /* ── Cổng chặn ─────────────────────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
        <form onSubmit={unlock} className="w-full max-w-[400px] rounded-[16px] px-7 py-8 text-center" style={card}>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Lock size={21} />
          </span>
          <h1 className="mt-3.5 text-[21px] font-bold" style={{ letterSpacing: "-.5px" }}>Trang hợp đồng của bạn</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
            Nhập số điện thoại đã đăng ký để xem lịch trình, thanh toán và sản phẩm.
          </p>
          <input
            className="mt-5 w-full rounded-[11px] px-3.5 py-3 text-center text-[15px] font-semibold tracking-wide"
            style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
            inputMode="numeric"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {err && <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-3.5 w-full rounded-[11px] py-3 text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            {loading ? "Đang mở…" : "Mở trang của tôi"}
          </button>
          <Link href={`/c/${token}`} className="mt-4 block text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            Xem bản hợp đồng đầy đủ →
          </Link>
        </form>
      </div>
    );
  }

  /* ── Hợp đồng đã hoàn thành → trang album ─────────────────────────────── */
  if (data.contract.status === "completed") {
    return <AlbumView token={token} phone={unlocked} data={data} />;
  }

  return <ActivePortal token={token} phone={unlocked} data={data} toast={toast} toastNode={toastNode} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GIAI ĐOẠN ĐANG THỰC HIỆN
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivePortal({
  token, phone, data, toast, toastNode,
}: {
  token: string;
  phone: string;
  data: PortalPayload;
  toast: (m: string) => void;
  toastNode: React.ReactNode;
}) {
  const c = data.contract;
  const today = todayVN();
  const total = useMemo(() => contractTotal(data.items), [data.items]);
  const paid = useMemo(() => sumAmounts(data.payments), [data.payments]);
  const steps = useMemo(() => portalSteps(data), [data]);
  const currentStep = steps.findIndex((s) => !s);
  const tone = CONTRACT_STATUS_TONE[c.status];

  /**
   * Lịch trình khách xem = lịch hẹn (studio_appointments) + các mốc ghi chú của
   * hợp đồng (studio_events). Gộp hai nguồn rồi sắp theo ngày: khách chỉ quan
   * tâm "ngày nào làm gì", không quan tâm studio lưu ở bảng nào.
   */
  const timeline = useMemo(() => {
    const fromAppts = data.appointments.map((a) => ({
      key: `a-${a.id}`,
      date: a.appt_date,
      time: a.start_time ? apptTimeRange(a) : "",
      title: apptTitle(a),
      place: [a.room, a.location].filter(Boolean).join(" · "),
      note: a.note,
      kind: a.kind,
      done: a.status === "done" || (a.status !== "cancelled" && a.appt_date < today),
    }));
    const fromEvents = data.milestones.map((m) => ({
      key: `e-${m.id}`,
      date: m.event_date,
      time: m.event_time ?? "",
      title: m.title,
      place: "",
      note: m.note,
      kind: null as null,
      done: m.event_date < today,
    }));
    return [...fromAppts, ...fromEvents].sort((x, y) => x.date.localeCompare(y.date) || x.time.localeCompare(y.time));
  }, [data.appointments, data.milestones, today]);

  return (
    <main className="client-doc min-h-screen">
      <div className="mx-auto w-full max-w-[1080px] px-[18px] pb-[70px] pt-[22px]">
        {/* ── Đầu trang ─────────────────────────────────────────────────── */}
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: "1.2px", color: "var(--tx3)" }}>
              Trang hợp đồng của khách hàng
            </p>
            {/* Bản thiết kế dùng Lora cho tên khách; repo đã có một font serif
                (Cormorant Garamond) dành riêng cho trang khách — dùng lại nó
                thay vì nạp thêm một họ phông thứ hai chỉ cho một dòng chữ. */}
            <h1 className="font-serif text-[26px] font-semibold leading-tight" style={{ textWrap: "balance" }}>
              {c.client_name || c.title}
            </h1>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <Link
              href={`/c/${token}`}
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
              style={{ ...card, color: "var(--tx2)" }}
            >
              <FileText size={15} /> Bản hợp đồng
            </Link>
          </div>
        </div>

        {/* ── Thẻ hợp đồng + stepper ───────────────────────────────────── */}
        <div className="rounded-[16px] px-5 py-[18px]" style={card}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[12px] font-bold" style={{ fontFamily: "ui-monospace, monospace", color: "var(--tx3)" }}>
              {c.code || "—"}
            </span>
            <span
              className="rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {CONTRACT_STATUS_LABEL[c.status]}
            </span>
            {c.event_date && (
              <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                <CalendarDays size={15} style={{ color: "var(--tx3)" }} /> {fmtDateLunar(c.event_date)}
                {c.event_time ? ` · ${c.event_time}` : ""}
              </span>
            )}
            {c.location && (
              <span className="flex min-w-0 items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                <MapPin size={15} style={{ flex: "none", color: "var(--tx3)" }} />
                <span className="truncate">{c.location}</span>
              </span>
            )}
            {data.studio_phone && (
              <a
                href={`tel:${data.studio_phone}`}
                className="ml-auto flex flex-none items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-bold"
                style={{ background: "var(--acS)", color: "var(--ac)" }}
              >
                <MessagesSquare size={15} /> Nhắn cho studio
              </a>
            )}
          </div>

          <h2 className="mt-2.5 text-[20px] font-bold" style={{ letterSpacing: "-.4px", textWrap: "pretty" }}>
            {c.title}
          </h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {SHOOT_TYPE_LABEL[c.shoot_type] ?? "Dịch vụ"} · {data.studio_name}
          </p>

          {/* Stepper 6 bước — cuộn ngang trên điện thoại */}
          <div className="mt-4 flex gap-0 overflow-x-auto pb-1">
            {PORTAL_STEPS.map((label, i) => {
              const done = steps[i];
              const current = i === currentStep;
              return (
                <div key={label} className="flex min-w-[104px] flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <span className="h-[2px] flex-1" style={{ background: i === 0 ? "transparent" : steps[i - 1] ? "var(--ac)" : "var(--bd)" }} />
                    <span
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-bold"
                      style={
                        done
                          ? { background: "var(--ac)", color: "#fff", border: "1.5px solid var(--ac)" }
                          : current
                            ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--acM)" }
                            : { background: "var(--sf2)", color: "var(--tx3)", border: "1.5px solid var(--bd)" }
                      }
                    >
                      {done ? <Check size={15} /> : i + 1}
                    </span>
                    <span className="h-[2px] flex-1" style={{ background: i === PORTAL_STEPS.length - 1 ? "transparent" : done ? "var(--ac)" : "var(--bd)" }} />
                  </div>
                  <span
                    className="mt-1.5 px-1 text-center text-[11.5px]"
                    style={{ color: done ? "var(--ac)" : current ? "var(--tx)" : "var(--tx3)", fontWeight: done || current ? 700 : 550, textWrap: "balance" }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Hai cột ───────────────────────────────────────────────────── */}
        <div className="mt-3.5 grid grid-cols-1 gap-3.5 min-[1000px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5">
            {/* Lịch trình */}
            <section className="rounded-[16px] px-5 pb-3 pt-[18px]" style={card}>
              <h3 className="text-[15px] font-bold">Lịch trình của bạn</h3>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                Thử đồ · Trang điểm · Chụp · Chọn ảnh · Nhận sản phẩm
              </p>

              {timeline.length === 0 ? (
                <p className="mt-4 rounded-[12px] px-4 py-5 text-center text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                  Studio đang xếp lịch cho bạn. Các mốc hẹn sẽ hiện ở đây ngay khi có.
                </p>
              ) : (
                <div className="mt-3 flex flex-col">
                  {timeline.map((t, i) => {
                    const meta = t.kind ? kindMeta(t.kind) : null;
                    const upcoming = !t.done && t.date >= today;
                    const dotColor = t.done ? "var(--gn)" : upcoming ? "var(--ac)" : "var(--bd)";
                    const d = new Date(t.date + "T00:00:00");
                    return (
                      <div key={t.key} className="flex gap-3">
                        {/* Cột ngày: tháng ngắn + ngày to */}
                        <div className="w-[52px] flex-none pt-3 text-right">
                          <p className="text-[10.5px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>
                            {MONTH_SHORT[d.getMonth()]}
                          </p>
                          <p className="tnum text-[18px] font-bold leading-none" style={{ letterSpacing: "-.5px" }}>
                            {String(d.getDate()).padStart(2, "0")}
                          </p>
                        </div>

                        <div className="flex w-[14px] flex-none flex-col items-center pt-[18px]">
                          <span
                            className="h-[11px] w-[11px] flex-none rounded-full"
                            style={{ background: dotColor, border: "2px solid var(--sf)", boxShadow: `0 0 0 2px color-mix(in srgb, ${dotColor} 22%, var(--sf))` }}
                          />
                          {i < timeline.length - 1 && <span className="mt-1 w-[2px] flex-1" style={{ background: "var(--bd2)" }} />}
                        </div>

                        <div className="min-w-0 flex-1 pb-3.5 pt-2.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {meta && (
                              <span
                                className="inline-flex items-center gap-1 rounded-[20px] px-2.5 py-[3px] text-[11px] font-bold"
                                style={{ background: meta.tone.soft, color: meta.tone.fg }}
                              >
                                <meta.Icon size={12} /> {meta.label}
                              </span>
                            )}
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: t.done ? "var(--gn)" : upcoming ? "var(--ac)" : "var(--tx3)" }}
                            >
                              {t.done ? "Đã hoàn tất" : upcoming ? "Sắp tới" : "Chờ lịch"}
                            </span>
                          </div>
                          <p className="mt-1 text-[14.5px] font-bold" style={{ textWrap: "pretty" }}>{t.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                            {t.time && <span className="tnum flex items-center gap-1"><Clock size={14} style={{ color: "var(--tx3)" }} /> {t.time}</span>}
                            {t.place && <span className="flex items-center gap-1"><MapPin size={14} style={{ color: "var(--tx3)" }} /> {t.place}</span>}
                          </p>
                          {t.note && (
                            <p className="mt-1.5 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px]" style={{ background: "var(--amS)", color: "var(--tx2)" }}>
                              <StickyNote size={14} style={{ flex: "none", color: "var(--am)" }} />
                              <span style={{ textWrap: "pretty" }}>{t.note}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Sản phẩm & tiến độ */}
            {data.products.length > 0 && (
              <section className="rounded-[16px] px-5 pb-4 pt-[18px]" style={card}>
                <h3 className="text-[15px] font-bold">Sản phẩm & tiến độ</h3>
                <div className="mt-2.5 flex flex-col">
                  {data.products.map((p) => {
                    const pct = p.status === "done" ? 100 : p.status === "in_progress" ? 50 : 0;
                    const col = p.status === "done" ? "var(--gn)" : p.status === "in_progress" ? "var(--bl)" : "var(--tx3)";
                    return (
                      <div key={p.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                        <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--sf2)", lineHeight: 0 }}>
                          <Package size={17} style={{ color: col }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold" style={{ textWrap: "pretty" }}>{p.name}</p>
                          <p className="tnum text-[11.5px]" style={{ color: "var(--tx3)" }}>Số lượng {p.qty}</p>
                        </div>
                        <div className="w-[120px] flex-none">
                          <p className="text-[11.5px] font-bold" style={{ color: col }}>
                            {PRODUCT_STATUS_LABEL[p.status]} · <span className="tnum">{pct}%</span>
                          </p>
                          <ProgressBar pct={pct} color={col} height={5} className="mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Album xem trước */}
            {(data.selection || data.gallery) && (
              <section className="rounded-[16px] px-5 pb-4 pt-[18px]" style={card}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold">Ảnh của bạn</h3>
                  <span className="rounded-[20px] px-2.5 py-[4px] text-[11px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    {data.gallery ? "Album đã giao" : "Đang chờ bạn chọn ảnh"}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                  {data.gallery
                    ? "Album hoàn thiện đã sẵn sàng — mở để xem và tải về."
                    : "Mở album để đánh dấu những tấm bạn thích; studio hậu kỳ theo lựa chọn của bạn."}
                </p>
                <Link
                  href={data.gallery ? `/album/${data.gallery.slug}` : `/a/${data.selection!.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-bold"
                  style={{ background: "var(--ac)", color: "#fff" }}
                >
                  <Images size={16} /> {data.gallery ? "Mở album của bạn" : "Chọn ảnh của bạn"} <ArrowRight size={15} />
                </Link>
              </section>
            )}
          </div>

          {/* ── Cột phải ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3.5">
            <PaymentPanel
              token={token}
              phone={phone}
              total={total}
              paid={paid}
              plan={data.plan}
              payments={data.payments}
              bank={data.bank}
              studioName={data.studio_name}
              contractCode={data.contract.code}
              toast={toast}
            />

            {/* Hồ sơ hợp đồng */}
            <section className="rounded-[16px] px-5 py-[18px]" style={card}>
              <h3 className="text-[15px] font-bold">Hồ sơ hợp đồng</h3>
              <div className="mt-2 flex flex-col">
                <FileRow
                  href={`/c/${token}`}
                  icon={FileText}
                  title="Bản hợp đồng"
                  sub={c.client_signed_at ? `Bạn đã ký ${fmtDate(c.client_signed_at)}` : "Chưa ký — mở để xem và ký"}
                />
                <FileRow
                  href={`/c/${token}`}
                  icon={Download}
                  title="Bảng hạng mục & phiếu thu"
                  sub={`${data.items.length} hạng mục · ${data.payments.length} lần thu`}
                />
                {data.wedding?.published && (
                  <FileRow href={`/thiep/${data.wedding.slug}`} icon={Images} title="Thiệp cưới điện tử" sub="Studio tặng kèm hợp đồng" />
                )}
                {data.story?.published && (
                  <FileRow href={`/story/${data.story.slug}`} icon={Images} title="Trang Love Story" sub="Studio tặng kèm hợp đồng" />
                )}
              </div>
            </section>

            {/* Thẻ hỗ trợ */}
            <section className="rounded-[16px] px-5 py-[18px]" style={{ background: "var(--acS)", border: "1px solid var(--acM)" }}>
              <p className="flex items-center gap-1.5 text-[14px] font-bold" style={{ color: "var(--ac)" }}>
                <LifeBuoy size={17} /> Cần đổi lịch hay hỏi thêm?
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                Theo điều khoản hợp đồng, lịch hẹn xin đổi trước <b>72 giờ</b> để studio kịp xếp lại ê-kíp và phòng.
                Nhắn cho {data.studio_name} sớm nhất khi bạn cần thay đổi.
              </p>
              {data.studio_phone && (
                <a
                  href={`tel:${data.studio_phone}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2.5 text-[13px] font-bold"
                  style={{ background: "var(--ac)", color: "#fff" }}
                >
                  <MessagesSquare size={16} /> Gọi studio · {data.studio_phone}
                </a>
              )}
            </section>
          </div>
        </div>
      </div>
      {toastNode}
    </main>
  );
}

function FileRow({
  href, icon: Icon, title, sub,
}: { href: string; icon: typeof FileText; title: string; sub: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
      <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--sf2)", lineHeight: 0 }}>
        <Icon size={16} style={{ color: "var(--tx2)" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{sub}</span>
      </span>
      <ArrowRight size={16} style={{ flex: "none", color: "var(--tx3)" }} />
    </Link>
  );
}
