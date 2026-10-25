# Làm lại một màn cho giao diện mới (V2)

Tài liệu cho người dựng bản V2 của từng màn. Đọc kèm `docs/giao-dien-moi.md`
(công tắc, cờ, lộ trình). **Màn mẫu để học theo:** `src/app/dashboard/AlbumListV2.tsx`.

## Mục tiêu

Không phải "bản cũ đổi màu". Mỗi màn V2 **sắp xếp lại nội dung** để gọn và
dễ thao tác hơn:

- Hiện trước điều người dùng cần nhìn mỗi ngày: số liệu chính, việc cần làm.
  Phần chi tiết đẩy xuống dưới hoặc mở bằng ngăn kéo.
- **Mỗi màn chỉ một nút `primary`.** Thao tác phụ dùng `secondary` hoặc `ghost`.
  Thao tác ít dùng dồn vào menu `⋯` (`<Menu>`).
- Bộ lọc gom vào một `<Toolbar>`: ô tìm, một `<Segmented>`, và tối đa 2–3
  `<select>`.
- Danh sách dài nhóm theo nghĩa (tháng, trạng thái), có `<GroupLabel>`.
- Thẻ trong danh sách có tối đa 1 nút chữ, 1–2 nút icon và menu `⋯`.
- Xem nhanh hoặc sửa nhanh thì dùng `<Drawer>`, không bắt người dùng chuyển trang.
- Trên điện thoại: một cột, nút cao ít nhất 36px, bảng chuyển thành thẻ hoặc
  `ListRow`, không có gì tràn ngang.
- Viết chữ đơn giản và rõ: nói người dùng làm gì hoặc thấy gì, không dùng từ
  kỹ thuật.

**Giữ nguyên 100% dữ liệu và chức năng**: cùng prop, cùng truy vấn Supabase,
cùng server action hoặc route API, cùng phân quyền. Nếu bản cũ có một thao
tác, bản V2 cũng phải có (được phép nằm trong `⋯` hoặc ngăn kéo). Không đổi
API, schema hay logic nghiệp vụ. Nếu cần tách logic ra để dùng chung giữa V1
và V2, chuyển nó sang một hàm hoặc hook chung, KHÔNG chép đôi.

## Bộ khối

`src/components/v2/kit.tsx` (dùng được ở server):
`PageHead, Card, Section, Stack, StatGrid, Stat, Badge, Toolbar, Field, inputCls,
GroupLabel, ListRow, InfoList, Avatar, Empty, Progress, Callout, btn(), iconBtn()`.

`src/components/v2/kit-client.tsx` ("use client"):
`Menu, Segmented, Tabs, SearchInput, Switch, Drawer, Modal`.

- Nút: `className={btn("primary" | "secondary" | "ghost" | "soft" | "danger", "sm" | "md" | "lg")}`,
  dùng được cho `<button>`, `<Link>` và `<a>`. Nút chỉ có icon dùng `iconBtn()` và
  bắt buộc có `aria-label`.
- Ô nhập: `className={inputCls}` cho input, select, textarea. Bọc trong
  `<Field label hint error>`.
- Bảng: `<div className="v2-table-wrap"><table className="v2-table">`. Cột số
  thêm `className="num"`.
- Màu: chỉ dùng token (`var(--ac)`, `--tx`, `--tx2`, `--tx3`, `--sf`, `--sf2`,
  `--bd`, `--gn`/`--gnS`, `--am`/`--amS`, `--rd`/`--rdS`, `--bl`/`--blS`). Không
  viết mã màu cứng. Prop `tone` chỉ mang nghĩa: green là xong hoặc đã thu,
  amber là chờ hoặc thiếu, red là quá hạn hoặc lỗi, blue là thông tin, brand là
  màu chủ đạo.
- Khoảng cách: các khối xếp bằng `<Stack>` (cách nhau 20px). Trong thẻ dùng
  `gap-2`, `gap-3`. Chữ thân 14px, phụ 12.5–13px, tiêu đề khối 15px.
