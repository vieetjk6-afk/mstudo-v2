/* Màn xem trước GIAO DIỆN MỚI của nhóm "albumct" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import { PreviewV2 } from "./shell";
import AlbumEditor, { type AlbumPick, type CustomerShare, type LinkedContractInfo } from "@/app/dashboard/albums/[id]/AlbumEditor";
import type { AlbumPrintInfo } from "@/app/dashboard/albums/[id]/AlbumPrintPanel";
import SelectionsView from "@/app/dashboard/albums/[id]/selections/SelectionsView";
import CreateAlbumFlowV2 from "@/components/CreateAlbumFlowV2";
import NewAlbumPage from "@/app/dashboard/albums/new/page";
import AlbumCategoriesManager from "@/app/dashboard/studio/album-categories/AlbumCategoriesManager";
import type { Album, AlbumSource, Dislike, Photo, Selection } from "@/lib/types";

/* ── Dữ liệu giả của một album cưới: hai thư mục ảnh chọn + một thư mục giao ── */

/** Bìa giả: dải màu SVG, không cần mạng. */
function bia(a: string, b: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='400' height='300' fill='url(#g)'/></svg>`)}`;
}

const AID = "al-demo";
const album = (over: Partial<Album> = {}): Album => ({
  id: AID, owner_id: "o", slug: "lan-minh-cuoi", title: "Lan & Minh · Tiệc cưới Riverside",
  description: "Ảnh cưới ngày 12/10 tại Riverside Palace", cover_url: bia("#f7971e", "#7b2ff7"), password_hash: null,
  selection_limit: 60, watermark_enabled: true, watermark_text: "Mai Studio", download_enabled: true, status: "published",
  is_showcase: false, is_pinned: false, kind: null, is_gallery: false, client_name: "Lan", client_phone: "0912345678",
  event_date: "2026-10-12", category: "cuoi", category_label: "Cưới", gallery_pinned: false, phase: "selection",
  watermark_delivery: false, delivered_at: null, storage_until: null, storage_notice_at: null,
  created_at: "2026-10-13T02:00:00Z", updated_at: "2026-10-20T02:00:00Z",
  ...over,
});

const src = (id: string, name: string, stage: "selection" | "delivery", position: number): AlbumSource => ({
  id, album_id: AID, name, drive_url: `https://drive.google.com/drive/folders/${id}-1AbCdEf`, kind: "folder", stage, position, created_at: "",
});
const SOURCES: AlbumSource[] = [src("s1", "Lễ gia tiên", "selection", 0), src("s2", "Tiệc cưới", "selection", 1)];
const SOURCES_DELIVERY: AlbumSource[] = [...SOURCES, src("s3", "File ChinhSua", "delivery", 2)];

const ph = (i: number, sid: string, pre: string): Photo => ({
  id: `${sid}-${i}`, album_id: AID, source_id: sid, drive_file_id: `f-${sid}-${i}`,
  name: `${pre}_${String(4100 + i * 3).padStart(4, "0")}.JPG`, position: i, is_video: false, created_at: "",
});
const PHOTOS: Photo[] = [
  ...Array.from({ length: 9 }, (_, i) => ph(i, "s1", "DSC")),
  ...Array.from({ length: 13 }, (_, i) => ph(i + 20, "s2", "DSC")),
];
const PHOTOS_DELIVERY: Photo[] = [...PHOTOS, ...Array.from({ length: 8 }, (_, i) => ph(i, "s3", "LAN"))];

const pick = (n: number, photo: Photo, session: string, name: string | null, note: string | null, at: string): AlbumPick => ({
  id: `sel-${n}`, photo_id: photo.id, photo_name: photo.name, session_id: session, client_name: name,
  client_note: note, photographer_note: null, created_at: at,
});
const PICKS: AlbumPick[] = [
  pick(1, PHOTOS[0], "a91f3c2e", "Lan", "Làm mịn da, sáng hơn chút", "2026-10-18T09:12:00Z"),
  pick(2, PHOTOS[2], "a91f3c2e", "Lan", null, "2026-10-18T09:13:00Z"),
  pick(3, PHOTOS[3], "a91f3c2e", "Lan", "Crop bỏ người phía sau", "2026-10-18T09:15:00Z"),
  pick(4, PHOTOS[6], "a91f3c2e", "Lan", null, "2026-10-18T09:16:00Z"),
  pick(5, PHOTOS[10], "a91f3c2e", "Lan", null, "2026-10-18T09:20:00Z"),
  pick(6, PHOTOS[12], "a91f3c2e", "Lan", "In khổ lớn treo phòng khách", "2026-10-18T09:22:00Z"),
  pick(7, PHOTOS[15], "a91f3c2e", "Lan", null, "2026-10-18T09:25:00Z"),
  pick(8, PHOTOS[2], "7be0d419", "Mẹ cô dâu", "Ảnh này đẹp nhất", "2026-10-19T13:02:00Z"),
  pick(9, PHOTOS[8], "7be0d419", "Mẹ cô dâu", null, "2026-10-19T13:04:00Z"),
  pick(10, PHOTOS[17], "7be0d419", "Mẹ cô dâu", null, "2026-10-19T13:05:00Z"),
  pick(11, PHOTOS[20], "c33d0a77", null, null, "2026-10-17T20:40:00Z"),
];

