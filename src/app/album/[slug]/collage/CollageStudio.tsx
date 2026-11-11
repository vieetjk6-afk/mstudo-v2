"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { COLLAGE_LIMITS, type CollageDoc, type LayoutInput } from "@/lib/collage/types";
import { DEFAULT_FORMAT_ID } from "@/lib/collage/formats";
import { DEFAULT_STYLE_ID } from "@/lib/collage/styles";
import { collectTexts, generateDoc, pagePhotoIds } from "@/lib/collage/generate";
import { loadCollageFonts } from "@/lib/collage/text-layout";
import { docFontKeys, lockDate, lockNames, type LockCtx } from "@/lib/collage/lockups";
import { endSlideUrl, signFor, type CollageBrandPublic } from "@/lib/collage/brand";
import { isEndPage, makeEndPage } from "@/lib/collage/endcard";
import { storyChapters, fold } from "@/lib/collage/categories";
import { captionsFor } from "@/lib/collage/captions";
import { docSummary } from "@/lib/collage/summary";
import { heroPhoto } from "@/lib/collage/compose";
import { styleById } from "@/lib/collage/styles";
import VideoSheet from "./VideoSheet";
import PostPreview from "./PostPreview";
import { quantize } from "@/lib/collage/palette";
import { loadImage } from "@/lib/collage/render";
import { rawImageUrl } from "./ExportSheet";
import type { PhotoCat, PhotoInfo } from "@/lib/collage/categories";
import type { PersonChip } from "@/lib/face-people";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { useAlbumImg } from "@/app/a/[slug]/album-v2-ui";
import { CollageApiError, deleteSet, errorCode, errorText, fetchPhotos, fetchSets, isTransient, postEvent, saveSet, type Cred, type PhotoLite, type PhotosPayload, type SavedSet } from "./api";
import PickStep, { type PickMode } from "./PickStep";
import OptionsStep, { type CollageOptions } from "./OptionsStep";
import { OverviewStep, SetsStep, type SaveStatus } from "./OverviewStep";
import EditorStep from "./EditorStep";
import ExportSheet from "./ExportSheet";
import { StudioHeader, useToast } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   MÀN GHÉP LAYOUT ẢNH — phủ toàn màn hình trên album giao khách.

   Luồng: (bộ đã lưu) → chọn ảnh → tuỳ chọn → máy ghép cả bộ → sửa từng
   layout → tải về. Bộ layout tự lưu lên máy chủ sau mỗi lần sửa và được GIỮ 1
   NGÀY kể từ lần lưu cuối (bảng album_collages) — đóng trang, đổi máy (xác
   minh SĐT lại) vẫn mở ra sửa tiếp được.

   Chỉ dùng ảnh studio đã giao trong album: danh sách ảnh lấy từ máy chủ, không
   có nút tải ảnh lên, và máy chủ từ chối mọi id ảnh lạ khi lưu.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CollageStudioProps {
  slug: string;
  /** Vé mở khoá album có mật khẩu. */
  access?: string;
  /** Vé SĐT cô dâu / chú rể (null khi hợp đồng không ghi SĐT). */
  coupleKey: string | null;
  /** Chữ watermark (album bật watermark giao khách) — đóng lên ảnh tải về. */
  watermark: string | null;
  theme: "light" | "dark";
  albumTitle: string;
  eventDate: string | null;
  /** Ảnh khách đã thả tim trong album — được ưu tiên khi gợi ý. */
  hearts: ReadonlySet<string>;
  /** Khuôn mặt studio đã gom (để hiện ảnh mặt trên chip cô dâu / chú rể). */
  people: PersonChip[];
  /**
   * Ảnh album đang hiện trên trang (cùng bộ lọc ảnh giao khách với máy chủ). Máy
   * chủ chậm / lỗi tạm thời thì màn ghép chạy tiếp bằng danh sách này — chỉ thiếu
   * nhóm gợi ý theo khuôn mặt — thay vì quay vòng "Đang mở album…" mãi.
   */
  galleryPhotos?: readonly GalleryPhotoLike[];
  /** Cài đặt ghép ảnh của studio (ký tên, slide cuối, khoá màu) + tên / logo / đường dẫn. */
  brand?: CollageBrandPublic | null;
  onClose: () => void;
  onNeedVerify: () => void;
}

type Step = "loading" | "error" | "sets" | "pick" | "options" | "overview" | "edit";

type GalleryPhotoLike = { id: string; drive_file_id: string; source_id: string | null; name?: string | null; is_video?: boolean | null };

const VIDEO_RE = /\.(mp4|mov|m4v|webm|avi|mkv|wmv|flv|3gp)$/i;
/** Mở lâu hơn chừng này thì nói cho khách biết, và cho bấm "Mở luôn". */
const SLOW_MS = 5000;
/** Lưu hỏng vì mạng / máy chủ: tự thử lại sau ngần này, tối đa SAVE_RETRIES lần liền. */
const SAVE_RETRY_MS = 10_000;
const SAVE_RETRIES = 6;

