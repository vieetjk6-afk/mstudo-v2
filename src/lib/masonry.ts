"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Khe giữa các ảnh (px) — hẹp để lưới liền mạch, nhưng đủ tách từng tấm. */
export const MASONRY_GAP = 6;
/** Tỉ lệ tạm (cao/rộng) cho ảnh CHƯA đo được — 3:2 nằm ngang, dạng phổ biến nhất. */
const FALLBACK_RATIO = 2 / 3;
/** Bề rộng cột giả định cho lượt dựng ĐẦU (máy chủ chưa biết màn hình rộng bao
 *  nhiêu). Phải là hằng số: máy chủ và trình duyệt cùng dựng ra một kết quả thì
 *  React mới không kêu lệch. Ngay khi gắn vào DOM là đo lại, trước lúc vẽ. */
const COL_TAM = 180;
/** Dựng thêm bao nhiêu MÀN HÌNH phía trên và dưới khung nhìn. Đo trên khổ
 *  iPhone: 3 màn hình mỗi phía ≈ 150 ô trong DOM — vẫn 60 hình/giây phẳng. */
const DU_MAN_HINH = 3;
/** Xa hơn nữa thì CHƯA dựng ô, nhưng đã gọi sẵn byte ảnh về bộ nhớ đệm. Không
 *  có lớp này thì cuộn nhanh là thấy ô trắng: ô vừa dựng mới bắt đầu tải ảnh. */
const DU_TAI_TRUOC = 6;
/**
 * Số ảnh tải trước được phép CHẠY CÙNG LÚC — bằng đúng số kết nối trình duyệt
 * mở song song tới một máy chủ. Đo ra hai đầu đều hỏng: thả cửa (châm liên tục
 * mỗi khung hình) thì hàng đợi phình mãi, ảnh đang xem phải xếp sau cả trăm ảnh
 * tải trước; siết còn 3 thì tải trước không theo kịp tay vuốt. Giữ 6 thì hàng
 * đợi luôn ngắn và tự co theo mạng: mạng khoẻ chạy nhanh, mạng yếu tự chậm lại.
 */
const TAI_TRUOC_CUNG_LUC = 6;

interface Luoi {
  ids: string[];
  /** Vị trí đã tính: đỉnh, chiều cao, cột của từng ô. */
  y: number[];
  h: number[];
  cot: number[];
  cao: number;
  el: HTMLElement | null;
  dau: number;
  cuoi: number;
}

/**
 * Lưới ảnh kiểu "gạch xây", đặt ảnh TRÁI → PHẢI, và CHỈ DỰNG PHẦN ĐANG NHÌN.
 *
 * VÌ SAO KHÔNG CÒN DÙNG CSS GRID NỮA
 *
 * Bản trước xếp bằng CSS grid: dòng lưới mảnh 4px, mỗi ảnh chiếm số dòng theo
 * tỉ lệ của nó. Đẹp và ngắn, nhưng album lớn thì mọi ô đều phải nằm trong DOM
 * cùng lúc — và đo trên Chromium khổ iPhone (`npm run ui:luoi-anh`) ra con số
 * dứt khoát:
 *      300 ô trong DOM  → 60 hình/giây phẳng lì, 0 tác vụ dài
 *     3000 ô trong DOM  → 26 hình/giây, 233/400 khung vẽ quá 32ms
 * Nguyên nhân là SỐ Ô, không phải ảnh nặng: cùng bộ ảnh đó, chỉ giảm số ô là
 * hết giật. Mọi cách vá bên trên (nhả byte ảnh, content-visibility) đều không
 * chạm tới gốc, có cách còn làm ô trắng khi khách lướt ngược lên.
 *
 * Nên giờ chỗ này tự tính vị trí từng ô (xếp vào cột thấp nhất — đúng kiểu
 * masonry, vẫn đi trái → phải) rồi đặt tuyệt đối, và React chỉ dựng những ô
 * nằm trong khung nhìn ± 2 màn hình. Album 3000 ảnh cũng chỉ còn chừng trăm ô
 * trong DOM, cuộn tới đâu dựng tới đó.
 *
 * Ảnh chưa tải thì chưa biết tỉ lệ thật, nên dùng tỉ lệ tạm; tải xong là tính
 * lại và ghi thẳng vị trí mới vào DOM, KHÔNG dựng lại cây React. Ảnh phía TRÊN
 * khung nhìn đều đã đo rồi nên không xô, khách cuộn ngược lên không bị nhảy.
 */
