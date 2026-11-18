/* ═══════════════════════════════════════════════════════════════════════════
   BÉ MÁY ẢNH — luật chơi (thuần, không I/O; kiểm thử ở desktop/test/pet.mjs).

   Mỗi tài khoản nuôi một bé. Bé lớn nhờ XP:
     • Điểm danh mỗi ngày ("cho bé ăn một cuộn phim") — thêm thưởng theo chuỗi
       ngày liên tiếp, nên bỏ một ngày là tiếc.
     • Nhiệm vụ trong ngày gắn với việc THẬT trong mstudo (tạo album, tạo hợp
       đồng, ghi khoản thu) — máy chủ đối chiếu dữ liệu rồi mới cho nhận. Game
       vì thế kéo người dùng vào đúng những màn làm ra tiền cho studio.

   Bé không bao giờ chết: bỏ bê thì chỉ đói rồi buồn, cho ăn lại là vui. Mất bé
   thì người dùng bỏ luôn game, điều ngược với mục đích giữ chân.

   XP và chuỗi ngày KHÔNG lưu sẵn — tính lại từ các lượt nhận (bảng pet_claims,
   xem supabase/migrations/be_may_anh.sql), nên không có số nào để lệch.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PetTier = "none" | "booking" | "plus" | "full";
const TIER_RANK: Record<PetTier, number> = { none: 0, booking: 1, plus: 2, full: 3 };

export type PetTaskKey = "feed" | "album" | "contract" | "payment";

export type PetTask = {
  key: PetTaskKey;
  title: string;
  desc: string;
  /** XP cơ bản. Điểm danh còn cộng thêm thưởng chuỗi — xem feedXp(). */
  xp: number;
  /** Màn để đi làm nhiệm vụ. */
  href?: string;
  /** Gói thấp nhất thấy nhiệm vụ này (không có màn thì đừng giao việc). */
  minTier: PetTier;
};

export const TASKS: readonly PetTask[] = [
  { key: "feed", title: "Điểm danh", desc: "Cho bé ăn một cuộn phim", xp: 10, minTier: "none" },
  { key: "album", title: "Tạo một album", desc: "Album chọn ảnh hoặc giao khách mới trong hôm nay", xp: 15, href: "/dashboard/albums/new", minTier: "none" },
  { key: "contract", title: "Tạo một hợp đồng", desc: "Hợp đồng mới của studio trong hôm nay", xp: 20, href: "/dashboard/studio/contracts/new", minTier: "plus" },
  { key: "payment", title: "Ghi một khoản thu", desc: "Cọc hoặc thanh toán của khách trong hôm nay", xp: 15, href: "/dashboard/studio/contracts", minTier: "plus" },
];

export const FEED_STREAK_BONUS_MAX = 10;

export function isTaskKey(v: unknown): v is PetTaskKey {
  return typeof v === "string" && TASKS.some((t) => t.key === v);
}

export function tasksFor(tier: PetTier): PetTask[] {
  return TASKS.filter((t) => TIER_RANK[tier] >= TIER_RANK[t.minTier]);
}

/* ── Giai đoạn lớn ──────────────────────────────────────────────────────── */

export type PetStage = { min: number; name: string; desc: string };

/**
 * Ngưỡng XP. Một ngày làm đủ mọi việc được ~70 XP, chỉ điểm danh được 10–20,
 * nên: nở trong ~5 ngày, lên máy cơ sau chừng một tháng rưỡi, thành huyền thoại
 * sau nửa năm dùng đều — đủ xa để còn thứ để chờ.
 */
export const STAGES: readonly PetStage[] = [
  { min: 0, name: "Trứng phim", desc: "Một cuộn phim đang ấp. Cho ăn đều để bé nở." },
  { min: 50, name: "Máy phim nhí", desc: "Vừa nở, tò mò với mọi thứ, thích được chụp chung." },
  { min: 200, name: "Máy du lịch", desc: "Nhỏ gọn, nhanh nhảu, theo bạn đi mọi buổi chụp." },
  { min: 500, name: "Máy cơ", desc: "Chững chạc, có đèn flash riêng, biết lấy nét tay." },
  { min: 1000, name: "Máy DSLR", desc: "Báng cầm chắc tay, ống kính to, chụp cưới không sợ thiếu sáng." },
  { min: 2000, name: "Máy huyền thoại", desc: "Phủ vàng, được cả giới nhiếp ảnh ngưỡng mộ." },
];

export type StageInfo = {
  index: number;
  stage: PetStage;
  next: PetStage | null;
  /** 0..1 — tiến độ tới giai đoạn sau (1 khi đã tối đa). */
  progress: number;
  /** XP còn thiếu tới giai đoạn sau (0 khi đã tối đa). */
  toNext: number;
};

export function stageOf(xp: number): StageInfo {
  const x = Math.max(0, Math.floor(xp || 0));
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (x >= STAGES[i].min) index = i;
  const stage = STAGES[index];
  const next = STAGES[index + 1] ?? null;
  if (!next) return { index, stage, next, progress: 1, toNext: 0 };
  return {
    index,
    stage,
    next,
    progress: (x - stage.min) / (next.min - stage.min),
    toNext: next.min - x,
  };
}

/* ── Ngày & chuỗi ngày ──────────────────────────────────────────────────── */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayNum(d: string): number {
  return Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000);
}

/** b − a tính bằng ngày, cả hai dạng "YYYY-MM-DD". */
export function dayDiff(a: string, b: string): number {
  return dayNum(b) - dayNum(a);
}

/** Ngày "YYYY-MM-DD" lùi/tiến n ngày. */
export function addDays(d: string, n: number): string {
  return new Date((dayNum(d) + n) * 86_400_000).toISOString().slice(0, 10);
}

