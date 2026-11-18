"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Film, Flame, Lock, Pencil, Sparkles, Trophy, X } from "lucide-react";
import PetSprite from "./PetSprite";
import {
  MOOD_LABEL, NAME_MAX, OUTFITS, STAGES, outfitHint, outfitUnlocked,
  type Mood, type OutfitKey, type PetSummary, type PetTaskKey,
} from "@/lib/pet";

/* ═══════════════════════════════════════════════════════════════════════════
   BÉ MÁY ẢNH — màn chơi. Dữ liệu và luật ở /api/pet + @/lib/pet; màn này chỉ
   hiển thị và gửi thao tác. Dùng biến màu chung (--ac, --sf, --tx…) nên chạy
   được cả giao diện cũ lẫn mới, sáng lẫn tối.
   ═══════════════════════════════════════════════════════════════════════════ */

type TaskRow = {
  key: PetTaskKey;
  title: string;
  desc: string;
  href: string | null;
  xp: number;
  claimed: boolean;
  ready: boolean;
};

export type PetState = {
  setup: true;
  today: string;
  pet: { name: string; outfit: OutfitKey | null; born: boolean };
  summary: PetSummary;
  tasks: TaskRow[];
};

const LINES: Record<Mood, string[]> = {
  vui: [
    "Hôm nay chụp đẹp nha!",
    "Ánh sáng giờ vàng là chân ái đó.",
    "Nhớ sao lưu thẻ nhớ sau buổi chụp nhé!",
    "Khách cười thật thì ảnh mới đẹp thật.",
    "Mình no rồi, đi làm việc thôi!",
    "Chụp dư vài tấm, chọn sau không tiếc.",
    "Gửi album sớm, khách vui, studio vui.",
  ],
  doi: [
    "Đói quá… cho mình một cuộn phim đi!",
    "Bụng kêu rột rột nè.",
    "Một cuộn phim thôi là đủ vui cả ngày.",
  ],
  buon: [
    "Lâu rồi bạn không ghé…",
    "Mình bám bụi hết rồi nè.",
    "Nhớ bạn quá à.",
  ],
};

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const weekday = (d: string) => WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()];

const ERR: Record<string, string> = {
  not_done: "Hôm nay chưa thấy việc này trong dữ liệu studio — làm xong rồi quay lại nhận nhé.",
  already: "Việc này hôm nay đã nhận rồi.",
  locked: "Phụ kiện này chưa mở.",
  bad_name: "Tên chưa hợp lệ.",
  rate_limited: "Bấm hơi nhanh, đợi một chút rồi thử lại nhé.",
  setup: "Cần chạy SQL cài đặt trước.",
};

/**
 * `initial` — dữ liệu dựng sẵn cho trang xem trước (/uipreview): có thì không
 * gọi /api/pet lúc mở màn.
 */
