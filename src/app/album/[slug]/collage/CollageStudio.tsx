"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { btn } from "@/components/v2/kit";
import type { CollageDoc, LayoutInput } from "@/lib/collage/types";
import { DEFAULT_FORMAT_ID } from "@/lib/collage/formats";
import { DEFAULT_STYLE_ID } from "@/lib/collage/styles";
import { collectTexts, generateDoc } from "@/lib/collage/generate";
import { loadCollageFonts } from "@/lib/collage/text-layout";
import type { PhotoCat, PhotoInfo } from "@/lib/collage/categories";
import type { PersonChip } from "@/lib/face-people";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { useAlbumImg } from "@/app/a/[slug]/album-v2-ui";
import { CollageApiError, deleteSet, errorText, fetchPhotos, fetchSets, saveSet, type Cred, type PhotoLite, type SavedSet } from "./api";
import PickStep from "./PickStep";
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
  onClose: () => void;
  onNeedVerify: () => void;
}

type Step = "loading" | "error" | "sets" | "pick" | "options" | "overview" | "edit";

const DEFAULT_OPTS: CollageOptions = { formatId: DEFAULT_FORMAT_ID, perPage: 4, styleId: DEFAULT_STYLE_ID, texts: [""] };
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
  const [photos, setPhotos] = useState<PhotoLite[]>([]);
  const [cats, setCats] = useState<PhotoCat[]>([]);
  const [info, setInfo] = useState<Record<string, PhotoInfo>>({});
  const [sets, setSets] = useState<SavedSet[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [opts, setOpts] = useState<CollageOptions>(DEFAULT_OPTS);
  const [doc, setDoc] = useState<CollageDoc | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [fontsReady, setFontsReady] = useState(0);
  const [busy, setBusy] = useState(false);
  const [save, setSave] = useState<SaveStatus>({ state: "idle" });
  const [canUndo, setCanUndo] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const docRef = useRef<CollageDoc | null>(null);
  const setIdRef = useRef<string | null>(null);
  const pastRef = useRef<CollageDoc[]>([]);
  const aspectsRef = useRef<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const savePending = useRef(false);
  const dirty = useRef(false);
  const credRef = useRef(cred);
  credRef.current = cred;

  /* ── Ảnh: id → drive id, và đầu vào cho bộ dàn trang ── */
  const driveIdOf = useMemo(() => new Map(photos.map((p) => [p.id, p.d])), [photos]);
  const driveOf = useCallback((id: string) => driveIdOf.get(id), [driveIdOf]);
  const buildInputs = useCallback(
    (asp: Record<string, number>) => {
      const m = new Map<string, LayoutInput>();
      for (const p of photos) {
        const a = asp[p.id];
        if (!a) continue;
        const it = info[p.id];
        m.set(p.id, { id: p.id, aspect: a, score: (it?.score ?? 5) + (hearts.has(p.id) ? 3 : 0), hero: !!it?.hero, faces: it?.faces ?? [] });
      }
      return m;
    },
    [photos, info, hearts],
  );
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
      setSave({ state: "saved", expiresAt: r.expiresAt });
    } catch (e) {
      dirty.current = true;
      if (e instanceof CollageApiError && e.code === "need_verify") {
        props.onNeedVerify();
        return;
      }
      setSave({ state: "error", msg: e instanceof CollageApiError && e.code !== "save_failed" ? errorText(e) : "Chưa lưu được — sửa tiếp là máy thử lại" });
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

  /* ── Nạp ảnh + bộ đã lưu ── */
  const load = useCallback(async () => {
    setStep("loading");
    setError(null);
    try {
      const [ph, list] = await Promise.all([fetchPhotos(credRef.current), fetchSets(credRef.current)]);
      setPhotos(ph.photos);
      setCats(ph.cats);
      setInfo(ph.info);
      setSets(list);
      setStep(list.length ? "sets" : "pick");
    } catch (e) {
      if (e instanceof CollageApiError && e.code === "need_verify") {
        props.onNeedVerify();
        return;
      }
      setError(errorText(e));
      setStep("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    let alive = true;
    void loadCollageFonts().then(() => alive && setFontsReady((n) => n + 1));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      document.body.style.overflow = prev;
    };
  }, [load]);

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
  const openSet = (s: SavedSet) => {
    const d = s.data;
    setIdRef.current = s.id;
    pastRef.current = [];
    setCanUndo(false);
    aspectsRef.current = { ...aspectsRef.current, ...d.aspects };
    setAspects(aspectsRef.current);
    setSelected(d.photoIds.filter((id) => driveIdOf.has(id)));
    setOpts({ formatId: d.formatId, perPage: d.perPage, styleId: d.styleId, texts: d.texts.length ? d.texts : [""] });
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
    if (!selected.length) return;
    setBusy(true);
    try {
      const ins = await ensureInputs(selected);
      const photosIn = selected.map((id) => ins.get(id)).filter((x): x is LayoutInput => !!x);
      const next = generateDoc({ photos: photosIn, perPage: opts.perPage, formatId: opts.formatId, styleId: opts.styleId, texts: opts.texts, seed });
      if (docRef.current) {
        pastRef.current.push(docRef.current);
        setCanUndo(true);
      }
      setDocState(fillAspects(next, aspectsRef.current));
      setPageIdx(0);
      setStep("overview");
      scheduleSave(150);
    } finally {
      setBusy(false);
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
      const ins = await ensureInputs(d.photoIds);
      const photosIn = d.photoIds.map((id) => ins.get(id)).filter((x): x is LayoutInput => !!x);
      const next = generateDoc({ photos: photosIn, perPage: d.perPage, formatId: d.formatId, styleId: d.styleId, texts: texts.length ? texts : d.texts, seed: Math.floor(Math.random() * 1e9) });
      apply(() => next);
      toast.show("Đã ghép lại ngẫu nhiên — bấm ↶ ở màn sửa để quay lại bản trước.");
    } finally {
      setBusy(false);
    }
  };

  /* Nút quay lại (giao diện và điện thoại dùng chung). true = còn ở trong màn ghép. */
  backRef.current = () => {
    if (exportOpen) {
      setExportOpen(false);
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
        <div className="flex flex-1 items-center justify-center gap-2 text-[14px]" style={{ color: "var(--tx3)" }}>
          <LoaderCircle size={18} className="animate-spin" /> Đang mở album…
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
        hearts={hearts}
        people={people}
        driveIdOf={driveIdOf}
        img={img.thumb}
        onBack={uiBack}
        backIsClose={!doc && !sets.length}
        onNext={() => {
          setStep("options");
          void ensureInputs(selected);
        }}
        toast={toast.show}
      />
    );
  } else if (step === "options") {
    body = <OptionsStep count={selected.length} opts={opts} setOpts={setOpts} ideas={ideas} busy={busy} onBack={uiBack} onGenerate={() => void generate()} />;
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
            return { ...o, formatId: doc.formatId, perPage: doc.perPage, styleId: doc.styleId, texts: texts.length ? texts : o.texts };
          });
          setSelected(doc.photoIds.filter((id) => driveIdOf.has(id)));
          setStep("options");
        }}
        onExport={() => setExportOpen(true)}
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
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {toast.node}
    </div>
  );
}