- Tiêu đề màn đã có trên topbar (`src/lib/studio-titles.ts`), nên đừng lặp lại
  tiêu đề lớn. Mở màn bằng `<PageHead desc actions>`.

## Gắn bản V2 vào màn

**Màn client** (component "use client" nhận prop từ page.tsx): đổi tên
component cũ thành `XxxV1`, rồi xuất mặc định một lớp bọc:

```tsx
import { useUiV2 } from "@/components/v2/UiV2Context";
import XxxV2 from "./XxxV2";
export default function Xxx(props: Props) {
  return useUiV2() ? <XxxV2 {...props} /> : <XxxV1 {...props} />;
}
```

Phải đổi KIỂU component như trên. Đừng rẽ nhánh sau các hook: `router.refresh()`
giữ nguyên state client, nên rẽ nhánh giữa chừng sẽ làm lệch thứ tự hook.

**Màn server** (page.tsx tự vẽ JSX): `import { isUiV2 } from "@/lib/ui-server"`,
sau đó `if (await isUiV2()) return <XxxV2 ...dữ liệu đã tải... />`. Dùng lại đúng
phần tải dữ liệu, đừng chép truy vấn.

File V2 đặt ngay cạnh file cũ, tên có hậu tố `V2` (vd `ContractsListV2.tsx`).

## Kiểm tra trước khi xong

1. `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p .` phải sạch.
2. `npx eslint <các file đã sửa>` phải sạch.
3. Thêm màn xem trước vào ĐÚNG file nhóm của mình trong
   `src/app/uipreview/v2/<nhóm>.tsx`: bọc bằng `<PreviewV2 path="...">`, đặt
   `bare: true`, dùng dữ liệu giả có sẵn ở `src/app/uipreview/fixtures.ts`.
4. Chụp ảnh ở khổ 1440 và 390, nền sáng và nền tối. Mở bằng
   `http://localhost:3333`, không mở bằng 127.0.0.1. Phải không tràn ngang và
   không có lỗi JavaScript.

## Trang khách (không đăng nhập)

Trang khách gồm hợp đồng `/c`, báo giá `/q`, album `/a`, cổng khách `/portal`,
đặt lịch `/book`, form `/form`, voucher, bảng giá, cổng thợ `/crew`… Chúng không
nằm trong khung studio nên không dùng `useUiV2()`. Cách làm:

- **Bật hay không:** trong `page.tsx` (server), gọi
  `const v2 = await customerUiV2(ownerId)` từ `@/lib/ui-server`, rồi vẽ `<XxxV2>`
  hoặc bản cũ. Quyết định đi theo studio sở hữu trang: cờ `ui_v2 = "default"` là
  mọi studio, còn lại chỉ studio của tài khoản admin.
- **Khung:** bọc bằng `CustomerRootV2` (+ `CustomerHeaderV2`, `CustomerMainV2`)
  từ `src/components/v2/customer.tsx`. Lớp `client-doc ui-v2` cho đúng bộ màu V2,
  bên trong dùng đúng bộ khối `kit.tsx` / `kit-client.tsx`.
- **Viết cho khách, không phải cho studio:** chữ to và dễ hiểu hơn, một việc
  chính mỗi màn (ký, thanh toán, chọn ảnh, gửi form), trạng thái rõ ràng (đã ký,
  còn phải trả bao nhiêu, hạn khi nào). Trang phải đẹp trên điện thoại trước,
  vì khách mở link từ Zalo hoặc Messenger.
- **Giữ nguyên:** token và link, phân quyền, chức năng in và PDF, chữ ký, mã QR
  thanh toán, metadata chia sẻ (`studioShareMetadata`), mọi API khách gọi.
- **Không vẽ lại** phần trang trí nghệ thuật (mẫu thiệp cưới, love story, website
  studio do studio tự dựng). Chỉ làm lại phần khung thao tác quanh chúng nếu có.