const DEFAULT_OPTS: CollageOptions = { formatId: DEFAULT_FORMAT_ID, perPage: 4, styleId: DEFAULT_STYLE_ID, texts: [""], lockup: "auto", carousel: 0 };

/** Số slide nếu bộ là MỘT carousel liền mạch, ngược lại 0. */
const carouselOf = (d: Pick<CollageDoc, "pages">) => (d.pages.length === 1 && (d.pages[0].span ?? 1) > 1 ? Math.round(d.pages[0].span!) : 0);
const HISTORY_MAX = 40;
/** Tự lưu sau khi khách ngừng tay 2,5 giây — gom nhiều lần chạm thành một lượt ghi. */
const SAVE_DELAY = 2500;

/** Mọi ảnh bộ layout dùng phải có tỉ lệ trong doc.aspects (để vẽ lại đúng khi mở lại). */
function fillAspects(doc: CollageDoc, measured: Record<string, number>): CollageDoc {
  const need = new Set<string>(doc.photoIds);
  for (const p of doc.pages) {
    if (p.bgPhoto) need.add(p.bgPhoto.photoId);
    for (const f of p.frames) if (f.kind === "photo") need.add(f.photoId);
  }
  let aspects = doc.aspects;
  for (const id of need) {
    if (aspects[id] != null) continue;
    const a = measured[id];
    if (a) aspects = { ...aspects, [id]: Math.round(a * 1000) / 1000 };
  }
  return aspects === doc.aspects ? doc : { ...doc, aspects };
}

