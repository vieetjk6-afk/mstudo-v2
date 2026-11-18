import type { Mood, OutfitKey } from "@/lib/pet";

/* ═══════════════════════════════════════════════════════════════════════════
   HÌNH BÉ MÁY ẢNH — SVG thuần, vẽ tay, không ảnh ngoài.

   Gương mặt nằm TRONG ống kính: mắt và miệng hiện trên mặt kính tối, hai má
   hồng hai bên ống kính. Giai đoạn đổi thân máy (trứng phim → máy huyền
   thoại), tâm trạng đổi mắt/miệng, phụ kiện đè lên trên cùng.

   Toạ độ khung 200×200, tâm ngang x = 100. Mọi giai đoạn khai đỉnh thân `top`
   để phụ kiện đội đầu (nón, vương miện, voan, nơ) đặt đúng chỗ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Body = {
  top: number;
  /** Tâm & bán kính ống kính (= khuôn mặt). */
  lx: number; ly: number; lr: number;
  /** Màu thân / màu viền / màu phần trên. */
  fill: string; stroke: string; accent: string;
};

const BODIES: Body[] = [
  // 0 · Trứng phim — hộp phim tròn, mặt nằm ngay trên thân hộp
  { top: 62, lx: 100, ly: 122, lr: 30, fill: "#F4C84A", stroke: "#B8891A", accent: "#3A3A44" },
  // 1 · Máy phim nhí — hồng phấn, nhỏ
  { top: 78, lx: 100, ly: 128, lr: 28, fill: "#F7B7C8", stroke: "#C9748C", accent: "#FFE7EE" },
  // 2 · Máy du lịch — xanh bạc hà
  { top: 72, lx: 100, ly: 126, lr: 30, fill: "#8FD9C4", stroke: "#3E9C83", accent: "#E9FBF5" },
  // 3 · Máy cơ — da đen, nóc bạc
  { top: 68, lx: 100, ly: 126, lr: 32, fill: "#3B3A42", stroke: "#1E1D23", accent: "#D9DCE2" },
  // 4 · DSLR — đen nhám, gù lăng kính, báng cầm
  { top: 56, lx: 98, ly: 126, lr: 35, fill: "#2B2A31", stroke: "#121116", accent: "#45434D" },
  // 5 · Huyền thoại — phủ vàng
  { top: 56, lx: 98, ly: 126, lr: 35, fill: "#F2C94C", stroke: "#B7861C", accent: "#FFF1BF" },
];