const SHARES: CustomerShare[] = [
  { token: "aB3dE9xQ", photoIds: [PHOTOS[0].id, PHOTOS[2].id, PHOTOS[3].id, PHOTOS[6].id, PHOTOS[12].id, PHOTOS[15].id], createdAt: "2026-10-20T09:14:00Z" },
  { token: "Zz81kLmP", photoIds: [PHOTOS[8].id, PHOTOS[17].id, "anh-da-go"], createdAt: "2026-10-18T20:02:00Z" },
];

const CONTRACT: LinkedContractInfo = {
  id: "c1", code: "HĐ-0142", title: "Chụp cưới Lan & Minh", status: "in_progress", albumMode: "desktop", isSelectionAlbum: true,
};

const PRINT: AlbumPrintInfo = {
  quota: 10, contractId: "c1", contractQuota: 10, albumQuota: 0,
  picks: PHOTOS_DELIVERY.slice(-6).map((p) => ({ photo_id: p.id, photo_name: p.name })),
  sentAt: "2026-10-21T08:00:00Z", copiedAt: null,
};

// Lời hứa tạo MỘT lần ở cấp module — tạo trong lúc vẽ thì mỗi lần vẽ là một
// lời hứa mới, màn album nạp lại ảnh mãi.
const PHOTOS_P = Promise.resolve(PHOTOS);
const PHOTOS_DELIVERY_P = Promise.resolve(PHOTOS_DELIVERY);
const NO_PHOTOS_P = Promise.resolve([] as Photo[]);

function editor(tab?: string, over: Partial<Album> = {}, extra: Partial<React.ComponentProps<typeof AlbumEditor>> = {}) {
  return (
    <PreviewV2 path={`/dashboard/albums/${AID}`}>
      <AlbumEditor
        album={album(over)}
        initialSources={SOURCES}
        photosPromise={PHOTOS_P}
        canDelivery
        canPinHome
        canWatermark
        studioName="Mai Studio"
        studioHost={null}
        studioCats={[{ slug: "cuoi", label: "Cưới" }, { slug: "ky-yeu", label: "Kỷ yếu" }]}
        contractId="c1"
        linkedContract={CONTRACT}
        clientPhone="0912345678"
        clientName="Lan"
        selections={PICKS}
        customerShares={SHARES}
        initialTab={tab}
        {...extra}
      />
    </PreviewV2>
  );
}

function editorDelivery(tab?: string) {
  return editor(
    tab,
    { phase: "delivery", delivered_at: "2026-10-22T03:00:00Z", storage_until: "2026-11-15", cover_url: bia("#ee9ca7", "#ffdde1") },
    { initialSources: SOURCES_DELIVERY, photosPromise: PHOTOS_DELIVERY_P, printInfo: PRINT },
  );
}

/* ── Màn "Lựa chọn của khách": lượt chọn đầy đủ (kèm ghi chú studio) + ảnh không thích ── */
const SELECTIONS: Selection[] = PICKS.map((p, i) => ({
  ...p, album_id: AID, photographer_note: i === 1 ? "Chỉnh màu ấm" : null,
}));
const DISLIKES: Dislike[] = [
  { id: "d1", album_id: AID, photo_id: PHOTOS[4].id, photo_name: PHOTOS[4].name, session_id: "a91f3c2e", client_note: "Mắt nhắm", created_at: "2026-10-18T09:30:00Z" },
  { id: "d2", album_id: AID, photo_id: PHOTOS[9].id, photo_name: PHOTOS[9].name, session_id: "a91f3c2e", client_note: null, created_at: "2026-10-18T09:31:00Z" },
  { id: "d3", album_id: AID, photo_id: PHOTOS[18].id, photo_name: PHOTOS[18].name, session_id: "7be0d419", client_note: "Bị mờ", created_at: "2026-10-19T13:08:00Z" },
];

