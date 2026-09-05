"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScanFace, Pause, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { thumbnailUrl } from "@/lib/drive";
import { chunk as splitRows } from "@/lib/photos";
import { faceCrop, NAME_MAX, nameProblems } from "@/lib/face-people";
import {
  centroid,
  groupFaces,
  matchKnown,
  type FaceVector,
  type KnownPerson,
  type Person,
} from "@/lib/face-group";
import {
  CHUNK,
  PER_VISIT,
  chunks,
  pending,
  shouldCluster,
  stateOf,
  type ScanPhoto,
  type StoredFace,
} from "@/lib/face-auto";

/**
 * GOM KHUÔN MẶT TỰ ĐỘNG cho một album.
 *
 * Studio không bấm gì: mở màn album là chạy nền, xong thì khách mở link tìm được
 * theo khuôn mặt ngay. Không tick, không nút Quét, không bước Lưu.
 *
 * ĐIỀU PHẢI NÓI THẲNG: mô hình chạy trên MÁY STUDIO, trong tab đang mở. Không có
 * cách nào vừa miễn phí, vừa không cần máy studio, vừa không bắt điện thoại khách
 * tải 26 MB. Nên lượt quét được thiết kế để chịu được cắt ngang: mỗi mẻ ghi ngay
 * xuống `album_faces`, đóng tab rồi mở lại là chạy tiếp từ chỗ dừng.
 *
 * Luật ở @/lib/face-auto (npm run test:face-auto). Bảng ở
 * supabase/migrations/album_faces.sql.
 */

type SavedPerson = { id: string; name: string; cover_photo_id: string | null; cover_box: number[] | null; count: number };

/** Tắt trên MÁY NÀY — lưu ở localStorage, không phải thiết lập của album. */
const offKey = (albumId: string) => `mstudo.face-auto.off.${albumId}`;