export default function PetView({ initial }: { initial?: PetState } = {}) {
  const [state, setState] = useState<PetState | null>(initial ?? null);
  const [setupMissing, setSetupMissing] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const [pop, setPop] = useState<{ id: number; text: string } | null>(null);
  const [anim, setAnim] = useState<"jump" | "wiggle" | null>(null);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pet", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setLoadErr(true);
    const j = await res.json().catch(() => null);
    if (!j) return setLoadErr(true);
    if (j.setup === false) return setSetupMissing(true);
    setState(j as PetState);
  }, []);

  useEffect(() => {
    if (!initial) void load();
  }, [load, initial]);

  const speak = useCallback((text: string) => {
    setSay(text);
    if (sayTimer.current) clearTimeout(sayTimer.current);
    sayTimer.current = setTimeout(() => setSay(null), 3200);
  }, []);

  const play = (a: "jump" | "wiggle") => {
    setAnim(null);
    requestAnimationFrame(() => setAnim(a));
  };

  const post = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setToast(null);
    const res = await fetch("/api/pet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setToast(ERR[(j as { error?: string }).error ?? ""] ?? "Có lỗi, thử lại sau nhé.");
      return null;
    }
    setState(j as PetState);
    return j as PetState;
  };

  const claim = async (t: TaskRow) => {
    const before = state?.summary.stage.index ?? 0;
    const next = await post(t.key, { action: "claim", task: t.key });
    if (!next) return;
    play("jump");
    setPop({ id: Date.now(), text: `+${t.xp} XP` });
    if (next.summary.stage.index > before) {
      speak(`Mình lớn rồi! Giờ mình là ${next.summary.stage.stage.name}!`);
    } else if (t.key === "feed") {
      const n = next.summary.streak.current;
      speak(n > 1 ? `Ngon quá! ${n} ngày liền rồi đó!` : "Măm măm, cảm ơn bạn!");
    } else {
      speak("Giỏi quá! Studio lại có thêm việc chạy.");
    }
  };

  const pat = () => {
    if (!state) return;
    play("wiggle");
    const pool = LINES[state.summary.mood];
    speak(pool[Math.floor(Math.random() * pool.length)]);
  };

  const saveName = async () => {
    const ok = await post("rename", { action: "rename", name: nameDraft });
    if (ok) setNaming(false);
  };

  if (setupMissing) {
    return (
      <Box>
        <p className="text-[15px] font-bold">Bé Máy Ảnh chưa được cài</p>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
          Mở Supabase → SQL Editor, dán toàn bộ file <code>supabase/be-may-anh.sql</code> rồi bấm Run một lần.
        </p>
      </Box>
    );
  }
  if (loadErr && !state) {
    return (
      <Box>
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Không tải được bé. Tải lại trang thử nhé.</p>
      </Box>
    );
  }
  if (!state) {
    return (
      <Box>
        <div className="h-[260px] animate-pulse rounded-[12px]" style={{ background: "var(--sf2)" }} />
      </Box>
    );
  }

  const { pet, summary, tasks } = state;
  const { stage, streak, mood } = summary;
  const feed = tasks.find((t) => t.key === "feed");
  const others = tasks.filter((t) => t.key !== "feed");

  return (
    <div className="page-in mx-auto flex max-w-[1000px] flex-col gap-4">
      <style>{CSS}</style>

      {/* ── Sân khấu + thông tin ─────────────────────────────────────── */}
      <div
        className="grid overflow-hidden rounded-[16px] min-[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
        style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
      >
        <div className="pet-stage relative flex min-h-[300px] items-end justify-center pb-6 pt-14">
          {say && (
            <div className="pet-say absolute left-1/2 top-4 z-10 max-w-[80%] -translate-x-1/2 rounded-[14px] px-3.5 py-2 text-center text-[13px] font-semibold shadow-sm"
              style={{ background: "var(--sf)", color: "var(--tx)", border: "1px solid var(--bd)" }}>
              {say}
            </div>
          )}
          {pop && (
            <span key={pop.id} className="pet-pop absolute left-1/2 top-[38%] z-10 -translate-x-1/2 text-[18px] font-extrabold" style={{ color: "var(--ac)" }}>
              {pop.text}
            </span>
          )}
          {anim === "jump" && <span key={`f${pop?.id}`} className="pet-flash pointer-events-none absolute inset-0" />}
          <button
            type="button"
            onClick={pat}
            onAnimationEnd={() => setAnim(null)}
            className={anim === "jump" ? "pet-jump" : anim === "wiggle" ? "pet-wiggle" : ""}
            aria-label={`Vuốt ve ${pet.name}`}
            title="Bấm để trò chuyện"
          >
            <PetSprite stage={stage.index} mood={mood} outfit={pet.outfit} size={220} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 p-5">
          <div className="flex items-start gap-2">
            {naming ? (
              <form
                className="flex w-full items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveName();
                }}
              >
                <input
                  autoFocus
                  value={nameDraft}
                  maxLength={NAME_MAX}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="min-w-0 flex-1 rounded-[10px] px-3 py-2 text-[15px] font-bold outline-none"
                  style={{ background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx)" }}
                  aria-label="Tên của bé"
                />
                <button type="submit" disabled={busy === "rename"} className="rounded-[10px] p-2" style={{ background: "var(--ac)", color: "#fff" }} aria-label="Lưu tên">
                  <Check size={18} />
                </button>
                <button type="button" onClick={() => setNaming(false)} className="rounded-[10px] p-2" style={{ background: "var(--sf2)", color: "var(--tx2)" }} aria-label="Huỷ">
                  <X size={18} />
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[22px] font-extrabold leading-tight">{pet.name}</h1>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                    {stage.stage.name} · {stage.stage.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(pet.name);
                    setNaming(true);
                  }}
                  className="rounded-[9px] p-2"
                  style={{ background: "var(--sf2)", color: "var(--tx2)" }}
                  aria-label="Đổi tên bé"
                  title="Đổi tên bé"
                >
                  <Pencil size={15} />
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip tone={mood === "vui" ? "var(--gn)" : mood === "doi" ? "var(--am)" : "var(--rd)"}
              bg={mood === "vui" ? "var(--gnS)" : mood === "doi" ? "var(--amS)" : "var(--rdS)"}>
              {MOOD_LABEL[mood]}
            </Chip>
            <Chip tone="var(--ac)" bg="var(--acS)">
              <Flame size={13} /> {streak.current} ngày liền
            </Chip>
            <Chip tone="var(--tx2)" bg="var(--sf2)">
              <Trophy size={13} /> Kỷ lục {streak.best}
            </Chip>
          </div>

          {/* XP */}
          <div>
            <div className="flex items-baseline justify-between text-[12px]" style={{ color: "var(--tx2)" }}>
              <span className="font-semibold" style={{ color: "var(--tx)" }}>{summary.xp} XP</span>
              <span>{stage.next ? `còn ${stage.toNext} XP để thành ${stage.next.name}` : "Đã lớn tối đa"}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.round(stage.progress * 100)}%`, background: "var(--ac)" }} />
            </div>
          </div>

          {/* 7 ngày */}
          <div className="grid grid-cols-7 gap-1.5">
            {summary.week.map((w) => {
              const isToday = w.day === state.today;
              return (
                <div key={w.day} className="flex flex-col items-center gap-1">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      background: w.fed ? "var(--ac)" : "var(--sf2)",
                      color: w.fed ? "#fff" : "var(--tx3)",
                      outline: isToday ? "2px solid var(--acM)" : undefined,
                      outlineOffset: 2,
                    }}
                  >
                    {w.fed ? <Film size={15} /> : <span className="text-[11px]">·</span>}
                  </span>
                  <span className="text-[10.5px]" style={{ color: isToday ? "var(--ac)" : "var(--tx3)", fontWeight: isToday ? 700 : 500 }}>
                    {isToday ? "Nay" : weekday(w.day)}
                  </span>
                </div>
              );
            })}
          </div>

          {feed && (
            <button
              type="button"
              disabled={feed.claimed || busy === "feed"}
              onClick={() => void claim(feed)}
              className="mt-auto flex items-center justify-center gap-2 rounded-[12px] py-3 text-[14px] font-bold transition-transform active:scale-[.98] disabled:active:scale-100"
              style={
                feed.claimed
                  ? { background: "var(--gnS)", color: "var(--gn)" }
                  : { background: "var(--ac)", color: "#fff" }
              }
            >
              {feed.claimed ? (
                <>
                  <Check size={17} /> Đã cho ăn hôm nay — mai quay lại nhé
                </>
              ) : (
                <>
                  <Film size={17} /> Cho bé ăn cuộn phim · +{feed.xp} XP
                </>
              )}
            </button>
          )}
          {!feed?.claimed && streak.current > 0 && (
            <p className="-mt-1.5 text-center text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Điểm danh liên tục được thêm XP mỗi ngày (tối đa +10). Bỏ một ngày là chuỗi về 0.
            </p>
          )}
          {toast && (
            <p className="text-[12.5px]" style={{ color: "var(--rd)" }} role="status">{toast}</p>
          )}
        </div>
      </div>

      {/* ── Nhiệm vụ hôm nay ─────────────────────────────────────────── */}
      {others.length > 0 && (
        <Section title="Nhiệm vụ hôm nay" desc="Làm việc thật trong mstudo, bé được thêm phần ăn. Mỗi việc nhận một lần mỗi ngày.">
          <div className="flex flex-col">
            {others.map((t, i) => (
              <div key={t.key} className="flex items-center gap-3 py-3" style={{ borderTop: i ? "1px solid var(--bd2)" : undefined }}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
                  style={{ background: t.claimed ? "var(--gnS)" : "var(--acS)", color: t.claimed ? "var(--gn)" : "var(--ac)" }}>
                  {t.claimed ? <Check size={18} /> : <Sparkles size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold">{t.title}</p>
                  <p className="text-[12px]" style={{ color: "var(--tx2)" }}>{t.desc}</p>
                </div>
                {t.claimed ? (
                  <span className="text-[12px] font-semibold" style={{ color: "var(--gn)" }}>+{t.xp} XP</span>
                ) : t.ready ? (
                  <button type="button" disabled={busy === t.key} onClick={() => void claim(t)}
                    className="flex-none rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
                    Nhận +{t.xp} XP
                  </button>
                ) : t.href ? (
                  <Link href={t.href} className="flex flex-none items-center gap-0.5 rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold"
                    style={{ background: "var(--acS)", color: "var(--ac)" }}>
                    Làm ngay <ChevronRight size={14} />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Phụ kiện ──────────────────────────────────────────────────── */}
      <Section title="Tủ đồ của bé" desc="Phụ kiện mở dần khi bé lớn hoặc khi bạn điểm danh nhiều ngày liền.">
        <div className="grid grid-cols-3 gap-2.5 min-[640px]:grid-cols-6">
          {OUTFITS.map((o) => {
            const open = outfitUnlocked(o, stage.index, streak.best);
            const on = pet.outfit === o.key;
            return (
              <button
                key={o.key}
                type="button"
                disabled={!open || busy === "outfit"}
                onClick={() => void post("outfit", { action: "outfit", outfit: on ? null : o.key })}
                title={open ? (on ? "Bấm để tháo" : "Bấm để đeo") : outfitHint(o)}
                className="relative flex flex-col items-center rounded-[12px] p-2 pb-2.5 text-center"
                style={{
                  background: on ? "var(--acS)" : "var(--sf2)",
                  border: `1.5px solid ${on ? "var(--ac)" : "transparent"}`,
                }}
              >
                <span style={{ opacity: open ? 1 : 0.35 }}>
                  <PetSprite stage={stage.index} mood="vui" outfit={o.key} size={72} idle={false} />
                </span>
                <span className="text-[11.5px] font-semibold" style={{ color: open ? "var(--tx)" : "var(--tx3)" }}>{o.name}</span>
                {!open && (
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight" style={{ color: "var(--tx3)" }}>
                    <Lock size={10} /> {outfitHint(o).replace("Mở khi ", "")}
                  </span>
                )}
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "var(--ac)", color: "#fff" }}>
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Hành trình lớn lên ────────────────────────────────────────── */}
      <Section title="Hành trình lớn lên" desc="Mỗi ngày đều đặn với mstudo, bé lại tiến thêm một bước.">
        <div className="grid grid-cols-3 gap-2.5 min-[640px]:grid-cols-6">
          {STAGES.map((s, i) => {
            const reached = i <= stage.index;
            return (
              <div key={s.name} className="flex flex-col items-center rounded-[12px] p-2 text-center"
                style={{ background: i === stage.index ? "var(--acS)" : "var(--sf2)" }}>
                <PetSprite stage={i} mood="vui" size={72} idle={false} silhouette={!reached} />
                <span className="text-[11.5px] font-semibold" style={{ color: reached ? "var(--tx)" : "var(--tx3)" }}>
                  {reached ? s.name : "???"}
                </span>
                <span className="text-[10.5px]" style={{ color: "var(--tx3)" }}>{s.min} XP</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-in mx-auto max-w-[1000px] rounded-[16px] p-5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      {children}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] p-5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <h2 className="text-[15px] font-bold">{title}</h2>
      <p className="mb-3 mt-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>{desc}</p>
      {children}
    </section>
  );
}

function Chip({ children, tone, bg }: { children: React.ReactNode; tone: string; bg: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ color: tone, background: bg }}>
      {children}
    </span>
  );
}

/* Phông nền studio (tường + sàn cong) và các chuyển động của bé. */
const CSS = `
.pet-stage {
  background:
    radial-gradient(ellipse 60% 55% at 50% 42%, color-mix(in srgb, var(--ac) 16%, transparent), transparent 70%),
    linear-gradient(180deg, var(--sf2) 0%, var(--sf2) 68%, color-mix(in srgb, var(--bd) 70%, var(--sf2)) 100%);
}
.pet-bob { animation: pet-bob 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.pet-eyes { animation: pet-blink 4.2s infinite; }
.pet-sparkle { animation: pet-twinkle 1.8s ease-in-out infinite; }
.pet-jump { animation: pet-jump .7s cubic-bezier(.3,1.6,.5,1); }
.pet-wiggle { animation: pet-wiggle .6s ease-in-out; }
.pet-say { animation: pet-in .25s ease-out; }
.pet-pop { animation: pet-pop 1.1s ease-out forwards; }
.pet-flash { background: radial-gradient(circle at 50% 55%, #fff 0%, transparent 60%); animation: pet-flash .5s ease-out forwards; }
@keyframes pet-bob { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-4px) scaleY(1.015); } }
@keyframes pet-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
@keyframes pet-twinkle { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes pet-jump { 0% { transform: translateY(0); } 40% { transform: translateY(-28px) rotate(-4deg); } 100% { transform: translateY(0); } }
@keyframes pet-wiggle { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
@keyframes pet-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes pet-pop { 0% { opacity: 0; transform: translate(-50%, 10px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -40px); } }
@keyframes pet-flash { 0% { opacity: .95; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .pet-bob, .pet-eyes, .pet-sparkle, .pet-jump, .pet-wiggle, .pet-pop, .pet-flash { animation: none !important; }
}
`;