const CATS = [
  { slug: "cuoi", label: "Cưới", count: 18 },
  { slug: "ky-yeu", label: "Kỷ yếu", count: 7 },
  { slug: "gia-dinh", label: "Gia đình", count: 5 },
  { slug: "su-kien-doanh-nghiep", label: "Sự kiện doanh nghiệp", count: 3 },
  { slug: "be-yeu", label: "Bé yêu", count: 1 },
];

export const SCREENS_ALBUMCT: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-album": {
    title: "Giao diện mới — Album: tab Ảnh (album chọn ảnh của hợp đồng, khách đã chốt)",
    render: () => editor("photos", { selection_done_at: "2026-10-19T13:10:00Z" } as Partial<Album>),
    bare: true,
  },
  "v2-album-khach-chon": {
    title: "Giao diện mới — Album: tab Khách chọn (3 mã chọn, có ghi chú)",
    render: () => editor("picked"),
    bare: true,
  },
  "v2-album-chia-se": {
    title: "Giao diện mới — Album: tab Chia sẻ (link, Zalo, mật khẩu, link khách tự chia sẻ)",
    render: () => editor("shares", { password_hash: "x" }),
    bare: true,
  },
  "v2-album-giao": {
    title: "Giao diện mới — Album: tab Giao khách (đã giao, hạn lưu trữ)",
    render: () => editorDelivery("deliver"),
    bare: true,
  },
  "v2-album-in": {
    title: "Giao diện mới — Album: tab Ảnh in (khách đã gửi 6/10 ảnh)",
    render: () => editorDelivery("print"),
    bare: true,
  },
  "v2-album-cai-dat": {
    title: "Giao diện mới — Album: tab Cài đặt",
    render: () => editor("settings"),
    bare: true,
  },
  "v2-album-trong": {
    title: "Giao diện mới — Album mới tạo, chưa có ảnh, chưa ai chọn",
    render: () =>
      editor("photos", { title: "Kỷ yếu 12A3", cover_url: null, status: "draft", category: null, category_label: null }, {
        initialSources: [], photosPromise: NO_PHOTOS_P, selections: [], customerShares: [], linkedContract: null, contractId: null, clientPhone: null, clientName: null,
      }),
    bare: true,
  },
  "v2-album-lua-chon": {
    title: "Giao diện mới — Lựa chọn của khách (3 mã chọn, 3 ảnh không thích)",
    render: () => (
      <PreviewV2 path={`/dashboard/albums/${AID}/selections`}>
        <SelectionsView album={album()} selections={SELECTIONS} dislikes={DISLIKES} photos={PHOTOS} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-album-lua-chon-trong": {
    title: "Giao diện mới — Lựa chọn của khách: khách chưa chọn gì",
    render: () => (
      <PreviewV2 path={`/dashboard/albums/${AID}/selections`}>
        <SelectionsView album={album()} selections={[]} dislikes={[]} photos={PHOTOS} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-album-tao": {
    title: "Giao diện mới — Tạo album chọn ảnh từ Google Drive",
    render: () => (
      <PreviewV2 path="/dashboard/create">
        <CreateAlbumFlowV2 mode="selection" studioHost={null} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-album-tao-giao": {
    title: "Giao diện mới — Tạo album giao khách (ảnh hoàn thiện)",
    render: () => (
      <PreviewV2 path="/dashboard/create">
        <CreateAlbumFlowV2 mode="delivery" studioHost={null} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-album-moi": {
    title: "Giao diện mới — Album mới (chỉ cần tên)",
    render: () => (
      <PreviewV2 path="/dashboard/albums/new">
        <NewAlbumPage />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-album-loai": {
    title: "Giao diện mới — Loại album",
    render: () => (
      <PreviewV2 path="/dashboard/studio/album-categories">
        <AlbumCategoriesManager ownerId="o" initial={CATS} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-album-loai-trong": {
    title: "Giao diện mới — Loại album: chưa có loại nào",
    render: () => (
      <PreviewV2 path="/dashboard/studio/album-categories">
        <AlbumCategoriesManager ownerId="o" initial={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
};