export default function AlbumFaceAuto({ albumId }: { albumId: string }) {
  const supabase = useRef(createClient()).current;
  const [photos, setPhotos] = useState<ScanPhoto[]>([]);
  const [saved, setSaved] = useState<SavedPerson[]>([]);
  const [running, setRunning] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const [ready, setReady] = useState(false);
  /** Đã đọc xong danh sách ảnh lần đầu chưa. */
  const [loaded, setLoaded] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [savingNames, setSavingNames] = useState(false);
  /** Chặn chạy hai lần: StrictMode gắn effect hai lượt ở bản dev. */
  const busy = useRef(false);
  const stop = useRef(false);

  useEffect(() => {
    try {
      setOff(window.localStorage.getItem(offKey(albumId)) === "1");
    } catch {
      /* trình duyệt chặn localStorage — coi như đang bật */
    }
    setReady(true);
  }, [albumId]);

  const reload = useCallback(async () => {
    // try/catch, KHÔNG chỉ đọc `error` của từng câu: mất mạng hay sai địa chỉ thì
    // supabase-js NÉM, và `Promise.all` ném theo. Không bắt thì `void reload()`
    // nuốt mất, danh sách ảnh ở nguyên mảng rỗng, và màn hình báo "chưa có ảnh".
    try {
    const [{ data: ph, error: phErr }, { data: ppl }, { data: links }] = await Promise.all([
      // `select("*")`: `faces_scanned_at` là cột THÊM SAU. Liệt kê tên nó ra thì
      // trên database chưa chạy migration, câu này lỗi và `data` là null — rồi
      // màn hình báo "Chưa có ảnh nào trong album", tức là NÓI SAI về một thứ
      // studio nhìn thấy tận mắt là có. Lấy `*` thì cột thiếu chỉ là undefined.
      supabase.from("photos").select("*").eq("album_id", albumId).order("position"),
      // Cũng vậy với cover_box — xem ghi chú ở trang khách.
      supabase.from("album_people").select("*").eq("album_id", albumId).order("position"),
      supabase.from("album_photo_people").select("person_id").eq("album_id", albumId),
    ]);
    if (phErr) throw new Error(phErr.message);
    setPhotos((ph ?? []) as ScanPhoto[]);
    const n = new Map<string, number>();
    for (const l of links ?? []) n.set(l.person_id, (n.get(l.person_id) ?? 0) + 1);
    setSaved(
      (ppl ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? "",
        cover_photo_id: p.cover_photo_id ?? null,
        cover_box: (p.cover_box as number[] | null) ?? null,
        count: n.get(p.id) ?? 0,
      }))
    );
    setErr(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(
        /album_faces|faces_scanned_at|does not exist|schema cache/i.test(m)
          ? "Chưa có bảng cho tính năng này. Hãy chạy supabase/cap-nhat.sql trong Supabase SQL Editor rồi mở lại màn này."
          : `Không đọc được dữ liệu album: ${m}`
      );
    } finally {
      setLoaded(true);
    }
  }, [supabase, albumId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Gom nhóm từ TOÀN BỘ kho khuôn mặt rồi ghi đè bảng người. */
  const cluster = useCallback(async () => {
    setClustering(true);
    try {
      const faces: StoredFace[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("album_faces")
          .select("photo_id, at, box, descriptor, sharpness")
          .eq("album_id", albumId)
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        faces.push(...(data as StoredFace[]));
        if (data.length < 1000) break;
      }
      if (faces.length === 0) return;

      const vecs: FaceVector[] = faces.map((f) => ({
        key: f.photo_id,
        at: f.at,
        v: f.descriptor,
        area: f.box[2] * f.box[3],
        sharpness: f.sharpness,
        box: { x: f.box[0], y: f.box[1], w: f.box[2], h: f.box[3] },
      }));
      const people: Person[] = groupFaces(vecs).people;

      // Giữ lại TÊN studio đã đặt: ghép nhóm mới với người cũ theo tâm cụm.
      const { data: old } = await supabase.from("album_people").select("*").eq("album_id", albumId);
      const known: KnownPerson[] = (old ?? []).map((k) => ({
        id: k.id,
        name: k.name ?? "",
        descriptor: (k.descriptor as number[] | null) ?? [],
      }));
      const centroids = people.map((p) => ({
        id: p.id,
        descriptor: centroid(p.faceIdx.map((i) => vecs[i].v)),
      }));
      const matches = matchKnown(centroids, known);

      // Dựng lại từ đầu chứ không vá từng dòng: lượt gom này là sự thật mới
      // nhất, và xoá theo album thì các dòng nối tự đi theo (on delete cascade).
      await supabase.from("album_people").delete().eq("album_id", albumId);

      for (const [i, p] of people.entries()) {
        const b = p.coverBox;
        const { data: row, error } = await supabase
          .from("album_people")
          .insert({
            album_id: albumId,
            name: matches[i]?.name ?? "",
            face_count: p.faces,
            cover_photo_id: p.coverKey || null,
            cover_at: p.coverAt,
            cover_box: b ? [b.x, b.y, b.w, b.h] : null,
            descriptor: centroids[i].descriptor,
            position: i,
          })
          .select("id")
          .single();
        if (error) throw error;
        for (const part of splitRows(p.photoKeys, 500)) {
          const { error: e2 } = await supabase
            .from("album_photo_people")
            .insert(part.map((photo_id) => ({ album_id: albumId, person_id: row.id as string, photo_id })));
          if (e2) throw e2;
        }
      }
      await reload();
    } finally {
      setClustering(false);
    }
  }, [supabase, albumId, reload]);

  /** Quét những tấm chưa quét, ghi từng mẻ. */
  const scan = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    stop.current = false;
    setErr(null);
    try {
      const todo = pending(photos).slice(0, PER_VISIT);
      if (todo.length > 0) {
        setRunning(true);
        const [{ loadFaceModel, detectFull, faceScanSupported }, { loadRecognizer, embedFace, faceEmbedSupported }] =
          await Promise.all([import("@/lib/face-detect"), import("@/lib/face-embed")]);
        if (!faceScanSupported() || !faceEmbedSupported()) {
          setErr("Trình duyệt này không chạy được bộ nhận diện khuôn mặt.");
          return;
        }
        const [det, rec] = await Promise.all([loadFaceModel(), loadRecognizer()]);

        for (const mẻ of chunks(todo, CHUNK)) {
          if (stop.current) break;
          const rows: Record<string, unknown>[] = [];
          const doneIds: string[] = [];
          for (const p of mẻ) {
            if (stop.current) break;
            try {
              const full = await detectFull(
                det,
                { key: p.id, name: p.name, url: thumbnailUrl(p.drive_file_id, 800) },
                0
              );
              for (let k = 0; k < full.landmarks.length; k++) {
                const face = full.metrics.faces[k];
                if (!face) continue;
                const v = await embedFace(rec, full.canvas, full.width, full.height, full.landmarks[k]);
                if (!v) continue;
                rows.push({
                  album_id: albumId,
                  photo_id: p.id,
                  at: k,
                  box: [face.box.x, face.box.y, face.box.w, face.box.h],
                  descriptor: Array.from(v),
                  sharpness: face.sharpness,
                });
              }
              // Đánh dấu đã quét KỂ CẢ khi không thấy mặt nào — nếu không, ảnh
              // cổng hoa sẽ được quét lại mãi mãi và lượt quét không bao giờ xong.
              doneIds.push(p.id);
            } catch {
              // Một tấm hỏng (Drive lỗi, định dạng lạ) không được chặn cả album.
              // KHÔNG đánh dấu đã quét: lần mở sau thử lại.
            }
            // Nhường luồng cho giao diện — studio còn đang làm việc khác.
            await new Promise((r) => setTimeout(r, 0));
          }
          if (rows.length) {
            const { error } = await supabase.from("album_faces").upsert(rows, { onConflict: "photo_id,at" });
            if (error) throw error;
          }
          if (doneIds.length) {
            const { error } = await supabase
              .from("photos")
              .update({ faces_scanned_at: new Date().toISOString() })
              .in("id", doneIds);
            if (error) throw error;
            setPhotos((old) =>
              old.map((x) => (doneIds.includes(x.id) ? { ...x, faces_scanned_at: "now" } : x))
            );
          }
        }
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "Không quét được.";
      // Thiếu bảng/cột của tính năng này là tình huống có thật và có cách sửa rõ
      // ràng. Ném một câu lỗi Postgres thô ra màn hình thì studio không làm gì
      // được với nó.
      setErr(
        /album_faces|faces_scanned_at|does not exist|schema cache/i.test(m)
          ? "Chưa có bảng cho tính năng này. Hãy chạy supabase/cap-nhat.sql trong Supabase SQL Editor rồi mở lại màn này."
          : m
      );
    } finally {
      setRunning(false);
      busy.current = false;
    }
  }, [photos, supabase, albumId]);

  // Tự chạy: đây là toàn bộ điểm của tính năng. Studio không phải bấm gì.
  useEffect(() => {
    if (!ready || off || running || clustering || busy.current) return;
    if (photos.length === 0) return;
    if (pending(photos).length > 0) {
      void scan();
      return;
    }
    if (shouldCluster(photos, saved.length, 1) && saved.length === 0) void cluster();
  }, [ready, off, photos, saved.length, running, clustering, scan, cluster]);

  useEffect(() => () => {
    stop.current = true;
  }, []);

  const st = stateOf({
    photos,
    savedPeople: saved.length,
    running,
    clustering,
    stoppedForNow: false,
    loaded,
    error: err,
  });

  const problems = nameProblems(saved.map((p) => names[p.id] ?? p.name));

  async function saveNames() {
    setSavingNames(true);
    try {
      for (const p of saved) {
        const v = (names[p.id] ?? p.name).trim().slice(0, NAME_MAX);
        if (v === p.name) continue;
        const { error } = await supabase.from("album_people").update({ name: v }).eq("id", p.id);
        if (error) throw error;
      }
      await reload();
      setNames({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không lưu được tên.");
    } finally {
      setSavingNames(false);
    }
  }

  if (!ready) return null;

  const line =
    st.kind === "loading"
      ? "Đang xem album…"
      : st.kind === "empty"
      ? "Chưa có ảnh nào trong album."
      : st.kind === "scanning"
        ? `Đang gom khuôn mặt… ${st.progress.done}/${st.progress.total} ảnh`
        : st.kind === "clustering"
          ? "Đang nhóm các khuôn mặt lại…"
          : st.kind === "paused"
            ? `Tạm dừng ở ${st.progress.done}/${st.progress.total} ảnh — mở lại màn này là chạy tiếp.`
            : st.kind === "done"
              ? `Xong — ${st.people} người. Khách mở album là tìm được theo khuôn mặt.`
              : st.kind === "error"
                ? st.message
                : "Đã quét xong nhưng không thấy khuôn mặt nào trong album này.";

  return (
    <div className="rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf, var(--surface))", border: "1px solid var(--bd, var(--border))" }}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          <ScanFace size={15} style={{ color: "var(--ac, var(--accent))" }} /> Tìm ảnh theo khuôn mặt
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !off;
            setOff(next);
            stop.current = next;
            try {
              window.localStorage.setItem(offKey(albumId), next ? "1" : "0");
            } catch {
              /* không lưu được thì thôi, vẫn đổi trong phiên này */
            }
          }}
          className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px]"
          style={{ border: "1px solid var(--bd, var(--border))", color: "var(--tx2, var(--text2))" }}
        >
          {off ? <Play size={12} /> : <Pause size={12} />} {off ? "Bật lại" : "Tạm dừng"}
        </button>
      </div>

      <p className="mt-1.5 text-[12.5px]" style={{ color: st.kind === "error" ? "#c2410c" : "var(--tx2, var(--text2))" }}>
        {off ? "Đang tắt trên máy này. Bật lại để app tự gom khuôn mặt cho khách tìm." : line}
      </p>

      {(st.kind === "scanning" || st.kind === "paused") && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sf2, var(--surface2))" }}>
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${st.progress.percent}%`, background: "var(--ac, var(--accent))" }}
          />
        </div>
      )}

      {st.kind === "scanning" && (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
          Chạy trên máy này, trong tab này — <b>không ảnh nào rời khỏi máy</b>. Cứ làm việc khác, đóng tab
          giữa chừng cũng không mất: lần sau mở lại chạy tiếp từ chỗ dừng.
        </p>
      )}

      {saved.length > 0 && (
        <div className="mt-3">
          <p className="text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
            Khách đã tìm được theo mặt rồi. Đặt tên thì khách dễ chọn hơn — <b>không bắt buộc</b>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {saved.map((p) => {
              const crop = faceCrop(p.cover_box);
              const drive = photos.find((x) => x.id === p.cover_photo_id)?.drive_file_id;
              return (
                <div key={p.id} className="w-[104px]">
                  <span className="mx-auto block h-[56px] w-[56px] overflow-hidden rounded-full" style={{ background: "var(--sf2, var(--surface2))" }}>
                    {drive ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnailUrl(drive, 400)}
                        alt=""
                        loading="lazy"
                        className="block w-full"
                        style={crop ? { height: "auto", transform: crop.transform, transformOrigin: crop.transformOrigin } : { height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                  </span>
                  <input
                    value={names[p.id] ?? p.name}
                    maxLength={NAME_MAX}
                    placeholder={`${p.count} ảnh`}
                    onChange={(e) => setNames((o) => ({ ...o, [p.id]: e.target.value }))}
                    className="mt-1 w-full rounded-[7px] px-1.5 py-1 text-center text-[11.5px]"
                    style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
                  />
                </div>
              );
            })}
          </div>
          {problems.map((x) => (
            <p key={x} className="mt-1.5 text-[12px]" style={{ color: "#c2410c" }}>{x}</p>
          ))}
          {Object.keys(names).length > 0 && (
            <button
              type="button"
              onClick={saveNames}
              disabled={savingNames || problems.length > 0}
              className="mt-2 rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
              style={{ background: "var(--ac, var(--accent))", color: "#fff" }}
            >
              {savingNames ? "Đang lưu…" : "Lưu tên"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
