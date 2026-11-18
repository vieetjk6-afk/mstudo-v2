import { centroid, groupFaces, matchKnown, type FaceVector, type KnownPerson, type Person } from "./face-group";

/*
 * GOM KHUÔN MẶT THÀNH NGƯỜI — phần TÍNH thuần, không vào/ra gì.
 *
 * Dùng ở hai nơi và PHẢI cho cùng một kết quả:
 *   · trình duyệt của studio (Web Worker @/lib/face-gom.worker) — đường mặc định
 *     từ khi album cưới vài nghìn ảnh làm lượt gom trên máy chủ quá giờ;
 *   · máy chủ (@/lib/face-gom → clusterAlbum) khi bật FACE_SERVER_SCAN=1.
 * Không nhập gì ngoài @/lib/face-group (cũng thuần) để chạy được trong Worker.
 */

export type FaceRow = { photo_id: string; at: number; box: number[] | null; descriptor: number[] | null; sharpness: number | null };

/** Một người đã gom, sẵn để ghi — id do bên ghi cấp; tên lấy từ người cũ (`knownId`). */
export type NguoiGom = {
  /** Người cũ khớp với cụm này (để giữ tên studio đã đặt). */
  knownId: string | null;
  name: string;
  face_count: number;
  cover_photo_id: string | null;
  cover_at: number;
  cover_box: number[] | null;
  descriptor: number[] | null;
  position: number;
  /** Ảnh có mặt người này, không trùng. */
  anh: string[];
};

export function tinhNguoi(list: readonly FaceRow[], known: readonly KnownPerson[]): NguoiGom[] {
  const vecs: FaceVector[] = list
    .filter((f) => Array.isArray(f.descriptor) && f.descriptor.length === 128)
    .map((f) => ({
      key: f.photo_id,
      at: f.at,
      v: f.descriptor as number[],
      area: (f.box?.[2] ?? 0) * (f.box?.[3] ?? 0),
      sharpness: f.sharpness ?? 0,
      box: f.box ? { x: f.box[0], y: f.box[1], w: f.box[2], h: f.box[3] } : undefined,
    }));
  if (vecs.length === 0) return [];
  const people: Person[] = groupFaces(vecs).people;
  const centroids = people.map((p) => ({ id: p.id, descriptor: centroid(p.faceIdx.map((i) => vecs[i].v)) }));
  const matches = matchKnown(centroids, known);
  return people.map((p, i) => {
    const b = p.coverBox;
    return {
      knownId: matches[i]?.knownId ?? null,
      name: matches[i]?.name ?? "",
      face_count: p.faces,
      cover_photo_id: p.coverKey || null,
      cover_at: p.coverAt,
      cover_box: b ? [b.x, b.y, b.w, b.h] : null,
      descriptor: centroids[i].descriptor,
      position: i,
      anh: p.photoKeys,
    };
  });
}
