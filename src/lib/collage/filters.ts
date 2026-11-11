/* ═══════════════════════════════════════════════════════════════════════════
   BỘ LỌC MÀU ĐỒNG BỘ cho cả bộ ảnh ghép (đen trắng, phim ấm, lạnh trong,
   pastel, phim nhạt). Chỉ áp lên ẢNH (khung ảnh + nền ảnh mờ), không áp lên chữ
   / trang trí / màu nền.

   Mỗi bộ lọc là MỘT danh sách hàm lọc CSS (grayscale, sepia, saturate,
   contrast, brightness). Màn sửa dùng thẳng chuỗi CSS đó; bộ xuất canvas dựng
   lại đúng các ma trận màu mà đặc tả Filter Effects định nghĩa cho từng hàm và
   áp lên điểm ảnh — không dựa vào ctx.filter (Safari trên iPhone bỏ qua khi vẽ
   ảnh). Hai bên ra cùng một màu. Thuần — kiểm thử bằng node.
   ═══════════════════════════════════════════════════════════════════════════ */

type Step = ["grayscale" | "sepia" | "saturate" | "contrast" | "brightness", number];

export interface PhotoFilter {
  id: string;
  name: string;
  steps: Step[];
}

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: "none", name: "Màu gốc", steps: [] },
  { id: "bw", name: "Đen trắng", steps: [["grayscale", 1], ["contrast", 1.08]] },
  { id: "warm", name: "Phim ấm", steps: [["sepia", 0.22], ["saturate", 1.12], ["contrast", 1.04]] },
  { id: "cool", name: "Lạnh trong", steps: [["saturate", 0.9], ["brightness", 1.04], ["contrast", 1.05]] },
  { id: "pastel", name: "Pastel", steps: [["saturate", 0.72], ["contrast", 0.88], ["brightness", 1.07]] },
  { id: "fade", name: "Phim nhạt", steps: [["sepia", 0.12], ["saturate", 0.82], ["contrast", 0.84], ["brightness", 1.05]] },
  { id: "rich", name: "Rực rỡ", steps: [["saturate", 1.28], ["contrast", 1.08]] },
];

export const FILTER_IDS = new Set(PHOTO_FILTERS.map((f) => f.id));

export function filterById(id: string | null | undefined): PhotoFilter | null {
  const f = PHOTO_FILTERS.find((x) => x.id === id);
  return f && f.steps.length ? f : null;
}

/** Chuỗi CSS `filter` cho màn sửa (undefined = không lọc). */
export function filterCss(id: string | null | undefined): string | undefined {
  const f = filterById(id);
  return f ? f.steps.map(([k, v]) => `${k}(${v})`).join(" ") : undefined;
}

/** Ma trận 3×4 (3×3 + độ dời) của một hàm lọc, theo đặc tả Filter Effects. */
function stepMatrix([k, a]: Step): number[] {
  switch (k) {
    case "grayscale": {
      const g = 1 - Math.min(1, Math.max(0, a));
      return [0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g, 0, 0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g, 0, 0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g, 0];
    }
    case "sepia": {
      const g = 1 - Math.min(1, Math.max(0, a));
      return [0.393 + 0.607 * g, 0.769 - 0.769 * g, 0.189 - 0.189 * g, 0, 0.349 - 0.349 * g, 0.686 + 0.314 * g, 0.168 - 0.168 * g, 0, 0.272 - 0.272 * g, 0.534 - 0.534 * g, 0.131 + 0.869 * g, 0];
    }
    case "saturate":
      return [0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a, 0, 0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a, 0, 0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a, 0];
    case "contrast":
      return [a, 0, 0, 0.5 - 0.5 * a, 0, a, 0, 0.5 - 0.5 * a, 0, 0, a, 0.5 - 0.5 * a];
    case "brightness":
      return [a, 0, 0, 0, 0, a, 0, 0, 0, 0, a, 0];
  }
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
}

/**
 * Áp bộ lọc lên mảng RGBA tại chỗ: lần lượt từng hàm lọc, kẹp 0..1 sau mỗi
 * bước như trình duyệt làm với chuỗi CSS. Bảng tra 256 mức cho bước đơn kênh.
 */
export function applyFilter(data: Uint8ClampedArray, id: string | null | undefined): void {
  const f = filterById(id);
  if (!f) return;
  const ms = f.steps.map(stepMatrix);
  for (let i = 0; i + 3 < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;
    for (const m of ms) {
      const nr = m[0] * r + m[1] * g + m[2] * b + m[3];
      const ng = m[4] * r + m[5] * g + m[6] * b + m[7];
      const nb = m[8] * r + m[9] * g + m[10] * b + m[11];
      r = nr < 0 ? 0 : nr > 1 ? 1 : nr;
      g = ng < 0 ? 0 : ng > 1 ? 1 : ng;
      b = nb < 0 ? 0 : nb > 1 ? 1 : nb;
    }
    data[i] = r * 255;
    data[i + 1] = g * 255;
    data[i + 2] = b * 255;
  }
}
