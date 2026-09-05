"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Trash2, UserCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAllPhotos, chunk } from "@/lib/photos";
import { centroid, matchKnown, type FaceVector, type KnownPerson, type Person } from "@/lib/face-group";
import { NAME_MAX, indexByKey, matchKey, nameProblems, resolvePhotoIds } from "@/lib/face-people";

/**
 * LƯU NHÓM NGƯỜI VÀO ALBUM.
 *
 * Studio quét một lần trên máy mình, đặt tên từng người, lưu xuống DB. Khách mở
 * album thấy chip "Cô dâu / Chú rể" và tải THÊM 0 byte mô hình.
 *
 * Ghi THẲNG bằng anon key + RLS, không qua API route: đúng cách mọi màn studio
 * khác đang ghi, và không tốn một lượt gọi hàm serverless nào cho việc này.
 *
 * Bảng: supabase/migrations/album_people.sql
 */

type AlbumOpt = { id: string; title: string };
type SavedRow = { id: string; name: string; count: number };

/** Một dòng trong bảng đặt tên. */
type Draft = {
  person: Person;
  /** Người cũ mà cụm này nhận lại được — có thì CẬP NHẬT thay vì thêm mới. */
  knownId: string | null;
  /** Khoảng cách tới người cũ, để studio biết máy tự tin đến đâu. */
  distance: number;
  name: string;
  photoIds: string[];
  missing: number;
};