export default function CollageStudio(props: CollageStudioProps) {
  const { slug, access, coupleKey, watermark, theme, hearts, people } = props;
  const img = useAlbumImg();
  const toast = useToast();
  const cred: Cred = useMemo(() => ({ slug, key: coupleKey, access }), [slug, coupleKey, access]);

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  // Danh sách ảnh của máy chủ (chuẩn); chưa có thì dùng ảnh trang album đang có.
  const [serverPhotos, setServerPhotos] = useState<PhotoLite[] | null>(null);
  const galleryList = useMemo(
    () =>
      (props.galleryPhotos ?? [])
        .filter((p) => !p.is_video && !VIDEO_RE.test(p.name ?? ""))
        .map((p): PhotoLite => ({ id: p.id, d: p.drive_file_id, s: p.source_id })),
    [props.galleryPhotos],
  );
  const photos = serverPhotos ?? galleryList;
  const [cats, setCats] = useState<PhotoCat[]>([]);
  const [info, setInfo] = useState<Record<string, PhotoInfo>>({});
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  // "Tự chọn từng layout": ảnh của từng layout + layout đang chọn ảnh.
  const [mode, setModeState] = useState<PickMode>("auto");
  const [groups, setGroups] = useState<string[][]>([[]]);
  const [activeGroup, setActiveGroup] = useState(0);
  const manualIds = useMemo(() => [...new Set(groups.flat())], [groups]);
  const manualPages = groups.filter((g) => g.length).length;
  const [opts, setOpts] = useState<CollageOptions>(DEFAULT_OPTS);
  const [doc, setDoc] = useState<CollageDoc | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [fontsReady, setFontsReady] = useState(0);
  const [busy, setBusy] = useState(false);
  const [save, setSave] = useState<SaveStatus>({ state: "idle" });
  const [canUndo, setCanUndo] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const docRef = useRef<CollageDoc | null>(null);
  const setIdRef = useRef<string | null>(null);
  const pastRef = useRef<CollageDoc[]>([]);
  const aspectsRef = useRef<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const savePending = useRef(false);
  const dirty = useRef(false);
  const saveFails = useRef(0);
  const credRef = useRef(cred);
  credRef.current = cred;
  /** Lượt nạp hiện hành — kết quả của lượt cũ (đã bấm Thử lại / đã đóng) bị bỏ qua. */
  const loadGen = useRef(0);
  const skipRef = useRef<(() => void) | null>(null);
  const galleryRef = useRef(galleryList);
  galleryRef.current = galleryList;

  /* ── Ảnh: id → drive id, và đầu vào cho bộ dàn trang ── */
  const driveIdOf = useMemo(() => new Map(photos.map((p) => [p.id, p.d])), [photos]);
  const driveOf = useCallback((id: string) => driveIdOf.get(id), [driveIdOf]);
  // Màu chủ đạo từng ảnh — chỉ nạp khi cần (phong cách "Màu theo ảnh", tab Nền).
  const palettesRef = useRef(new Map<string, string[]>());
  const [paletteTick, setPaletteTick] = useState(0);
  const buildInputs = useCallback(
    (asp: Record<string, number>) => {
      const m = new Map<string, LayoutInput>();
      for (const p of photos) {
        const a = asp[p.id];
        if (!a) continue;
        const it = info[p.id];
        const pal = palettesRef.current.get(p.id);
        m.set(p.id, { id: p.id, aspect: a, score: (it?.score ?? 5) + (hearts.has(p.id) ? 3 : 0), hero: !!it?.hero, faces: it?.faces ?? [], ...(pal?.length ? { palette: pal } : {}) });
      }
      return m;
    },
    // paletteTick: dựng lại khi vừa nạp thêm màu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos, info, hearts, paletteTick],
  );
  const rawOf = img.raw ?? rawImageUrl;
  /** Đọc màu chủ đạo của các ảnh (ảnh nhỏ cùng miền, 48 px là đủ). */
  const paletteFor = useCallback(
    async (ids: string[]) => {
      const todo = [...new Set(ids)].filter((id) => !palettesRef.current.has(id) && driveIdOf.has(id));
      if (todo.length) {
        await Promise.all(
          todo.map(async (id) => {
            try {
              const im = await loadImage(rawOf(driveIdOf.get(id)!, 200));
              const c = document.createElement("canvas");
              c.width = 48;
              c.height = Math.max(8, Math.round((48 * im.naturalHeight) / Math.max(1, im.naturalWidth)));
              const x = c.getContext("2d", { willReadFrequently: true });
              if (!x) throw new Error("no_ctx");
              x.drawImage(im, 0, 0, c.width, c.height);
              palettesRef.current.set(id, quantize(x.getImageData(0, 0, c.width, c.height).data, 5));
            } catch {
              palettesRef.current.set(id, []);
            }
          }),
        );
        setPaletteTick((n) => n + 1);
      }
      return ids.map((id) => palettesRef.current.get(id) ?? []);
    },
    [driveIdOf, rawOf],
  );
  const lockCtx: LockCtx = useMemo(() => ({ date: lockDate(props.eventDate), names: lockNames(props.albumTitle) }), [props.eventDate, props.albumTitle]);

  /* ── Cài đặt ghép ảnh của studio: ký tên, slide cuối, khoá màu ── */
  const brand = props.brand ?? null;
  const sign = useMemo(() => signFor(brand), [brand]);
  // Logo nạp kiểu CORS để vẽ được lên canvas; không nạp được thì ký bằng tên (cả xem trước lẫn ảnh xuất).
  const [signLogo, setSignLogo] = useState<HTMLImageElement | null | "failed">(null);
  useEffect(() => {
    if (sign?.mode !== "logo" || !sign.logoUrl) return;
    let alive = true;
    loadImage(sign.logoUrl).then(
      (im) => alive && setSignLogo(im),
      () => alive && setSignLogo("failed"),
    );
    return () => {
      alive = false;
    };
  }, [sign?.mode, sign?.logoUrl]);
  const viewSign = useMemo(() => (sign && sign.mode === "logo" && signLogo === "failed" ? { ...sign, mode: "name" as const } : sign), [sign, signLogo]);
  const logoImg = signLogo && signLogo !== "failed" ? signLogo : null;
  const endUrl = endSlideUrl(brand);
  const captions = useMemo(() => captionsFor({ names: lockCtx.names, date: lockCtx.date, studio: brand?.name }), [lockCtx, brand?.name]);
  const handle = useMemo(() => {
    const h = fold(lockCtx.names ?? "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
    return h.length >= 2 ? h.slice(0, 24) : "chungminh";
  }, [lockCtx.names]);

  /** Thêm slide cuối "Xem cả album" của studio vào bộ vừa dựng (nếu studio bật). */
  const withEnd = (d: CollageDoc, ins: Map<string, LayoutInput>): CollageDoc => {
    if (!endUrl || !brand || !d.pages.length || d.pages.some(isEndPage) || d.pages.length >= COLLAGE_LIMITS.pages) return d;
    const coverId = heroPhoto(d.pages[0].frames) ?? d.photoIds[0];
    const cover = coverId ? ins.get(coverId) : undefined;
    if (!cover) return d;
    const st = styleById(d.pages[0].styleId);
    return { ...d, pages: [...d.pages, makeEndPage({ formatId: d.formatId, style: st, cover, url: endUrl, studioName: brand.name, ctx: lockCtx })] };
  };
  const inputs = useMemo(() => buildInputs(aspects), [buildInputs, aspects]);

  /** Đo tỉ lệ các ảnh chưa đo (đọc kích thước ảnh nhỏ — không cần byte ảnh qua máy chủ). */
  const ensureInputs = useCallback(
    async (ids: string[]) => {
      const missing = [...new Set(ids)].filter((id) => !aspectsRef.current[id] && driveIdOf.has(id));
      if (missing.length) {
        const vals = await Promise.all(
          missing.map(
            (id) =>
              new Promise<number>((resolve) => {
                const im = new Image();
                let done = false;
                const fin = (v: number) => {
                  if (done) return;
                  done = true;
                  resolve(v);
                };
                im.onload = () => fin(im.naturalWidth > 0 && im.naturalHeight > 0 ? im.naturalWidth / im.naturalHeight : 1.5);
                im.onerror = () => fin(1.5);
                setTimeout(() => fin(1.5), 8000);
                im.src = img.thumb(driveIdOf.get(id)!, 400);
              }),
          ),
        );
        const next = { ...aspectsRef.current };
        missing.forEach((id, i) => (next[id] = vals[i]));
        aspectsRef.current = next;
        setAspects(next);
      }
      return buildInputs(aspectsRef.current);
    },
    [driveIdOf, img, buildInputs],
  );

  /* ── Lưu (tự động, giữ 1 ngày) ── */
  const saveNow = useCallback(async () => {
    if (!docRef.current) return;
    if (saving.current) {
      savePending.current = true;
      return;
    }
    saving.current = true;
    dirty.current = false;
    setSave((s) => ({ ...s, state: "saving" }));
    const d = docRef.current;
    try {
      const title = `Bộ ảnh ghép ${fmtDateTime(new Date())}`;
      const r = await saveSet(credRef.current, { id: setIdRef.current, title, doc: d });
      setIdRef.current = r.id;
      saveFails.current = 0;
      setSave({ state: "saved", expiresAt: r.expiresAt });
    } catch (e) {
      dirty.current = true;
      if (e instanceof CollageApiError && e.code === "need_verify") {
        props.onNeedVerify();
        return;
      }
      const transient = isTransient(e);
      setSave({ state: "error", msg: !transient && e instanceof CollageApiError && e.code !== "save_failed" ? errorText(e) : "Chưa lưu được — sửa tiếp là máy thử lại" });
      // Mạng chập chờn / máy chủ chậm: tự thử lại vài lần, kể cả khi khách đã ngừng tay.
      if (transient && ++saveFails.current <= SAVE_RETRIES && !saveTimer.current) {
        saveTimer.current = setTimeout(() => {
          saveTimer.current = null;
          void saveNow();
        }, SAVE_RETRY_MS);
      }
    } finally {
      saving.current = false;
      if (savePending.current) {
        savePending.current = false;
        void saveNow();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSave = useCallback(
    (delay = SAVE_DELAY) => {
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void saveNow();
      }, delay);
    },
    [saveNow],
  );

  /** Đóng / rời trang khi còn thay đổi chưa lưu: gửi ngay (sendBeacon sống sót cả khi tắt tab). */
  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirty.current || !docRef.current) return;
    dirty.current = false;
    const c = credRef.current;
    const body = JSON.stringify({ id: setIdRef.current, title: `Bộ ảnh ghép ${fmtDateTime(new Date())}`, doc: docRef.current, key: c.key, access: c.access });
    try {
      if (navigator.sendBeacon?.(`/api/album/${c.slug}/collage`, new Blob([body], { type: "application/json" }))) return;
    } catch {
      /* rơi xuống fetch */
    }
    void fetch(`/api/album/${c.slug}/collage`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, []);

  useEffect(() => {
    const onHide = () => flushSave();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flushSave();
    };
  }, [flushSave]);

  /* ── Sửa bộ layout (có hoàn tác) ── */
  const setDocState = useCallback((next: CollageDoc | null) => {
    docRef.current = next;
    setDoc(next);
  }, []);
  const apply = useCallback(
    (fn: (d: CollageDoc) => CollageDoc, history = true) => {
      const cur = docRef.current;
      if (!cur) return;
      if (history) {
        pastRef.current.push(cur);
        if (pastRef.current.length > HISTORY_MAX) pastRef.current.shift();
        setCanUndo(true);
      }
      // Đọc tỉ lệ từ ref (không phải bản dựng lần trước): ảnh vừa đo xong
      // trong cùng thao tác (thêm ảnh từ album) cũng có ngay.
      setDocState(fillAspects(fn(cur), aspectsRef.current));
      scheduleSave();
    },
    [scheduleSave, setDocState],
  );
  const checkpoint = useCallback(() => {
    const cur = docRef.current;
    if (!cur) return;
    pastRef.current.push(cur);
    if (pastRef.current.length > HISTORY_MAX) pastRef.current.shift();
    setCanUndo(true);
  }, []);
  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    setCanUndo(pastRef.current.length > 0);
    if (!prev) return;
    setDocState(prev);
    setPageIdx((i) => Math.min(i, prev.pages.length - 1));
    scheduleSave();
  }, [scheduleSave, setDocState]);

  /* ── Nạp ảnh + bộ đã lưu ──
     Hai lượt gọi song song, lượt nào cũng có hạn giờ (api.ts). Danh sách ảnh có
     sẵn trên trang album (galleryList), nên máy chủ chậm / lỗi TẠM THỜI thì màn
     ghép vẫn chạy — chỉ thiếu nhóm gợi ý theo khuôn mặt, tới sau thì tự hiện. Mở
     lâu quá SLOW_MS thì khách được bấm "Mở luôn". Chỉ lỗi quyền / cấu hình (album
     tắt ghép ảnh, phiên mật khẩu hết hạn…) mới dừng ở màn lỗi, kèm mã lỗi ngắn. */
  const applyPhotos = useCallback((r: PhotosPayload) => {
    setServerPhotos(r.photos);
    setCats(r.cats);
    setInfo(r.info);
  }, []);

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    const live = () => gen === loadGen.current;
    setStep("loading");
    setError(null);
    setErrCode(null);
    setSlow(false);
    const slowTimer = setTimeout(() => live() && setSlow(true), SLOW_MS);
    const c = credRef.current;
    const asError = (e: unknown) => (e instanceof CollageApiError ? e : new CollageApiError("network"));
    const photosP: Promise<PhotosPayload | CollageApiError> = fetchPhotos(c).then((r) => {
      if (live()) applyPhotos(r);
      return r;
    }, asError);
    const setsP: Promise<SavedSet[] | CollageApiError> = fetchSets(c).catch(asError);
    const skipP = new Promise<"skip">((res) => {
      skipRef.current = () => res("skip");
    });
    const [setsR, photosR] = await Promise.all([Promise.race([setsP, skipP]), Promise.race([photosP, skipP])]);
    clearTimeout(slowTimer);
    skipRef.current = null;
    if (!live()) return;

    const needVerify = (r: unknown) => r instanceof CollageApiError && r.code === "need_verify";
    // Khách bấm "Mở luôn": phần tới muộn vẫn được dùng khi tới.
    if (photosR === "skip") {
      void photosP.then((r) => {
        if (live() && needVerify(r)) props.onNeedVerify();
      });
    }
    if (setsR === "skip") {
      void setsP.then((r) => {
        if (!live()) return;
        if (needVerify(r)) props.onNeedVerify();
        else if (Array.isArray(r) && r.length) {
          setSets(r);
          toast.show(`Bạn có ${r.length} bộ ảnh ghép đã lưu — bấm ← để mở lại.`);
        }
      });
    }

    if (needVerify(setsR) || needVerify(photosR)) {
      props.onNeedVerify();
      return;
    }
    const hard = [photosR, setsR].find((r): r is CollageApiError => r instanceof CollageApiError && !isTransient(r));
    const photosFailed = photosR instanceof CollageApiError;
    const noPhotos = photosR !== "skip" && photosFailed && !galleryRef.current.length;
    if (hard || noPhotos) {
      const e = hard ?? (photosR as CollageApiError);
      setError(errorText(e));
      setErrCode(errorCode(e));
      setStep("error");
      return;
    }
    const list = Array.isArray(setsR) ? setsR : [];
    setSets(list);
    if (photosFailed) toast.show("Chưa tải được gợi ý ảnh đẹp — bạn vẫn chọn ảnh trong album bình thường.");
    else if (setsR instanceof CollageApiError) toast.show("Chưa mở được các bộ ảnh ghép đã lưu — bạn thử lại sau ít phút.");
    setStep(list.length ? "sets" : "pick");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const gens = loadGen;
    return () => {
      // Đóng màn ghép giữa lúc đang nạp: kết quả tới muộn không được mở hộp SĐT.
      gens.current++;
      document.body.style.overflow = prev;
    };
  }, [load]);

  /* ── Phông chữ: chỉ nạp đúng phông bộ đang mở / các bộ đã lưu dùng tới ── */
  const fontKeys = useMemo(() => {
    const keys = new Set<string>();
    if (doc) docFontKeys(doc).forEach((k) => keys.add(k));
    for (const x of sets) docFontKeys(x.data).forEach((k) => keys.add(k));
    return [...keys].sort().join(",");
  }, [doc, sets]);
  useEffect(() => {
    if (!fontKeys) return;
    let alive = true;
    void loadCollageFonts(fontKeys.split(",")).then((fresh) => {
      if (fresh && alive) setFontsReady((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [fontKeys]);

  /* ── Nút quay lại của điện thoại: lùi một bước trong màn ghép, không rời album ── */
  const backRef = useRef<() => boolean>(() => false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  useEffect(() => {
    window.history.pushState({ mstudoCollage: 1 }, "");
    const onPop = () => {
      if (closingRef.current) return;
      if (backRef.current()) window.history.pushState({ mstudoCollage: 1 }, "");
      else {
        closingRef.current = true;
        flushSave();
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [flushSave]);
  const close = () => {
    closingRef.current = true;
    flushSave();
    if ((window.history.state as { mstudoCollage?: number } | null)?.mstudoCollage) window.history.back();
    props.onClose();
  };

  /* ── Các bước ── */
  /** Đổi cách ghép: ảnh đã chọn đi theo (tự động → chia sẵn thành các layout; tự chọn → gộp lại). */
  const setMode = (m: PickMode) => {
    if (m === mode) return;
    if (m === "manual") {
      if (selected.length && !manualIds.length) {
        const per = typeof opts.perPage === "number" ? opts.perPage : 4;
        const gs: string[][] = [];
        for (let i = 0; i < selected.length; i += per) gs.push(selected.slice(i, i + per));
        setGroups(gs.slice(0, COLLAGE_LIMITS.pages));
        setActiveGroup(0);
      }
    } else if (manualIds.length) {
      setSelected(manualIds.slice(0, COLLAGE_LIMITS.photos));
    }
    setModeState(m);
  };
  /** Nạp lại chế độ + nhóm ảnh từ một bộ layout (mở bộ đã lưu, quay lại tuỳ chọn). */
  const syncPick = (d: CollageDoc) => {
    setSelected(d.photoIds.filter((id) => driveIdOf.has(id)));
    if (d.mode === "manual") {
      const gs = d.pages.map((pg) => pagePhotoIds(pg).filter((id) => driveIdOf.has(id))).filter((g) => g.length);
      setGroups(gs.length ? gs : [[]]);
      setActiveGroup(0);
      setModeState("manual");
    } else {
      setModeState("auto");
    }
  };
  const openSet = (s: SavedSet) => {
    const d = s.data;
    setIdRef.current = s.id;
    pastRef.current = [];
    setCanUndo(false);
    aspectsRef.current = { ...aspectsRef.current, ...d.aspects };
    setAspects(aspectsRef.current);
    syncPick(d);
    setOpts((o) => ({ ...o, formatId: d.formatId, perPage: d.perPage, styleId: d.styleId, texts: d.texts.length ? d.texts : [""], carousel: carouselOf(d) }));
    setDocState(d);
    setPageIdx(0);
    setSave({ state: "saved", expiresAt: s.expires_at });
    setStep("overview");
  };
  const newSet = () => {
    setIdRef.current = null;
    pastRef.current = [];
    setCanUndo(false);
    setDocState(null);
    setSelected([]);
    setGroups([[]]);
    setActiveGroup(0);
    setOpts(DEFAULT_OPTS);
    setSave({ state: "idle" });
    setStep("pick");
  };
  const removeSet = async (s: SavedSet) => {
    if (!confirm("Xoá bộ ảnh ghép này? Ảnh đã tải về máy không bị ảnh hưởng.")) return;
    setDeleting(s.id);
    try {
      await deleteSet(credRef.current, s.id);
      const rest = sets.filter((x) => x.id !== s.id);
      setSets(rest);
      if (setIdRef.current === s.id) setIdRef.current = null;
      if (!rest.length) newSet();
    } catch (e) {
      toast.show(errorText(e));
    } finally {
      setDeleting(null);
    }
  };
  const backToSets = async () => {
    flushSave();
    try {
      const list = await fetchSets(credRef.current);
      setSets(list);
      if (list.length) {
        setStep("sets");
        return;
      }
    } catch {
      /* mạng lỗi → đóng hẳn */
    }
    close();
  };

  const generate = async (seed = Math.floor(Math.random() * 1e9)) => {
    const manual = mode === "manual";
    const ids = manual ? manualIds : selected;
    if (!ids.length) return;
    setBusy(true);
    try {
      // "Màu theo ảnh": đọc màu các ảnh trước khi dàn (nền từng trang theo ảnh chính).
      if (opts.styleId === "palette") await paletteFor(ids);
      const ins = await ensureInputs(ids);
      const photosIn = ids.map((id) => ins.get(id)).filter((x): x is LayoutInput => !!x);
      const next = generateDoc({
        photos: photosIn,
        perPage: opts.perPage,
        formatId: opts.formatId,
        styleId: opts.styleId,
        texts: opts.texts,
        seed,
        lockup: opts.lockup,
        ctx: lockCtx,
        ...(opts.carousel >= 2 ? { carousel: opts.carousel } : {}),
        ...(manual ? { groups: groups.filter((g) => g.length) } : {}),
      });
      const full = withEnd(next, ins);
      if (docRef.current) {
        pastRef.current.push(docRef.current);
        setCanUndo(true);
      }
      setDocState(fillAspects(full, aspectsRef.current));
      setPageIdx(0);
      setStep("overview");
      scheduleSave(150);
    } finally {
      setBusy(false);
    }
  };

  /** Bộ kể chuyện một chạm: máy chọn ảnh theo trình tự ngày cưới và ghép luôn (bộ mới). */
  const story = async () => {
    if (storyBusy) return;
    setStoryBusy(true);
    try {
      const chapters = storyChapters(photos.map((p) => p.id), { cats, info }, hearts);
      const gs = chapters.map((c) => c.ids).filter((g) => g.length);
      const ids = [...new Set(gs.flat())];
      if (!ids.length) return;
      if (opts.styleId === "palette") await paletteFor(ids);
      const ins = await ensureInputs(ids);
      const photosIn = ids.map((id) => ins.get(id)).filter((x): x is LayoutInput => !!x);
      const cover = (lockCtx.names ?? "").trim() || props.albumTitle.trim().slice(0, 60) || "Ngày chung đôi";
      const pageTexts = chapters
        .filter((c) => c.ids.length)
        .map((c) => (c.key === "cover" ? { text: cover, lockup: "our-day" } : c.key === "thanks" ? { text: "Cảm ơn mọi người đã đến chung vui cùng chúng mình", lockup: "thank-you" } : null));
      const next = generateDoc({
        photos: photosIn,
        perPage: 4,
        formatId: opts.formatId,
        styleId: opts.styleId,
        texts: [],
        seed: Math.floor(Math.random() * 1e9),
        lockup: opts.lockup,
        ctx: lockCtx,
        groups: gs,
        pageTexts,
      });
      const full = withEnd(next, ins);
      setGroups(gs);
      setActiveGroup(0);
      setModeState("manual");
      setSelected(ids);
      if (docRef.current) {
        pastRef.current.push(docRef.current);
        setCanUndo(true);
      }
      setIdRef.current = null;
      setDocState(fillAspects(full, aspectsRef.current));
      setPageIdx(0);
      setStep("overview");
      scheduleSave(150);
      toast.show(`Đã ghép bộ kể chuyện ${full.pages.length} layout — chạm từng layout để sửa.`);
    } finally {
      setStoryBusy(false);
    }
  };
  const reshuffle = async () => {
    const d = docRef.current;
    if (!d) return;
    // Giữ nội dung chữ khách đã sửa trên các trang; chia lại ngẫu nhiên.
    const texts = collectTexts(d);
    setOpts((o) => ({ ...o, texts: texts.length ? texts : o.texts }));
    setBusy(true);
    try {
      // Bộ tự chọn từng layout: giữ nguyên nhóm ảnh của từng trang, chỉ đổi bố cục.
      const manualGroups = d.mode === "manual" ? d.pages.filter((pg) => !isEndPage(pg)).map(pagePhotoIds).filter((g) => g.length) : null;
      const ids = manualGroups ? [...new Set(manualGroups.flat())] : d.photoIds;
      if (d.styleId === "palette") await paletteFor(ids);
      const ins = await ensureInputs(ids);
      const photosIn = ids.map((id) => ins.get(id)).filter((x): x is LayoutInput => !!x);
      const slides = carouselOf(d);
      const next = generateDoc({
        photos: photosIn,
        perPage: d.perPage,
        formatId: d.formatId,
        styleId: d.styleId,
        texts: texts.length ? texts : d.texts,
        seed: Math.floor(Math.random() * 1e9),
        lockup: opts.lockup,
        ctx: lockCtx,
        ...(slides ? { carousel: slides } : {}),
        ...(manualGroups && !slides ? { groups: manualGroups } : {}),
      });
      const full = withEnd({ ...next, ...(d.filter ? { filter: d.filter } : {}) }, ins);
      apply(() => full);
      toast.show("Đã ghép lại ngẫu nhiên — bấm ↶ ở màn sửa để quay lại bản trước.");
    } finally {
      setBusy(false);
    }
  };

  /* Nút quay lại (giao diện và điện thoại dùng chung). true = còn ở trong màn ghép. */
  backRef.current = () => {
    if (exportOpen || previewOpen || videoOpen) {
      setExportOpen(false);
      setPreviewOpen(false);
      setVideoOpen(false);
      return true;
    }
    if (step === "edit") {
      setStep("overview");
      return true;
    }
    if (step === "options") {
      setStep("pick");
      return true;
    }
    if (step === "pick" && (doc || sets.length)) {
      setStep(doc ? "options" : "sets");
      return true;
    }
    if (step === "overview") {
      void backToSets();
      return true;
    }
    return false;
  };
  const uiBack = () => {
    if (!backRef.current()) close();
  };

  const ideas = useMemo(() => {
    const out = ["Just married", "Chúng mình cưới rồi! 💍", "Thank you for coming", "Hạnh phúc là được ở bên nhau", "Save the date"];
    const t = props.albumTitle.trim();
    if (t && t.length <= 40) out.unshift(t);
    if (props.eventDate) out.splice(1, 0, fmtDate(props.eventDate).replace(/\//g, "."));
    return out.slice(0, 7);
  }, [props.albumTitle, props.eventDate]);

  let body: React.ReactNode;
  if (step === "loading") {
    body = (
      <>
        <StudioHeader title="Ghép ảnh" onBack={close} close backLabel="Đóng" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex items-center gap-2 text-[14px]" style={{ color: "var(--tx3)" }}>
            <LoaderCircle size={18} className="animate-spin" /> Đang mở album…
          </span>
          {slow ? (
            <>
              <p className="max-w-[340px] text-[13px]" style={{ color: "var(--tx3)" }}>
                Album nhiều ảnh nên máy cần thêm chút thời gian để tìm những tấm đẹp nhất.
              </p>
              {galleryList.length ? (
                <button type="button" onClick={() => skipRef.current?.()} className={btn("secondary", "md")}>
                  Mở luôn, gợi ý tới sau
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </>
    );
  } else if (step === "error") {
    body = (
      <>
        <StudioHeader title="Ghép ảnh" onBack={close} close backLabel="Đóng" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <TriangleAlert size={26} style={{ color: "var(--am)" }} />
          <p className="max-w-[360px] text-[14px]" style={{ color: "var(--tx2)" }}>
            {error}
          </p>
          <button type="button" onClick={() => void load()} className={btn("secondary", "md")}>
            Thử lại
          </button>
          {errCode ? (
            <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Mã lỗi: {errCode}
            </p>
          ) : null}
        </div>
      </>
    );
  } else if (step === "sets") {
    body = <SetsStep sets={sets} img={img.thumb} driveOf={driveOf} fontsReady={fontsReady} onClose={close} onOpen={openSet} onDelete={removeSet} onNew={newSet} busyId={deleting} />;
  } else if (step === "pick") {
    body = (
      <PickStep
        photos={photos}
        cats={cats}
        info={info}
        selected={selected}
        setSelected={setSelected}
        mode={mode}
        setMode={setMode}
        groups={groups}
        setGroups={setGroups}
        active={Math.min(activeGroup, groups.length - 1)}
        setActive={setActiveGroup}
        hearts={hearts}
        people={people}
        driveIdOf={driveIdOf}
        img={img.thumb}
        onBack={uiBack}
        backIsClose={!doc && !sets.length}
        onNext={() => {
          setStep("options");
          void ensureInputs(mode === "manual" ? manualIds : selected);
        }}
        toast={toast.show}
        onStory={() => void story()}
        storyBusy={storyBusy}
      />
    );
  } else if (step === "options") {
    body = (
      <OptionsStep
        count={mode === "manual" ? manualIds.length : selected.length}
        manualPages={mode === "manual" ? manualPages : null}
        opts={opts}
        setOpts={setOpts}
        ideas={ideas}
        busy={busy}
        onBack={uiBack}
        onGenerate={() => void generate()}
      />
    );
  } else if (step === "overview" && doc) {
    body = (
      <OverviewStep
        doc={doc}
        img={img.thumb}
        driveOf={driveOf}
        fontsReady={fontsReady}
        watermark={watermark}
        save={save}
        busy={busy}
        onClose={uiBack}
        onOpenPage={(i) => {
          setPageIdx(i);
          setStep("edit");
        }}
        onShuffle={() => void reshuffle()}
        onOptions={() => {
          setOpts((o) => {
            const texts = collectTexts(doc);
            return { ...o, formatId: doc.formatId, perPage: doc.perPage, styleId: doc.styleId, texts: texts.length ? texts : o.texts, carousel: carouselOf(doc) };
          });
          syncPick(doc);
          setStep("options");
        }}
        onExport={() => setExportOpen(true)}
        sign={viewSign}
        lockColor={!!brand?.lockColor}
        onFilter={(id) =>
          apply((d) => {
            const n = { ...d };
            if (id === "none") delete n.filter;
            else n.filter = id;
            return n;
          })
        }
        onPreview={() => setPreviewOpen(true)}
        onVideo={() => setVideoOpen(true)}
      />
    );
  } else if (step === "edit" && doc) {
    body = (
      <EditorStep
        doc={doc}
        pageIdx={Math.min(pageIdx, doc.pages.length - 1)}
        setPageIdx={setPageIdx}
        photos={photos}
        cats={cats}
        info={info}
        people={people}
        driveIdOf={driveIdOf}
        inputs={inputs}
        ensureInputs={ensureInputs}
        img={img.thumb}
        driveOf={driveOf}
        fontsReady={fontsReady}
        watermark={watermark}
        save={save}
        apply={apply}
        checkpoint={checkpoint}
        undo={undo}
        canUndo={canUndo}
        onBack={uiBack}
        onExport={() => setExportOpen(true)}
        toast={toast.show}
        lockCtx={lockCtx}
        paletteFor={paletteFor}
        sign={viewSign}
        onPreview={() => setPreviewOpen(true)}
      />
    );
  }

  return (
    <div
      className="client-doc ui-v2 fixed inset-0 z-[90] flex flex-col"
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label="Ghép ảnh đăng mạng xã hội"
      style={{ background: "var(--bg)", color: "var(--tx)", height: "100dvh" }}
    >
      {body}
      {exportOpen && doc ? (
        <ExportSheet
          doc={doc}
          pageIdx={Math.min(pageIdx, doc.pages.length - 1)}
          driveOf={driveOf}
          rawSrc={img.raw}
          watermark={watermark}
          baseName={props.albumTitle || "anh-ghep"}
          sign={sign}
          signLogo={logoImg}
          captions={captions}
          onExported={(n) => postEvent(credRef.current, "export", n, docSummary(doc))}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {previewOpen && doc ? (
        <PostPreview doc={doc} img={img.thumb} driveOf={driveOf} fontsReady={fontsReady} watermark={watermark} sign={viewSign} handle={handle} caption={captions[0] ?? ""} onClose={() => setPreviewOpen(false)} />
      ) : null}
      {videoOpen && doc ? (
        <VideoSheet
          doc={doc}
          driveOf={driveOf}
          rawSrc={img.raw}
          watermark={watermark}
          sign={sign}
          signLogo={logoImg}
          baseName={props.albumTitle || "anh-ghep"}
          onDone={(seconds, music) => postEvent(credRef.current, "video", 1, { ...docSummary(doc), seconds, music })}
          onClose={() => setVideoOpen(false)}
        />
      ) : null}
      {toast.node}
    </div>
  );
}