export function useMasonry(
  colsMobile = 2,
  colsDesktop = 4,
  /** Địa chỉ ảnh của một ô — có hàm này thì lưới tải trước được ảnh sắp tới. */
  srcOf?: (id: string) => string | null | undefined,
) {
  const luoi = useRef(new Map<string, Luoi>());
  /** id ô → id lưới chứa nó, để ảnh tải xong biết phải tính lại lưới nào. */
  const thuoc = useRef(new Map<string, string>());
  const ratios = useRef(new Map<string, number>());
  const tiles = useRef(new Map<string, HTMLElement>());
  const colWidth = useRef(0);
  const cols = useRef(colsMobile);
  const ngoai = useRef<HTMLElement | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const cho = useRef<number | null>(null);
  const [, dung] = useState(0);
  /** Chỉ bắt React dựng lại khi CỬA SỔ đổi — không phải mỗi lần ảnh tải xong. */
  const bumpRef = useRef(() => dung((n) => n + 1));

  const daTaiTruoc = useRef(new Set<string>());
  const dangTaiTruoc = useRef(0);
  const srcRef = useRef(srcOf);
  srcRef.current = srcOf;
  const luoiRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const tileRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const imgPropsCache = useRef(new Map<string, { onLoad: (e: { currentTarget: HTMLImageElement }) => void; ref: (el: HTMLImageElement | null) => void }>());

  /** Xếp lại cả một lưới: mỗi ô vào cột đang thấp nhất (ưu tiên cột trái khi bằng). */
  const xep = useCallback((l: Luoi) => {
    const c = cols.current;
    const w = colWidth.current || COL_TAM;
    const day = new Array<number>(c).fill(0);
    l.y = new Array(l.ids.length);
    l.h = new Array(l.ids.length);
    l.cot = new Array(l.ids.length);
    for (let i = 0; i < l.ids.length; i++) {
      let k = 0;
      for (let j = 1; j < c; j++) if (day[j] < day[k] - 0.5) k = j;
      const h = Math.round(w * (ratios.current.get(l.ids[i]) ?? FALLBACK_RATIO));
      l.y[i] = day[k];
      l.h[i] = h;
      l.cot[i] = k;
      day[k] += h + MASONRY_GAP;
    }
    l.cao = Math.max(0, ...day) - MASONRY_GAP;
  }, []);

  /**
   * Khoảng ô nằm giữa hai mốc dọc `tren`–`duoi` (toạ độ trong lưới).
   *
   * `y` không bao giờ giảm — mỗi ô mới rơi vào cột đang thấp nhất, mà mức thấp
   * nhất chỉ có tăng — nên tìm nhị phân được. Album 3000 ảnh mà quét cả mảng
   * mỗi khung hình thì riêng việc quét đã ăn hết ngân sách 16ms.
   */
  const khoang = useCallback((l: Luoi, tren: number, duoi: number): [number, number] => {
    const n = l.ids.length;
    if (n === 0) return [0, 0];
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const g = (lo + hi) >> 1;
      if (l.y[g] < tren) lo = g + 1;
      else hi = g;
    }
    // Ô cao có thể bắt đầu TRƯỚC mốc trên mà vẫn thò xuống trong tầm — lùi lại
    // cho tới khi chắc chắn không còn ô nào chạm tới.
    let dau = lo;
    while (dau > 0 && l.y[dau - 1] + l.h[dau - 1] >= tren) dau--;
    let cuoi = lo;
    while (cuoi < n && l.y[cuoi] <= duoi) cuoi++;
    return dau >= cuoi ? [0, 0] : [dau, cuoi];
  }, []);

  /** Ô nào nằm trong khung nhìn ± mấy màn hình → chỉ dựng bấy nhiêu. */
  const tinhCuaSo = useCallback(
    (l: Luoi): [number, number] => {
      const n = l.ids.length;
      // Chưa gắn vào DOM (hoặc chưa đo được bề rộng) thì GIỮ NGUYÊN cửa sổ đang
      // có. Trả về một cửa sổ mặc định ở đây là sinh lỗi thật: album nhiều mục
      // thì React tháo hết ref rồi mới gắn lại từng cái, nên mỗi lượt quét luôn
      // gặp một lưới "chưa gắn" → cửa sổ nhảy về mặc định → dựng lại → tháo ref
      // → lặp vô tận, và trang văng ra "Đã có lỗi xảy ra".
      if (!l.el || !colWidth.current) return [l.dau, l.cuoi || Math.min(n, 60)];
      const r = l.el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const du = vh * DU_MAN_HINH;
      return khoang(l, -r.top - du, -r.top + vh + du);
    },
    [khoang]
  );

  /** Gọi sẵn byte ảnh của những ô sắp tới — chưa dựng ô, chỉ ấm bộ nhớ đệm. */
  const taiTruoc = useCallback(
    (l: Luoi) => {
      const lay = srcRef.current;
      if (!lay || !l.el || !colWidth.current) return;
      const r = l.el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const du = vh * DU_TAI_TRUOC;
      const [dau, cuoi] = khoang(l, -r.top - du, -r.top + vh + du);
      for (let i = dau; i < cuoi; i++) {
        if (dangTaiTruoc.current >= TAI_TRUOC_CUNG_LUC) return;
        const id = l.ids[i];
        if (daTaiTruoc.current.has(id)) continue;
        const src = lay(id);
        if (!src) continue;
        daTaiTruoc.current.add(id);
        dangTaiTruoc.current++;
        const im = new Image();
        im.decoding = "async";
        // Ưu tiên THẤP: ảnh tải trước không được chen hàng trước ảnh khách đang nhìn.
        im.fetchPriority = "low";
        const xong = () => {
          dangTaiTruoc.current = Math.max(0, dangTaiTruoc.current - 1);
        };
        im.onload = xong;
        im.onerror = xong;
        im.src = src;
      }
    },
    [khoang]
  );

  /** Ghi vị trí mới cho những ô ĐANG mount — không qua React. */
  const ghiViTri = useCallback((l: Luoi) => {
    const w = colWidth.current || COL_TAM;
    for (let i = l.dau; i < l.cuoi; i++) {
      const el = tiles.current.get(l.ids[i]);
      if (!el) continue;
      el.style.left = `${l.cot[i] * (w + MASONRY_GAP)}px`;
      el.style.top = `${l.y[i]}px`;
      el.style.width = `${w}px`;
      el.style.height = `${l.h[i]}px`;
    }
    if (l.el) l.el.style.height = `${l.cao}px`;
  }, []);

  /** Quét lại cửa sổ của mọi lưới; chỉ dựng lại React khi có lưới đổi cửa sổ. */
  const quet = useCallback(() => {
    let doi = false;
    for (const l of luoi.current.values()) {
      const [dau, cuoi] = tinhCuaSo(l);
      if (dau !== l.dau || cuoi !== l.cuoi) {
        l.dau = dau;
        l.cuoi = cuoi;
        doi = true;
      }
      taiTruoc(l);
    }
    if (doi) bumpRef.current();
  }, [tinhCuaSo, taiTruoc]);

  /** Cuộn thì gom về MỘT lượt mỗi khung hình — cuộn bắn sự kiện dày hơn nhiều. */
  const quetHoan = useCallback(() => {
    if (cho.current != null) return;
    cho.current = requestAnimationFrame(() => {
      cho.current = null;
      quet();
    });
  }, [quet]);

  const doLai = useCallback(() => {
    const el = ngoai.current;
    if (!el) return;
    const c = window.matchMedia("(min-width: 768px)").matches ? colsDesktop : colsMobile;
    const w = el.clientWidth;
    if (w <= 0) return;
    const rong = (w - MASONRY_GAP * (c - 1)) / c;
    if (c === cols.current && Math.abs(rong - colWidth.current) < 0.5) return;
    cols.current = c;
    colWidth.current = rong;
    for (const l of luoi.current.values()) {
      xep(l);
      ghiViTri(l);
    }
    quet();
  }, [colsMobile, colsDesktop, xep, ghiViTri, quet]);

  /** Khung BAO các lưới — chỗ đo bề rộng một cột. */
  const ref = useCallback(
    (el: HTMLElement | null) => {
      ro.current?.disconnect();
      ngoai.current = el;
      if (!el) return;
      doLai();
      ro.current = new ResizeObserver(doLai);
      ro.current.observe(el);
    },
    [doLai]
  );

  useEffect(() => {
    window.addEventListener("scroll", quetHoan, { passive: true });
    window.addEventListener("resize", quetHoan);
    return () => {
      window.removeEventListener("scroll", quetHoan);
      window.removeEventListener("resize", quetHoan);
      ro.current?.disconnect();
      if (cho.current != null) cancelAnimationFrame(cho.current);
    };
  }, [quetHoan]);

  /**
   * Khai báo MỘT lưới (album chia theo thư mục thì mỗi mục một lưới).
   * Trả về props cho khung chứa; gọi trong lúc dựng, trước khi map các ô.
   */
  const lattice = useCallback(
    (key: string, ids: string[]) => {
      let l = luoi.current.get(key);
      if (!l) {
        l = { ids, y: [], h: [], cot: [], cao: 0, el: null, dau: 0, cuoi: Math.min(ids.length, 60) };
        luoi.current.set(key, l);
        xep(l);
      } else if (l.ids !== ids) {
        l.ids = ids;
        xep(l);
        const [dau, cuoi] = tinhCuaSo(l);
        l.dau = dau;
        l.cuoi = cuoi;
      }
      for (const id of ids) thuoc.current.set(id, key);
      // Hàm ref phải giữ nguyên danh tính: tạo mới mỗi lượt dựng là React tháo
      // ra gắn lại toàn bộ khung lưới sau mỗi lần dựng — vừa phí, vừa là thứ đã
      // làm album nhiều mục dựng lại vô tận.
      let gan = luoiRefs.current.get(key);
      if (!gan) {
        gan = (el: HTMLElement | null) => {
          const cua = luoi.current.get(key);
          if (!cua) return;
          cua.el = el;
          if (!el) return;
          el.style.height = `${cua.cao}px`;
          quet();
        };
        luoiRefs.current.set(key, gan);
      }
      return {
        ref: gan,
        style: { position: "relative", height: l.cao } as CSSProperties,
      };
    },
    [xep, tinhCuaSo, quet]
  );

  /**
   * Khoảng ô cần dựng của một lưới: dùng để cắt mảng ảnh (`slice`).
   * Kẹp lại theo số ảnh hiện có — khách đổi tab hay lọc theo khuôn mặt là danh
   * sách ngắn lại ngay, cửa sổ cũ có thể còn trỏ ra ngoài mảng.
   */
  const range = useCallback((key: string): [number, number] => {
    const l = luoi.current.get(key);
    if (!l) return [0, 0];
    const n = l.ids.length;
    return [Math.min(l.dau, n), Math.min(l.cuoi, n)];
  }, []);

  /** Props cho MỘT ô ảnh: vị trí tuyệt đối trong lưới của nó. */
  const tileProps = useCallback(
    (key: string, id: string, i: number) => {
      const l = luoi.current.get(key);
      const w = colWidth.current || COL_TAM;
      // `?? 0` chứ không tin chắc có: nếu danh sách vừa ngắn lại mà ô cũ còn kịp
      // dựng thêm một nhịp thì l.cot[i] là undefined, nhân lên ra NaN và ô bay
      // khỏi màn hình. Nhịp sau lưới xếp lại là đâu vào đấy.
      const style: CSSProperties = {
        position: "absolute",
        left: (l?.cot[i] ?? 0) * (w + MASONRY_GAP),
        top: l?.y[i] ?? 0,
        width: w,
        height: l?.h[i] ?? Math.round(w * FALLBACK_RATIO),
      };
      let f = tileRefs.current.get(id);
      if (!f) {
        f = (el: HTMLElement | null) => {
          if (el) tiles.current.set(id, el);
          else tiles.current.delete(id);
        };
        tileRefs.current.set(id, f);
      }
      return { ref: f, style };
    },
    []
  );

  /**
   * Ảnh đã hiện thì tắt nhịp "đang tải" của ô (lớp .o-anh-cho trong globals.css).
   * Phải tắt hẳn chứ không để đó cho ảnh che: nhịp đó là hoạt ảnh màu nền, trình
   * duyệt vẫn vẽ lại từng ô mỗi khung hình dù không ai nhìn thấy.
   */
  const xongCho = useCallback((id: string) => {
    tiles.current.get(id)?.classList.remove("o-anh-cho");
  }, []);

  /** Ảnh tải xong mới biết tỉ lệ thật → xếp lại lưới của nó và ghi thẳng vào DOM. */
  const doAnh = useCallback(
    (id: string, img: HTMLImageElement) => {
      if (ratios.current.has(id)) return;
      const r = img.naturalHeight / img.naturalWidth;
      if (!r || !Number.isFinite(r) || img.naturalWidth <= 1) return;
      ratios.current.set(id, r);
      const key = thuoc.current.get(id);
      const l = key ? luoi.current.get(key) : null;
      if (!l) return;

      // NEO CUỘN. Ảnh nằm TRÊN khung nhìn tải xong muộn (khách vuốt nhanh qua nó)
      // thì ô đó đổi chiều cao và đẩy mọi thứ bên dưới — đúng lúc khách đang đọc,
      // chữ và ảnh nhảy dưới tay. Trình duyệt có sẵn cơ chế neo cho dòng chảy
      // thường, nhưng ô ở đây đặt tuyệt đối nên nó không đỡ; phải tự bù.
      // Cách bù: nhớ vị trí ô trên cùng đang thấy, xếp lại, rồi cuộn bù đúng
      // phần nó xê dịch.
      const r0 = l.el?.getBoundingClientRect();
      const dinh = r0 ? -r0.top : 0;
      let neo = -1;
      if (r0) {
        for (let i = l.dau; i < l.cuoi; i++) {
          if (l.y[i] + l.h[i] > dinh) { neo = i; break; }
        }
      }
      const truoc = neo >= 0 ? l.y[neo] : 0;

      xep(l);

      if (neo >= 0) {
        const lech = l.y[neo] - truoc;
        if (lech) window.scrollBy(0, lech);
      }
      ghiViTri(l);
      quetHoan();
    },
    [xep, ghiViTri, quetHoan]
  );

  /** Props gắn vào thẻ <img> của một ô ảnh. */
  const imgProps = useCallback(
    (id: string) => {
      let p = imgPropsCache.current.get(id);
      if (!p) {
        p = {
          onLoad: (e: { currentTarget: HTMLImageElement }) => {
            xongCho(id);
            doAnh(id, e.currentTarget);
          },
          ref: (el: HTMLImageElement | null) => {
            // Ảnh nằm sẵn trong bộ nhớ đệm thì sự kiện load KHÔNG bắn nữa —
            // đo qua ref mới không sót.
            if (el?.complete && el.naturalWidth > 1) {
              xongCho(id);
              doAnh(id, el);
            }
          },
        };
        imgPropsCache.current.set(id, p);
      }
      return p;
    },
    [doAnh, xongCho]
  );

  return { ref, lattice, range, tileProps, imgProps };
}