export type Streak = {
  /** Chuỗi đang sống: tính tới hôm nay, hoặc tới hôm qua nếu hôm nay chưa điểm danh. */
  current: number;
  best: number;
  fedToday: boolean;
  lastFed: string | null;
};

/**
 * Chuỗi ngày điểm danh liên tiếp từ danh sách ngày đã điểm danh.
 *
 * Hôm nay chưa điểm danh KHÔNG làm đứt chuỗi — còn cả ngày để làm. Chỉ khi
 * ngày gần nhất cách hôm nay từ 2 ngày trở lên thì chuỗi mới về 0.
 */
export function streakOf(feedDays: readonly string[], today: string): Streak {
  const days = [...new Set(feedDays.filter((d) => DAY_RE.test(d) && dayDiff(d, today) >= 0))]
    .map(dayNum)
    .sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, best: 0, fedToday: false, lastFed: null };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const t = dayNum(today);
  const last = days[days.length - 1];
  // `run` lúc này là độ dài chuỗi kết thúc ở ngày cuối cùng.
  const current = t - last <= 1 ? run : 0;
  return {
    current,
    best,
    fedToday: last === t,
    lastFed: new Date(last * 86_400_000).toISOString().slice(0, 10),
  };
}

/**
 * XP của lần điểm danh SẮP làm hôm nay: 10 + 1 cho mỗi ngày chuỗi đã có (tối
 * đa +10). Ngày thứ 11 liên tiếp trở đi được 20 XP mỗi ngày.
 */
export function feedXp(s: Streak): number {
  const streakAfter = s.fedToday ? s.current : s.current + 1;
  return TASKS[0].xp + Math.min(Math.max(streakAfter - 1, 0), FEED_STREAK_BONUS_MAX);
}

/* ── Tâm trạng ──────────────────────────────────────────────────────────── */

export type Mood = "vui" | "doi" | "buon";

export const MOOD_LABEL: Record<Mood, string> = {
  vui: "Vui vẻ",
  doi: "Đang đói",
  buon: "Buồn, bám bụi",
};

/** Hôm nay đã ăn → vui; ăn lần cuối hôm qua (hoặc bé mới) → đói; lâu hơn → buồn. */
export function moodOf(lastFed: string | null, today: string): Mood {
  if (!lastFed) return "doi";
  const gap = dayDiff(lastFed, today);
  if (gap <= 0) return "vui";
  if (gap === 1) return "doi";
  return "buon";
}

/* ── Phụ kiện ───────────────────────────────────────────────────────────── */

export type OutfitKey = "no" | "kinh" | "nonla" | "nocho" | "voan" | "vuongmien";

export type Outfit = {
  key: OutfitKey;
  name: string;
  /** Mở khi đạt giai đoạn này (chỉ số trong STAGES)… */
  stage?: number;
  /** …hoặc khi chuỗi dài nhất đạt từng này ngày. */
  streak?: number;
};

export const OUTFITS: readonly Outfit[] = [
  { key: "no", name: "Nơ hồng", stage: 1 },
  { key: "nonla", name: "Nón lá", streak: 7 },
  { key: "kinh", name: "Kính râm", stage: 2 },
  { key: "nocho", name: "Nơ cổ chú rể", stage: 3 },
  { key: "voan", name: "Voan cô dâu", streak: 21 },
  { key: "vuongmien", name: "Vương miện", stage: 5 },
];

export function isOutfitKey(v: unknown): v is OutfitKey {
  return typeof v === "string" && OUTFITS.some((o) => o.key === v);
}

export function outfitUnlocked(o: Outfit, stageIndex: number, bestStreak: number): boolean {
  if (o.stage != null && stageIndex >= o.stage) return true;
  if (o.streak != null && bestStreak >= o.streak) return true;
  return false;
}

export function outfitHint(o: Outfit): string {
  if (o.stage != null) return `Mở khi bé thành ${STAGES[o.stage].name}`;
  return `Mở khi điểm danh ${o.streak} ngày liền`;
}

/* ── Tên bé ─────────────────────────────────────────────────────────────── */

export const DEFAULT_NAME = "Bé Chớp";
export const NAME_MAX = 24;

/** Gọt tên người dùng đặt: bỏ ký tự điều khiển, gộp khoảng trắng, tối đa 24 ký tự. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return [...s].slice(0, NAME_MAX).join("");
}

/* ── Tổng hợp trạng thái ────────────────────────────────────────────────── */

export type Claim = { day: string; task: string; xp: number };

export type PetSummary = {
  xp: number;
  stage: StageInfo;
  streak: Streak;
  mood: Mood;
  /** Nhiệm vụ đã nhận thưởng hôm nay. */
  doneToday: PetTaskKey[];
  /** 7 ngày gần nhất (cũ → mới), ngày nào đã điểm danh. */
  week: { day: string; fed: boolean }[];
  /** XP lần điểm danh hôm nay sẽ được (hoặc đã được). */
  feedXp: number;
};

export function summarize(claims: readonly Claim[], today: string): PetSummary {
  const xp = claims.reduce((s, c) => s + Math.max(0, Math.floor(c.xp || 0)), 0);
  const feedDays = claims.filter((c) => c.task === "feed").map((c) => c.day);
  const streak = streakOf(feedDays, today);
  const fed = new Set(feedDays);
  const doneToday = TASKS.map((t) => t.key).filter((k) => claims.some((c) => c.day === today && c.task === k));
  const todayFeed = claims.find((c) => c.day === today && c.task === "feed");
  return {
    xp,
    stage: stageOf(xp),
    streak,
    mood: moodOf(streak.lastFed, today),
    doneToday,
    week: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      return { day, fed: fed.has(day) };
    }),
    feedXp: todayFeed ? todayFeed.xp : feedXp(streak),
  };
}
