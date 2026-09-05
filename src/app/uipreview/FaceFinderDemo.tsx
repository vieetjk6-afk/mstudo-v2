"use client";

import { useState } from "react";
import CustomerAlbum from "@/app/a/[slug]/CustomerAlbum";
import { LangProvider } from "@/lib/i18n";
import type { PersonChip } from "@/lib/face-people";
import { draw, IDENTITIES, VARIANTS } from "./veMatNguoi";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC "TÌM ẢNH THEO KHUÔN MẶT" của album khách.

   Mở bằng tay thì cần: một album thật, ảnh thật trên Drive, chạy migration,
   rồi studio phải quét xong một lượt gom người và lưu — bốn bước, mỗi bước sai
   một kiểu khác nhau.

   Ở đây `initialPeople` truyền thẳng (nó vốn là prop, KHÔNG phải cửa hậu nào
   thêm vào code chạy thật). Ảnh vẫn đi qua /api/img như bình thường; bài kiểm
   tra Playwright chặn đường đó và trả về ảnh sinh tại chỗ có một ô màu ở ĐÚNG
   vị trí `coverBox`, nên nhìn ảnh thẻ là biết phép cắt đúng hay sai.

   Cái cần nhìn:
    • Ảnh thẻ phải cắt ra ĐÚNG khuôn mặt, không phải cả tấm — một tấm ảnh cưới
      có hai ba người thì lấy cả tấm là khách không chỉ được vào mặt mình.
    • Người studio CHƯA đặt tên vẫn phải hiện. Họ mới là phần đông.
    • Bấm một mặt phải lọc lưới xuống đúng ảnh của người đó, bấm lại thì thôi.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHOTOS = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  drive_file_id: `d${i + 1}`,
  name: `DSC_44${70 + i}.JPG`,
  source_id: null,
  position: i,
}));

const PEOPLE: PersonChip[] = [
  // coverBox trỏ vào ô màu mà bài kiểm thử vẽ sẵn trên ảnh giả, để nhìn ảnh thẻ
  // là biết phép cắt có đúng chỗ không.
  {
    id: "P1",
    name: "Cô dâu",
    coverPhotoId: "p1",
    coverBox: [0.1, 0.1, 0.2, 0.3],
    descriptor: null,
    faceCount: 12,
    photoIds: ["p1", "p2", "p3", "p4"],
  },
  {
    id: "P2",
    name: "Chú rể",
    coverPhotoId: "p3",
    coverBox: [0.6, 0.15, 0.2, 0.3],
    descriptor: null,
    faceCount: 9,
    photoIds: ["p3", "p4", "p5"],
  },
  // Chưa đặt tên — khách vẫn nhận ra bằng mặt. Đây là phần đông trong album thật.
  {
    id: "P3",
    name: "",
    coverPhotoId: "p6",
    coverBox: [0.35, 0.4, 0.2, 0.3],
    descriptor: null,
    faceCount: 5,
    photoIds: ["p6", "p7"],
  },
  // Không có khung mặt (album lưu từ bản trước): phải lùi về lấy cả tấm.
  {
    id: "P4",
    name: "Không có khung",
    coverPhotoId: "p8",
    coverBox: null,
    descriptor: null,
    faceCount: 3,
    photoIds: ["p8"],
  },
];

/**
 * Dựng dữ liệu THẬT để thử đường "khách tải ảnh của mình lên".
 *
 * Đường đó không kiểm bằng dữ liệu giả được: nó cần tâm cụm thật để so, mà tâm
 * cụm thì chỉ có sau khi chạy mô hình. Nên nút này vẽ hai "người", chạy đúng
 * đường ống thật để sinh vector cho họ, rồi để sẵn ở `window.__thuNghiemMat` một
 * biến thể KHÁC của cùng hai người — bài kiểm thử lấy ảnh đó tải lên và đòi hệ
 * thống nhận ra đúng người.
 *
 * Chỉ có ở bản dev: cả /uipreview trả 404 trên production.
 */
async function dungDuLieuThat(): Promise<PersonChip[]> {
  const [{ loadFaceModel, detectFull }, { loadRecognizer, embedFace }] = await Promise.all([
    import("@/lib/face-detect"),
    import("@/lib/face-embed"),
  ]);
  const [det, rec] = await Promise.all([loadFaceModel(), loadRecognizer()]);

  async function vector(url: string) {
    const full = await detectFull(det, { key: url.slice(-12), name: "x.jpg", url }, 0);
    if (!full.landmarks.length) return null;
    return embedFace(rec, full.canvas, full.width, full.height, full.landmarks[0]);
  }

  const out: PersonChip[] = [];
  const thu: Record<string, string> = {};
  for (let i = 0; i < 2; i++) {
    const id = IDENTITIES[i];
    const v = await vector(draw(id, VARIANTS[0]));
    out.push({
      ...PEOPLE[i],
      name: `Người ${id.name}`,
      descriptor: v ? Array.from(v) : null,
    });
    // Biến thể KHÁC của cùng người — đúng tình huống thật: khách tải lên một tấm
    // không nằm trong album.
    thu[`nguoi${id.name}`] = draw(id, VARIANTS[1]);
  }
  // Và một người KHÔNG có trong album, để kiểm nhánh "không tìm thấy".
  thu.nguoiLa = draw(IDENTITIES[3], VARIANTS[0]);
  (window as unknown as { __thuNghiemMat?: Record<string, string> }).__thuNghiemMat = thu;
  return out;
}

export default function FaceFinderDemo() {
  const [people, setPeople] = useState<PersonChip[]>(PEOPLE);
  const [busy, setBusy] = useState("");

  return (
    <LangProvider>
      <div className="mb-4 rounded-[12px] px-3.5 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <button
          onClick={async () => {
            setBusy("Đang tải mô hình và dựng vector thật…");
            try {
              setPeople(await dungDuLieuThat());
              setBusy("Xong — giờ bấm “Tải ảnh của bạn lên” và chọn một ảnh người A hoặc B.");
            } catch (e) {
              setBusy(e instanceof Error ? e.message : "hỏng");
            }
          }}
          className="rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accentInk)" }}
        >
          Dựng dữ liệu thật để thử tìm bằng ảnh
        </button>
        <span className="ml-2 text-[12px]" style={{ color: "var(--text3)" }} data-thu-nghiem={busy ? "1" : "0"}>
          {busy || "Mặc định là dữ liệu giả (descriptor rỗng) nên đường tải ảnh lên sẽ báo không tìm thấy."}
        </span>
      </div>

      {/* `key` đổi để CustomerAlbum DỰNG LẠI khi có dữ liệu thật.
          `initialPeople` đúng như tên gọi là giá trị KHỞI TẠO (useState), nên
          đổi prop không ăn — đó là hành vi đúng của code thật (trang khách nhận
          dữ liệu một lần từ máy chủ), chỉ riêng màn xem trước này mới cần thay
          giữa chừng. Sửa ở đây, không sửa code chạy thật. */}
      <CustomerAlbum
        key={people[0]?.descriptor ? "that" : "gia"}
        album={{
          id: "a1",
          slug: "xem-truoc",
          title: "Album xem trước",
          description: null,
          cover_url: null,
          selection_limit: 0,
          watermark_enabled: false,
          watermark_text: null,
          hasPassword: false,
          allowDownload: false,
          allowNotes: false,
        }}
        initialPhotos={PHOTOS}
        initialSources={[]}
        initialPeople={people}
        studioName="Mai Studio"
      />
    </LangProvider>
  );
}
