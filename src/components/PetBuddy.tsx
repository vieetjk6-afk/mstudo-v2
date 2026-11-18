"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, EyeOff, Film, Flame, PawPrint, X } from "lucide-react";
import PetSprite from "@/app/dashboard/be-may-anh/PetSprite";
import { IDLE_LINES, MOOD_LABEL, type Mood, type OutfitKey, type Reminder } from "@/lib/pet";

/* ═══════════════════════════════════════════════════════════════════════════
   BÉ MÁY ẢNH NỔI Ở GÓC MÀN HÌNH — có mặt ở mọi màn của khu studio (cả khung
   cũ lẫn khung mới).

   • Thỉnh thoảng bé nói một câu: nhắc việc thật của studio (buổi chụp hôm nay,
     đợt thu tới hạn, khách chờ xác nhận… — máy chủ đếm ở /api/pet?lite=1),
     đang đói thì đòi ăn, rảnh thì nói câu vu vơ. Bấm câu nói là mở đúng màn.
   • Bấm vào bé → bảng nhỏ: cho ăn ngay tại chỗ, danh sách việc cần nhắc, mở
     trang của bé, hoặc ẩn bé (ẩn xong còn một nút chân mèo nhỏ để gọi lại).
   • Không hiện trên chính trang của bé (đã có bé to ở đó).

   Trạng thái ẩn lưu localStorage theo máy — tuỳ chọn cá nhân, mất cũng không sao.
   ═══════════════════════════════════════════════════════════════════════════ */

type Lite = {
  name: string;
  stage: number;
  mood: Mood;
  fedToday: boolean;
  streak: number;
  feedXp: number;
  outfit: OutfitKey | null;
  reminders: Reminder[];
};

type Line = { text: string; href?: string; feed?: boolean };

export const PET_EVENT = "mstudo-pet";
const HIDE_KEY = "mstudo_pet_hidden";
/** Câu đầu tiên sau khi mở app vài giây; sau đó cứ 1–2 phút nói một câu. */
const FIRST_SAY_MS = 6_000;
const SAY_EVERY_MS = [60_000, 120_000] as const;
const SAY_FOR_MS = 9_000;
/** Đọc lại số liệu khi quay lại tab, nhưng không dày hơn 5 phút một lần. */
const RELOAD_GAP_MS = 5 * 60_000;

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeHidden(v: boolean) {
  try {
    if (v) localStorage.setItem(HIDE_KEY, "1");
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    /* trình duyệt chặn lưu — chỉ mất ghi nhớ ở lần tải sau */
  }
}