function Shell({ stage, b }: { stage: number; b: Body }) {
  if (stage === 0) {
    // Hộp phim: thân trụ + nắp + lưỡi phim thò ra bên phải
    return (
      <g>
        <rect x="132" y="104" width="34" height="30" rx="3" fill="#6B5B3E" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={136 + i * 8} y="107" width="4" height="5" rx="1" fill="#F7EBD0" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={136 + i * 8} y="126" width="4" height="5" rx="1" fill="#F7EBD0" />
        ))}
        <rect x="58" y="70" width="84" height="102" rx="18" fill={b.fill} stroke={b.stroke} strokeWidth="3" />
        <rect x="66" y={b.top - 6} width="68" height="16" rx="6" fill={b.accent} />
        <rect x="88" y={b.top - 14} width="24" height="10" rx="3" fill={b.accent} />
        <rect x="58" y="88" width="84" height="6" fill="#fff" opacity=".35" />
      </g>
    );
  }
  const big = stage >= 4;
  const x = big ? 46 : stage === 1 ? 58 : 52;
  const w = 200 - x * 2 + (big ? 6 : 0);
  return (
    <g>
      {/* dây đeo */}
      {stage >= 2 && (
        <path
          d={`M ${x + 4} ${b.top + 26} C ${x - 22} ${b.top + 70}, ${x - 8} ${b.top + 118}, ${x + 14} ${b.top + 112}`}
          fill="none" stroke={stage === 5 ? "#B7861C" : "#7A4B3A"} strokeWidth="5" strokeLinecap="round"
        />
      )}
      {/* gù lăng kính (DSLR) hoặc ô ngắm (máy nhỏ) */}
      {big ? (
        <path d={`M 76 ${b.top + 24} L 84 ${b.top} L 114 ${b.top} L 122 ${b.top + 24} Z`} fill={b.fill} stroke={b.stroke} strokeWidth="3" strokeLinejoin="round" />
      ) : (
        <rect x={x + 10} y={b.top} width="26" height="16" rx="5" fill={b.accent} stroke={b.stroke} strokeWidth="2.5" />
      )}
      {/* nút chụp */}
      <rect x={x + w - 34} y={b.top + (big ? 12 : 6)} width="18" height="10" rx="4" fill={stage === 5 ? "#FFF1BF" : "#E2574C"} stroke={b.stroke} strokeWidth="2" />
      {/* đèn flash rời (máy cơ) */}
      {stage === 3 && (
        <g>
          <rect x="88" y={b.top - 22} width="28" height="20" rx="4" fill="#D9DCE2" stroke="#1E1D23" strokeWidth="2.5" />
          <rect x="92" y={b.top - 18} width="20" height="10" rx="2" fill="#FFF8D6" />
          <rect x="96" y={b.top - 3} width="12" height="6" fill="#1E1D23" />
        </g>
      )}
      {/* thân máy */}
      <rect x={x} y={b.top + 22} width={w} height={big ? 98 : 88} rx="20" fill={b.fill} stroke={b.stroke} strokeWidth="3" />
      {/* nóc bạc (máy cơ) / dải sáng */}
      {stage === 3 ? (
        <path d={`M ${x + 1.5} ${b.top + 44} L ${x + 1.5} ${b.top + 40} Q ${x + 1.5} ${b.top + 23.5} ${x + 20} ${b.top + 23.5} L ${x + w - 20} ${b.top + 23.5} Q ${x + w - 1.5} ${b.top + 23.5} ${x + w - 1.5} ${b.top + 40} L ${x + w - 1.5} ${b.top + 44} Z`} fill="#D9DCE2" />
      ) : (
        <rect x={x + 10} y={b.top + 30} width={w - 20} height="6" rx="3" fill="#fff" opacity={stage >= 4 && stage < 5 ? 0.08 : 0.35} />
      )}
      {/* báng cầm (DSLR) */}
      {big && <rect x={x + w - 24} y={b.top + 34} width="20" height="78" rx="9" fill={stage === 5 ? "#E0B23A" : "#1C1B21"} />}
      {/* ô kính ngắm nhỏ bên trái (máy nhỏ) */}
      {!big && <rect x={x + 10} y={b.top + 42} width="18" height="12" rx="3" fill="#BFE6FF" stroke={b.stroke} strokeWidth="2" />}
    </g>
  );
}

