"use client";

import { useState } from "react";
import AlbumDuplicateFinder from "@/app/a/[slug]/AlbumDuplicateFinder";
import { LangProvider } from "@/lib/i18n";
import type { DuplicateGroup } from "@/lib/photo-ai";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC KHỐI "ẢNH NA NÁ NHAU" của album khách.

   Khối này khó mở bằng tay hơn cả khung so sánh: cần một album thật có link
   chia sẻ, ảnh thật trên Drive, rồi bấm quét và ngồi chờ — và nó chỉ hiện ra
   NẾU lô ảnh đó thật sự có chuỗi bấm liên tiếp.

   Ở đây `groups` được truyền thẳng (nó vốn là prop có kiểm soát, nên KHÔNG phải
   thêm cửa hậu nào vào code chạy thật), còn ảnh thì trang này để trình duyệt tự
   lấy qua /api/img như bình thường. Bài kiểm tra bằng Playwright chặn đường đó
   lại và trả về ảnh sinh tại chỗ, nên không cần Drive.

   Cái cần nhìn ở đây: bấm vào ô ảnh phải MỞ XEM LỚN (gọi `onOpen` với đúng cả
   chuỗi và đúng tấm), còn trái tim ở góc mới là chọn. Hai thao tác đó nằm chồng
   lên nhau trong một ô 128px nên rất dễ vô tình thành một.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHOTOS = [
  { id: "p1", drive_file_id: "d1", name: "DSC_4471.JPG" },
  { id: "p2", drive_file_id: "d2", name: "DSC_4472.JPG" },
  { id: "p3", drive_file_id: "d3", name: "DSC_4473.JPG" },
  { id: "p4", drive_file_id: "d4", name: "DSC_4480.JPG" },
  { id: "p5", drive_file_id: "d5", name: "DSC_4481.JPG" },
];

const GROUPS: DuplicateGroup[] = [
  { keys: ["p1", "p2", "p3"], bestKey: "p2" },
  { keys: ["p4", "p5"], bestKey: "p4" },
];

export default function AlbumDupDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hide, setHide] = useState(true);
  const [opened, setOpened] = useState<string>("—");

  return (
    <LangProvider>
      <div style={{ maxWidth: 720 }}>
        <AlbumDuplicateFinder
          photos={PHOTOS}
          selected={selected}
          disliked={new Set()}
          groups={GROUPS}
          onGroups={() => {}}
          hide={hide}
          onHide={setHide}
          onToggle={(id) =>
            setSelected((p) => {
              const n = new Set(p);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
          onOpen={(ids, id) => setOpened(`${ids.join(",")} @ ${id}`)}
        />
        {/* Ghi lại lượt gọi `onOpen` để bài kiểm tra đọc được — trong app thật
            đây là chỗ khung xem ảnh của lưới mở ra. */}
        <p className="mt-3 text-[12px]" data-testid="opened" style={{ color: "var(--tx3)" }}>
          onOpen: {opened} · đã chọn: {[...selected].join(",") || "—"}
        </p>
      </div>
    </LangProvider>
  );
}