export default function PetBuddy() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [pet, setPet] = useState<Lite | null>(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<Line | null>(null);
  const [busy, setBusy] = useState(false);
  const [hop, setHop] = useState(0);
  const loadedAt = useRef(0);
  const turn = useRef(0);
  const petRef = useRef<Lite | null>(null);
  petRef.current = pet;

  const onPetPage = pathname.startsWith("/dashboard/be-may-anh");

  const load = useCallback(async () => {
    loadedAt.current = Date.now();
    const r = await fetch("/api/pet?lite=1", { cache: "no-store" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j?.setup) setPet(j as Lite);
  }, []);

  useEffect(() => {
    setHidden(readHidden());
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > RELOAD_GAP_MS) void load();
    };
    // Màn chơi đổi trạng thái (cho ăn, đổi phụ kiện…) → đọc lại cho khớp.
    const onChange = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(PET_EVENT, onChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(PET_EVENT, onChange);
    };
  }, [load]);

  /** Câu kế tiếp: lần lượt qua đòi ăn + từng việc cần nhắc; hết việc thì nói vu vơ. */
  const nextLine = useCallback((): Line | null => {
    const p = petRef.current;
    if (!p) return null;
    const pool: Line[] = [];
    if (!p.fedToday) {
      pool.push({
        text: p.streak > 0 ? `Đói quá… cho mình ăn để giữ chuỗi ${p.streak} ngày nha!` : "Đói quá… cho mình một cuộn phim đi!",
        feed: true,
      });
    }
    for (const r of p.reminders) pool.push({ text: r.text, href: r.href });
    if (pool.length === 0) return { text: IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)] };
    const l = pool[turn.current % pool.length];
    turn.current++;
    return l;
  }, []);

  // Nhịp nói: câu đầu sau vài giây, sau đó 1–2 phút một câu, mỗi câu hiện 9 giây.
  useEffect(() => {
    if (!pet || hidden || onPetPage) return;
    let t: ReturnType<typeof setTimeout>;
    let off: ReturnType<typeof setTimeout>;
    const say = () => {
      if (document.visibilityState === "visible") {
        const l = nextLine();
        if (l) {
          setLine(l);
          setHop((h) => h + 1);
          clearTimeout(off);
          off = setTimeout(() => setLine(null), SAY_FOR_MS);
        }
      }
      const [a, b] = SAY_EVERY_MS;
      t = setTimeout(say, a + Math.random() * (b - a));
    };
    t = setTimeout(say, FIRST_SAY_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
    // Chỉ khởi động lại nhịp khi bé xuất hiện / ẩn / đổi trang — không phải mỗi lần số liệu đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pet, hidden, onPetPage, nextLine]);

  // Đóng bảng khi chuyển trang.
  useEffect(() => setOpen(false), [pathname]);

  const feed = async () => {
    setBusy(true);
    const r = await fetch("/api/pet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "claim", task: "feed" }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok && r?.status !== 409) {
      setLine({ text: "Ơ, có lỗi rồi — thử lại sau nhé." });
      return;
    }
    const xp = pet?.feedXp ?? 10;
    await load();
    setOpen(false);
    setHop((h) => h + 1);
    setLine({ text: `Măm măm! +${xp} XP — cảm ơn bạn nha!` });
    setTimeout(() => setLine(null), 5000);
  };

  if (!pet || onPetPage) return null;

  const hide = () => {
    writeHidden(true);
    setHidden(true);
    setOpen(false);
    setLine(null);
  };

  // Vị trí: máy tính ở góc dưới phải. Điện thoại ở góc dưới TRÁI, trên thanh
  // tab — góc phải đã có nút "+" tạo nhanh của khung mới.
  const corner =
    "fixed left-3 z-[70] bottom-[calc(80px+env(safe-area-inset-bottom))] lg:left-auto lg:bottom-5 lg:right-5";

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          writeHidden(false);
          setHidden(false);
        }}
        className={`${corner} flex h-9 w-9 items-center justify-center rounded-full shadow-md`}
        style={{ background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--ac)" }}
        aria-label={`Gọi ${pet.name} ra`}
        title={`Gọi ${pet.name} ra`}
      >
        <PawPrint size={17} />
        {!pet.fedToday && (
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full" style={{ background: "var(--am)", boxShadow: "0 0 0 2px var(--sf)" }} />
        )}
      </button>
    );
  }

  return (
    <div className={`${corner} flex flex-col items-start gap-2 lg:items-end`}>
      <style>{CSS}</style>

      {open && (
        <div
          className="pb-panel w-[min(300px,calc(100vw-24px))] rounded-[16px] p-3.5 shadow-xl"
          style={{ background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx)" }}
          role="dialog"
          aria-label={pet.name}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-extrabold">{pet.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>
                {MOOD_LABEL[pet.mood]}
                <span style={{ color: "var(--tx3)" }}>·</span>
                <Flame size={12} style={{ color: "var(--ac)" }} /> {pet.streak} ngày liền
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-[8px] p-1" style={{ color: "var(--tx3)" }} aria-label="Đóng">
              <X size={16} />
            </button>
          </div>

          <button
            type="button"
            disabled={pet.fedToday || busy}
            onClick={() => void feed()}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[13px] font-bold"
            style={pet.fedToday ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--ac)", color: "#fff" }}
          >
            <Film size={15} />
            {pet.fedToday ? "Hôm nay bé đã no" : busy ? "Đang cho ăn…" : `Cho bé ăn · +${pet.feedXp} XP`}
          </button>

          {pet.reminders.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>Bé nhắc bạn</p>
              <div className="flex max-h-[220px] flex-col overflow-y-auto">
                {pet.reminders.map((r) => (
                  <Link
                    key={r.key}
                    href={r.href}
                    className="pb-row flex items-center gap-2 rounded-[9px] px-2 py-2 text-[12.5px] leading-snug"
                  >
                    <span className="flex-1">{r.text}</span>
                    <ChevronRight size={14} className="flex-none" style={{ color: "var(--tx3)" }} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--bd2)" }}>
            <Link
              href="/dashboard/be-may-anh"
              className="flex flex-1 items-center justify-center gap-1 rounded-[10px] py-2 text-[12.5px] font-bold"
              style={{ background: "var(--acS)", color: "var(--ac)" }}
            >
              Mở trang của bé <ChevronRight size={14} />
            </Link>
            <button
              type="button"
              onClick={hide}
              className="flex items-center gap-1 rounded-[10px] px-2.5 py-2 text-[12px] font-semibold"
              style={{ background: "var(--sf2)", color: "var(--tx2)" }}
              title="Ẩn bé — bấm nút chân mèo ở góc để gọi lại"
            >
              <EyeOff size={14} /> Ẩn
            </button>
          </div>
        </div>
      )}

      {line && !open && (
        <div
          role="status"
          onClick={() => {
            setLine(null);
            if (line.feed) setOpen(true);
            else if (line.href) router.push(line.href);
          }}
          className="pb-say relative max-w-[min(260px,calc(100vw-90px))] cursor-pointer rounded-[14px] px-3 py-2 text-[12.5px] font-semibold leading-snug shadow-lg"
          style={{ background: "var(--sf)", color: "var(--tx)", border: "1px solid var(--bd)" }}
        >
          {line.text}
          {(line.href || line.feed) && (
            <span className="mt-1 flex items-center gap-0.5 text-[11px] font-bold" style={{ color: "var(--ac)" }}>
              {line.feed ? "Cho ăn" : "Xem ngay"} <ChevronRight size={12} />
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLine(null);
            }}
            className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "var(--sf2)", color: "var(--tx3)", border: "1px solid var(--bd)" }}
            aria-label="Tắt câu nói"
          >
            <X size={11} />
          </button>
          <span className="pb-tail" />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setLine(null);
        }}
        className="relative"
        aria-label={pet.fedToday ? `${pet.name} — mở bảng của bé` : `${pet.name} đang đói — bấm để cho ăn`}
        title={pet.name}
      >
        <span key={hop} className={`pb-body block ${hop ? "pb-hop" : ""}`}>
          <PetSprite stage={pet.stage} mood={pet.mood} outfit={pet.outfit} size={72} idle={false} className="pb-sprite" />
        </span>
        {!pet.fedToday && (
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full" style={{ background: "var(--am)", boxShadow: "0 0 0 2px var(--sf)" }} />
        )}
      </button>
    </div>
  );
}

const CSS = `
.pb-sprite { filter: drop-shadow(0 4px 8px rgba(0,0,0,.18)); }
.pb-body { animation: pb-bob 3s ease-in-out infinite; transform-origin: 50% 100%; }
.pb-hop { animation: pb-hop .6s cubic-bezier(.3,1.6,.5,1), pb-bob 3s ease-in-out .6s infinite; }
.pb-say { animation: pb-in .22s ease-out; }
.pb-panel { animation: pb-in .18s ease-out; }
.pb-tail { position: absolute; left: 26px; bottom: -6px; width: 12px; height: 12px; background: var(--sf);
  border-right: 1px solid var(--bd); border-bottom: 1px solid var(--bd); transform: rotate(45deg); }
.pb-row:hover { background: var(--sf2); }
@media (min-width: 1024px) { .pb-tail { left: auto; right: 26px; } }
@keyframes pb-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes pb-hop { 0% { transform: translateY(0); } 40% { transform: translateY(-16px) rotate(-5deg); } 100% { transform: translateY(0); } }
@keyframes pb-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .pb-body, .pb-hop, .pb-say, .pb-panel { animation: none !important; } }
`;
