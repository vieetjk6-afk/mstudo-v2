/* Màn xem trước GIAO DIỆN MỚI của nhóm "congcu" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import { PreviewV2 } from "./shell";
import ToolsV2 from "@/app/dashboard/tools/ToolsV2";
import FilterToolV2 from "@/components/FilterToolV2";
import { CompressV2Demo } from "@/app/dashboard/compress/CompressV2";
import type { SourceFile } from "@/components/useFilterTool";

/** 12 mã khách gửi (1 mã trùng, 1 mã không có trong thư mục). */
const CODES = [
  "IMG_0012", "IMG_0045", "IMG_0108", "IMG_0131", "IMG_0157", "IMG_0203",
  "IMG_0219", "IMG_0244", "IMG_0301", "IMG_0322", "IMG_0356", "IMG_0399", "img_0045",
];

/** Thư mục buổi chụp giả: mỗi tấm có cả RAW lẫn JPG, cộng ảnh khách không chọn. */
function fakeFolder(): SourceFile[] {
  const out: SourceFile[] = [];
  for (let n = 1; n <= 420; n += 1) {
    const base = `IMG_${String(n).padStart(4, "0")}`;
    if (base === "IMG_0399") continue;
    out.push({ key: `JPG/${base}.JPG`, name: `${base}.JPG`, dir: "JPG" });
    out.push({ key: `RAW/${base}.CR3`, name: `${base}.CR3`, dir: "RAW" });
  }
  return out;
}

const ALBUMS = [
  { id: "a1", title: "Cưới Minh Anh & Đức Huy — Đà Lạt" },
  { id: "a2", title: "Kỷ yếu 12A1 THPT Chu Văn An" },
  { id: "a3", title: "Gia đình chị Thu Hà" },
];

const QUOTA = {
  basic: { unlimited: false, limit: 30, used: 12, remaining: 18 },
  picker: { unlimited: false, limit: 5, used: 1, remaining: 4 },
};

export const SCREENS_CONGCU: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-cong-cu": {
    title: "Giao diện mới — Công cụ ảnh",
    render: () => (
      <PreviewV2 path="/dashboard/tools">
        <ToolsV2 albumCount={24} compressRuns={37} driveReady />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-loc-anh": {
    title: "Giao diện mới — Lọc ảnh khách chọn (đã có mã + thư mục)",
    render: () => (
      <PreviewV2 path="/dashboard/filter">
        <FilterToolV2
          seed={{
            pasteText: CODES.join("\n"),
            localFiles: fakeFolder(),
            localNote: "Nguồn: Cuoi-MinhAnh-DucHuy · 838 ảnh (gồm cả 2 thư mục con) — không upload, xử lý ngay trên máy.",
            albums: ALBUMS,
          }}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-loc-anh-trong": {
    title: "Giao diện mới — Lọc ảnh khách chọn (mới mở)",
    render: () => (
      <PreviewV2 path="/dashboard/filter">
        <FilterToolV2 seed={{ albums: ALBUMS }} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-nen-anh": {
    title: "Giao diện mới — Nén ảnh & chuẩn MXH",
    render: () => (
      <PreviewV2 path="/dashboard/compress">
        <CompressV2Demo quota={QUOTA} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-watermark": {
    title: "Giao diện mới — Gắn watermark",
    render: () => (
      <PreviewV2 path="/dashboard/compress">
        <CompressV2Demo quota={QUOTA} initialTool="watermark" />
      </PreviewV2>
    ),
    bare: true,
  },
};