export default function AiPeopleSave({
  people,
  vectors,
  files,
  previews,
  albums,
  albumId: albumIdProp,
  tight,
}: {
  people: Person[];
  /** Đúng mảng đã truyền cho groupFaces — Person.faceIdx trỏ vào đây. */
  vectors: FaceVector[];
  files: { key: string; name: string }[];
  previews: Record<string, string>;
  albums: AlbumOpt[];
  albumId?: string;
  /** Ngưỡng studio đang kéo — dùng luôn cho việc nhận lại người cũ. */
  tight: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [albumId, setAlbumId] = useState(albumIdProp ?? "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  /**
   * Dữ liệu của album đang chọn. Nạp RIÊNG khỏi việc tính bảng nháp: studio kéo
   * thanh chặt/rộng là gom lại, không phải đổi album — tải lại cả nghìn hàng
   * `photos` mỗi lần kéo thì thanh trượt sẽ giật và tốn băng thông vô ích.
   */
  const [album, setAlbum] = useState<{
    id: string;
    photoIndex: Map<string, string>;
    known: KnownPerson[];
  } | null>(null);

  const nameOfKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of files) m.set(f.key, f.name);
    return m;
  }, [files]);

  /** Tâm cụm của từng người — thứ lưu xuống làm "chứng minh thư". */
  const centroids = useMemo(
    () =>
      people.map((p) => ({
        id: p.id,
        descriptor: centroid(p.faceIdx.map((i) => vectors[i]?.v ?? [])),
      })),
    [people, vectors]
  );

  /** Nạp ảnh của album + những người đã lưu lần trước. */
  const load = useCallback(
    async (id: string) => {
      if (!id) {
        setAlbum(null);
        setSaved([]);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const [photos, { data: known, error: kErr }, { data: links }] = await Promise.all([
          fetchAllPhotos(supabase, id, "id, name"),
          supabase
            .from("album_people")
            .select("id, name, descriptor, position")
            .eq("album_id", id)
            .order("position"),
          supabase.from("album_photo_people").select("person_id").eq("album_id", id),
        ]);
        // Chưa chạy migration: nói ra chứ không để bảng trống không lý do.
        if (kErr) {
          setErr(
            `Chưa có bảng người trong album (${kErr.message}). Hãy chạy supabase/migrations/album_people.sql trong Supabase SQL Editor.`
          );
          setAlbum(null);
          setSaved([]);
          return;
        }
        const counts = new Map<string, number>();
        for (const l of links ?? []) counts.set(l.person_id, (counts.get(l.person_id) ?? 0) + 1);
        setSaved((known ?? []).map((k) => ({ id: k.id, name: k.name, count: counts.get(k.id) ?? 0 })));
        setAlbum({
          id,
          photoIndex: indexByKey(photos as { id: string; name: string }[]),
          known: (known ?? []).map((k) => ({
            id: k.id,
            name: k.name ?? "",
            descriptor: (k.descriptor as number[] | null) ?? [],
          })),
        });
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void load(albumId);
  }, [albumId, load]);

  /**
   * Bảng nháp = nhóm của lượt gom hiện tại × album đang chọn.
   *
   * Tính lại mỗi lần gom lại là ĐÚNG: nhóm đổi thì tên đã gõ không còn thuộc về
   * nhóm nào nữa. Nhưng nó KHÔNG kéo theo một lượt tải album mới.
   */
  useEffect(() => {
    if (!album) {
      setDrafts([]);
      return;
    }
    const matches = matchKnown(centroids, album.known, { maxDistance: tight });
    setDrafts(
      people.map((p, i) => {
        const m = matches[i];
        const names = p.photoKeys.map((k) => nameOfKey.get(k) ?? k);
        const { ids, missing } = resolvePhotoIds(names, album.photoIndex);
        return {
          person: p,
          knownId: m?.knownId ?? null,
          distance: m?.distance ?? Infinity,
          name: m?.name ?? "",
          photoIds: ids,
          missing: missing.length,
        };
      })
    );
  }, [album, people, centroids, nameOfKey, tight]);

  const problems = useMemo(() => nameProblems(drafts.map((d) => d.name)), [drafts]);
  const matchedTotal = drafts.reduce((n, d) => n + d.photoIds.length, 0);
  const namedCount = drafts.filter((d) => d.name.trim()).length;

  async function save() {
    if (!album || problems.length) return;
    const albumId = album.id;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      for (const [i, d] of drafts.entries()) {
        const desc = centroids.find((c) => c.id === d.person.id)?.descriptor ?? null;
        // Ảnh bìa có thể không nằm trong album (studio quét thư mục rộng hơn
        // album) — khi đó để null, cột cho phép.
        const cover = album.photoIndex.get(matchKey(nameOfKey.get(d.person.coverKey) ?? ""));
        const b = d.person.coverBox;
        const row = {
          album_id: albumId,
          name: d.name.trim().slice(0, NAME_MAX),
          face_count: d.person.faces,
          cover_photo_id: cover ?? null,
          cover_at: d.person.coverAt,
          // Khung khuôn mặt đại diện — thứ cho phép KHÁCH cắt ra ảnh mặt để bấm
          // chọn mà không tải mô hình nào. Không có ảnh bìa thì khung vô nghĩa.
          cover_box: cover && b ? [b.x, b.y, b.w, b.h] : null,
          descriptor: desc,
          position: i,
        };

        let personId = d.knownId;
        if (personId) {
          const { error } = await supabase.from("album_people").update(row).eq("id", personId);
          if (error) throw error;
          // Ghi lại từ đầu danh sách ảnh: lượt quét này là sự thật mới nhất về
          // người đó. Cộng thêm vào sẽ để lại ảnh của lượt trước mà lượt này đã
          // xác định là không phải người này.
          const { error: dErr } = await supabase
            .from("album_photo_people")
            .delete()
            .eq("person_id", personId);
          if (dErr) throw dErr;
        } else {
          const { data, error } = await supabase
            .from("album_people")
            .insert(row)
            .select("id")
            .single();
          if (error) throw error;
          personId = data.id as string;
        }

        for (const part of chunk(d.photoIds, 500)) {
          const { error } = await supabase
            .from("album_photo_people")
            .insert(part.map((photo_id) => ({ album_id: albumId, person_id: personId!, photo_id })));
          if (error) throw error;
        }
      }
      setMsg(
        `Đã lưu ${drafts.length} người (${namedCount} đã đặt tên) với ${matchedTotal} lượt ảnh. Khách mở album sẽ thấy chip lọc.`
      );
      await load(albumId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSaved(id: string, name: string) {
    if (!window.confirm(`Xoá "${name || "người chưa đặt tên"}" khỏi album? Chip lọc của khách sẽ mất.`)) return;
    const { error } = await supabase.from("album_people").delete().eq("id", id);
    if (error) setErr(error.message);
    else await load(albumId);
  }

  const box = { background: "var(--sf, var(--surface))", border: "1px solid var(--bd, var(--border))" };

  return (
    <div className="mt-3 rounded-[12px] px-3.5 py-3" style={box}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5 text-[13px] font-bold">
          <Users size={15} style={{ color: "var(--ac, var(--accent))" }} /> Lưu vào album cho khách lọc
        </span>
        <select
          value={albumId}
          onChange={(e) => {
            setAlbumId(e.target.value);
            setMsg(null);
          }}
          className="rounded-[8px] px-2 py-1 text-[12px]"
          style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
        >
          <option value="">— Chọn album —</option>
          {albums.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
        {loading && <span className="text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>Đang nạp album…</span>}
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--tx3, var(--text3))" }}>
        Đặt tên rồi bấm lưu — khách chỉ tải vài KB danh sách, <b>không tải mô hình AI</b>. Ảnh được ghép với
        album theo <b>tên file</b> (bỏ phần mở rộng), nên quét RAW mà album lưu JPG vẫn khớp.
      </p>

      {albumId && !loading && (
        <>
          <div className="mt-3 flex flex-col gap-2">
            {drafts.map((d, i) => (
              <div key={d.person.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2" style={{ background: "var(--sf2, var(--surface2))" }}>
                <div className="h-11 w-11 flex-none overflow-hidden rounded-[8px]" style={{ background: "var(--sf, var(--surface))" }}>
                  {previews[d.person.coverKey] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[d.person.coverKey]} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={d.name}
                    maxLength={NAME_MAX}
                    placeholder={`Tên người #${i + 1} (ví dụ: Cô dâu)`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((old) => old.map((x) => (x.person.id === d.person.id ? { ...x, name: v } : x)));
                    }}
                    className="w-full rounded-[7px] px-2 py-1 text-[12.5px]"
                    style={{ background: "var(--sf, var(--surface))", border: "1px solid var(--bd, var(--border))" }}
                  />
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--tx3, var(--text3))" }}>
                    {d.photoIds.length} ảnh trong album
                    {d.missing > 0 && ` · ${d.missing} ảnh không có trong album này`}
                    {d.knownId && (
                      <span style={{ color: "var(--ac, var(--accent))" }}>
                        {" "}· <UserCheck size={11} className="inline" /> nhận lại người đã lưu (cách {d.distance.toFixed(2)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {drafts.every((d) => d.photoIds.length === 0) && drafts.length > 0 && (
            <p className="mt-2 text-[12px]" style={{ color: "#c2410c" }}>
              Không ảnh nào khớp album này. Có phải bạn đang quét thư mục của một album khác?
            </p>
          )}
          {problems.map((p) => (
            <p key={p} className="mt-2 text-[12px]" style={{ color: "#c2410c" }}>{p}</p>
          ))}

          <button
            onClick={save}
            disabled={saving || problems.length > 0 || matchedTotal === 0}
            className="mt-2.5 flex items-center justify-center gap-2 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
            style={{ background: "var(--ac, var(--accent))", color: "#fff" }}
          >
            <Save size={15} /> {saving ? "Đang lưu…" : `Lưu ${drafts.length} người vào album`}
          </button>

          {saved.length > 0 && (
            <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--bd, var(--border))" }}>
              <p className="text-[11.5px] font-semibold" style={{ color: "var(--tx2, var(--text2))" }}>
                Đã lưu trong album này
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--tx3, var(--text3))" }}>
                Người mà lượt quét này không thấy vẫn được <b>giữ nguyên</b> — quét một thư mục nhỏ hơn không
                nên xoá công đặt tên của lần trước. Muốn bỏ hẳn thì xoá ở đây.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {saved.map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: "var(--sf2, var(--surface2))" }}>
                    {s.name || <i style={{ color: "var(--tx3, var(--text3))" }}>chưa đặt tên</i>} · {s.count} ảnh
                    <button onClick={() => removeSaved(s.id, s.name)} aria-label={`Xoá ${s.name}`} style={{ color: "#c2410c" }}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {msg && <p className="mt-2 text-[12px]" style={{ color: "#15803d" }}>{msg}</p>}
      {err && <p className="mt-2 text-[12px]" style={{ color: "#c2410c" }}>{err}</p>}
    </div>
  );
}
