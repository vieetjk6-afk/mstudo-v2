"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import FilterDialog from "./FilterDialog";

/**
 * Nút "Lọc ảnh" trong quản lý album — mở POPUP công cụ lọc ảnh tại chỗ thay vì
 * chuyển sang trang khác. Trong popup vẫn có nút mở trang lọc ảnh đầy đủ.
 */
export default function FilterPhotosButton({
  albumId,
  albumTitle,
  label = "Lọc ảnh",
  className = "btn-primary",
  iconSize = 15,
}: {
  albumId: string;
  albumTitle?: string;
  label?: string;
  className?: string;
  iconSize?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Filter size={iconSize} /> {label}
      </button>
      {open && <FilterDialog albumId={albumId} albumTitle={albumTitle} onClose={() => setOpen(false)} />}
    </>
  );
}