function Face({ mood, b, stage }: { mood: Mood; b: Body; stage: number }) {
  const { lx, ly, lr } = b;
  const ring = stage === 5 ? "#B7861C" : stage >= 3 ? "#121116" : b.stroke;
  const ex = lr * 0.38;
  const ey = ly - lr * 0.12;
  return (
    <g>
      {/* má hồng */}
      <ellipse cx={lx - lr - 9} cy={ly + 8} rx="8" ry="5" fill="#FF8FA3" opacity=".55" />
      <ellipse cx={lx + lr + 9} cy={ly + 8} rx="8" ry="5" fill="#FF8FA3" opacity=".55" />
      {/* vành ống kính */}
      <circle cx={lx} cy={ly} r={lr + 8} fill={stage === 5 ? "#FFE28A" : "#8D8A96"} stroke={ring} strokeWidth="3" />
      <circle cx={lx} cy={ly} r={lr + 2} fill="#26232E" />
      {/* mặt kính */}
      <circle cx={lx} cy={ly} r={lr - 2} fill="#3B3654" />
      <circle cx={lx} cy={ly} r={lr - 2} fill="url(#pet-glass)" />
      <ellipse cx={lx - lr * 0.45} cy={ly - lr * 0.5} rx={lr * 0.22} ry={lr * 0.12} fill="#fff" opacity=".35" transform={`rotate(-30 ${lx - lr * 0.45} ${ly - lr * 0.5})`} />

      {/* mắt */}
      <g className="pet-eyes" style={{ transformOrigin: `${lx}px ${ey}px` }}>
        {mood === "vui" ? (
          <>
            <path d={`M ${lx - ex - 6} ${ey + 3} Q ${lx - ex} ${ey - 7} ${lx - ex + 6} ${ey + 3}`} stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d={`M ${lx + ex - 6} ${ey + 3} Q ${lx + ex} ${ey - 7} ${lx + ex + 6} ${ey + 3}`} stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "doi" ? (
          <>
            <circle cx={lx - ex} cy={ey} r="6" fill="#fff" />
            <circle cx={lx + ex} cy={ey} r="6" fill="#fff" />
            <circle cx={lx - ex + 1.5} cy={ey - 1.5} r="2.2" fill="#3B3654" />
            <circle cx={lx + ex + 1.5} cy={ey - 1.5} r="2.2" fill="#3B3654" />
          </>
        ) : (
          <>
            {/* đuôi mắt cụp xuống phía ngoài = buồn (ngược lại là cau có) */}
            <path d={`M ${lx - ex - 6} ${ey + 2} L ${lx - ex + 6} ${ey - 3}`} stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
            <path d={`M ${lx + ex + 6} ${ey + 2} L ${lx + ex - 6} ${ey - 3}`} stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
            <path d={`M ${lx + ex + 2} ${ey + 6} q 3 6 0 9 q -3 -3 0 -9`} fill="#9AD8FF" />
          </>
        )}
      </g>

      {/* miệng */}
      {mood === "vui" ? (
        <path d={`M ${lx - 9} ${ly + lr * 0.3} Q ${lx} ${ly + lr * 0.3 + 11} ${lx + 9} ${ly + lr * 0.3}`} fill="#FF8FA3" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      ) : mood === "doi" ? (
        <ellipse cx={lx} cy={ly + lr * 0.38} rx="5" ry="6" fill="#FF8FA3" stroke="#fff" strokeWidth="2.5" />
      ) : (
        <path d={`M ${lx - 8} ${ly + lr * 0.42} Q ${lx} ${ly + lr * 0.42 - 7} ${lx + 8} ${ly + lr * 0.42}`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      )}
    </g>
  );
}

function Feet({ stage, b }: { stage: number; b: Body }) {
  const y = stage === 0 ? 172 : b.top + (stage >= 4 ? 120 : 110);
  const c = stage === 0 ? b.stroke : b.stroke;
  return (
    <g>
      <ellipse cx="80" cy={y + 2} rx="13" ry="7" fill={c} />
      <ellipse cx="120" cy={y + 2} rx="13" ry="7" fill={c} />
    </g>
  );
}

function Dust({ b }: { b: Body }) {
  return (
    <g opacity=".55">
      <circle cx="70" cy={b.top + 50} r="3" fill="#9B8F7A" />
      <circle cx="78" cy={b.top + 58} r="2" fill="#9B8F7A" />
      <circle cx="132" cy={b.top + 88} r="2.5" fill="#9B8F7A" />
      <path d={`M 124 ${b.top + 40} q 6 -4 12 0`} stroke="#9B8F7A" strokeWidth="2" fill="none" />
    </g>
  );
}

function OutfitLayer({ outfit, b, stage }: { outfit: OutfitKey; b: Body; stage: number }) {
  // Đỉnh đầu: hộp phim có nắp ở `top - 14`; máy ảnh có ô ngắm/gù ở `top`.
  const head = stage === 0 ? b.top - 14 : stage === 3 ? b.top - 22 : b.top;
  switch (outfit) {
    case "no":
      return (
        <g transform={`translate(${stage === 0 ? 70 : 142} ${stage === 0 ? b.top + 2 : b.top + 26}) rotate(18)`}>
          <path d="M 0 0 L -16 -10 L -16 10 Z" fill="#FF6F91" stroke="#C94A6C" strokeWidth="2" strokeLinejoin="round" />
          <path d="M 0 0 L 16 -10 L 16 10 Z" fill="#FF6F91" stroke="#C94A6C" strokeWidth="2" strokeLinejoin="round" />
          <circle r="5" fill="#FF9AB3" stroke="#C94A6C" strokeWidth="2" />
        </g>
      );
    case "nonla":
      return (
        <g>
          <path d={`M 52 ${head + 4} L 100 ${head - 36} L 148 ${head + 4} Q 100 ${head + 14} 52 ${head + 4} Z`} fill="#F1DDA6" stroke="#A9874A" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={`M 76 ${head - 16} Q 100 ${head - 10} 124 ${head - 16}`} stroke="#C9A866" strokeWidth="1.8" fill="none" />
          <path d={`M 64 ${head - 6} Q 100 ${head + 2} 136 ${head - 6}`} stroke="#C9A866" strokeWidth="1.8" fill="none" />
        </g>
      );
    case "kinh": {
      const ey = b.ly - b.lr * 0.12;
      const ex = b.lr * 0.38;
      return (
        <g>
          <rect x={b.lx - ex - 12} y={ey - 8} width="22" height="15" rx="6" fill="#111" stroke="#000" strokeWidth="2" />
          <rect x={b.lx + ex - 10} y={ey - 8} width="22" height="15" rx="6" fill="#111" stroke="#000" strokeWidth="2" />
          <path d={`M ${b.lx - ex + 10} ${ey - 2} L ${b.lx + ex - 10} ${ey - 2}`} stroke="#000" strokeWidth="3" />
          <path d={`M ${b.lx - ex - 8} ${ey - 5} l 6 0`} stroke="#fff" strokeWidth="2" opacity=".6" strokeLinecap="round" />
          <path d={`M ${b.lx + ex - 6} ${ey - 5} l 6 0`} stroke="#fff" strokeWidth="2" opacity=".6" strokeLinecap="round" />
        </g>
      );
    }
    case "nocho": {
      const y = stage === 0 ? 160 : b.top + (stage >= 4 ? 112 : 102);
      return (
        <g transform={`translate(100 ${y})`}>
          {/* đỏ rượu vang: nổi được trên cả thân hồng, xanh lẫn đen */}
          <path d="M 0 0 L -15 -9 L -15 9 Z" fill="#B0283C" stroke="#6E1424" strokeWidth="2" strokeLinejoin="round" />
          <path d="M 0 0 L 15 -9 L 15 9 Z" fill="#B0283C" stroke="#6E1424" strokeWidth="2" strokeLinejoin="round" />
          <circle r="4.5" fill="#D9445A" stroke="#6E1424" strokeWidth="2" />
        </g>
      );
    }
    case "voan":
      return (
        <g>
          <path d={`M 76 ${head} Q 34 ${head + 50} 38 ${head + 112} L 62 ${head + 104} Q 58 ${head + 50} 90 ${head + 4} Z`} fill="#fff" opacity=".6" stroke="#D9D2E0" strokeWidth="1.5" />
          <path d={`M 124 ${head} Q 166 ${head + 50} 162 ${head + 112} L 138 ${head + 104} Q 142 ${head + 50} 110 ${head + 4} Z`} fill="#fff" opacity=".6" stroke="#D9D2E0" strokeWidth="1.5" />
          {[78, 89, 100, 111, 122].map((cx) => (
            <circle key={cx} cx={cx} cy={head - 2 + Math.abs(cx - 100) * 0.12} r="4" fill="#FFF7FB" stroke="#F0C8D6" strokeWidth="1.5" />
          ))}
        </g>
      );
    case "vuongmien":
      return (
        <g>
          <path d={`M 76 ${head + 2} L 72 ${head - 22} L 87 ${head - 10} L 100 ${head - 30} L 113 ${head - 10} L 128 ${head - 22} L 124 ${head + 2} Z`} fill="#FFD84D" stroke="#B7861C" strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="100" cy={head - 30} r="3.5" fill="#FF6F91" />
          <circle cx="72" cy={head - 22} r="3" fill="#7EC8FF" />
          <circle cx="128" cy={head - 22} r="3" fill="#7EC8FF" />
          <circle cx="100" cy={head - 6} r="4" fill="#AF2BB8" />
        </g>
      );
  }
}

export default function PetSprite({
  stage,
  mood,
  outfit = null,
  size = 200,
  idle = true,
  silhouette = false,
  className,
}: {
  stage: number;
  mood: Mood;
  outfit?: OutfitKey | null;
  size?: number;
  /** Nhún nhẹ + chớp mắt. Tắt ở hình nhỏ cho đỡ rối. */
  idle?: boolean;
  /** Bóng đen — giai đoạn chưa mở trong "Hành trình lớn lên". */
  silhouette?: boolean;
  className?: string;
}) {
  const s = Math.max(0, Math.min(BODIES.length - 1, stage));
  const b = BODIES[s];
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Bé Máy Ảnh"
      style={silhouette ? { filter: "brightness(0) opacity(.18)" } : undefined}
    >
      <defs>
        <radialGradient id="pet-glass" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#7C6FB8" stopOpacity=".55" />
          <stop offset=".6" stopColor="#3B3654" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="186" rx="52" ry="7" fill="#000" opacity=".12" />
      <g className={idle ? "pet-bob" : undefined}>
        <Feet stage={s} b={b} />
        <Shell stage={s} b={b} />
        {mood === "buon" && !silhouette && <Dust b={b} />}
        <Face mood={mood} b={b} stage={s} />
        {s === 5 && !silhouette && (
          <g className="pet-sparkle" fill="#FFD84D">
            <path d="M 34 60 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 Z" />
            <path d="M 168 92 l 2 6 l 6 2 l -6 2 l -2 6 l -2 -6 l -6 -2 l 6 -2 Z" />
            <path d="M 160 36 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 Z" />
          </g>
        )}
        {outfit && <OutfitLayer outfit={outfit} b={b} stage={s} />}
      </g>
    </svg>
  );
}
