"use client";

import Link from "next/link";
import { Lock, Pause, Play, ScanFace } from "lucide-react";
import { Badge, Progress, Section, btn } from "@/components/v2/kit";
import { useEffect, useState } from "react";
import { batLaiTuQuet, tuQuetDangTat } from "@/components/v2/FaceAutoScan";
import { useFaceLocalScan, type FaceScanView } from "./useFaceLocalScan";

/* ═══════════════════════════════════════════════════════════════════════════
   THẺ "TÌM THEO KHUÔN MẶT" — tab Giao khách của album (giao diện mới).

   Máy chủ không còn tự quét (tốn CPU Vercel): studio bấm quét ngay tại đây và
   tab này làm việc đó. Logic ở ./useFaceLocalScan; phần hình tách riêng
   (FaceScanCardView) để màn xem trước dựng đủ mọi trạng thái.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function FaceScanCardV2({ albumId }: { albumId: string }) {
  const s = useFaceLocalScan(albumId);
  return <FaceScanCardView v={s} onStart={s.batDau} onPause={s.tamDung} />;
}

export function FaceScanCardView({ v, onStart, onPause }: { v: FaceScanView; onStart: () => void; onPause: () => void }) {
  const st = v.status;
  const xong = !!st && st.tong > 0 && st.conLai === 0;
  const dangChay = v.phase === "nap" || v.phase === "quet" || v.phase === "gom";
  const pct = st && st.tong > 0 ? Math.round((st.daQuet / st.tong) * 100) : 0;

  const badge =
    v.phase === "khoa-goi" || v.phase === "tai" || !st ? null : dangChay ? (
      <Badge tone="blue" dot>Đang quét</Badge>
    ) : xong ? (
      <Badge tone="green" dot>Đã quét xong</Badge>
    ) : st.daQuet > 0 ? (
      <Badge tone="amber" dot>Quét dở</Badge>
    ) : (
      <Badge tone="gray" dot>Chưa quét</Badge>
    );

  return (
    <Section
      icon={ScanFace}
      title="Tìm theo khuôn mặt"
      desc="Khách mở album chạm vào một khuôn mặt (hoặc chọn một ảnh của mình) là ra những ảnh có người đó. Việc quét chạy ngay trên máy này, không tốn máy chủ."
      actions={badge}
    >
      {v.phase === "tai" ? (
        <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Đang đọc tiến độ…</p>
      ) : v.phase === "khoa-goi" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx3)" }}>Có ở gói Photographer Plus và Studio.</p>
          <Link href="/dashboard/upgrade" className={btn("secondary", "sm")}>
            <Lock size={14} /> Nâng gói
          </Link>
        </div>
      ) : v.phase === "thieu-bang" ? (
        <p className="text-[13px] font-medium" style={{ color: "var(--am)" }}>
          Cần cập nhật cơ sở dữ liệu: mở /api/setup-sql/khuon-mat (đăng nhập tài khoản chủ studio), chép toàn bộ rồi chạy trong Supabase SQL Editor.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {st ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                <span className="font-semibold" data-testid="face-scan-progress">
                  Đã quét {st.daQuet.toLocaleString("vi-VN")} / {st.tong.toLocaleString("vi-VN")} ảnh
                </span>
                <span style={{ color: "var(--tx2)" }}>
                  {st.nguoi > 0 ? `Tìm được ${st.nguoi} người` : xong ? "Không tìm thấy người nào xuất hiện từ 3 ảnh trở lên" : "Chưa gom thành người"}
                </span>
              </div>
              <Progress value={pct} tone={xong ? "green" : "brand"} />
            </div>
          ) : null}

          {v.phase === "nap" ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>Đang tải bộ nhận diện về máy (khoảng 13 MB, chỉ lần đầu)… {v.napPct}%</p>
          ) : v.phase === "quet" ? (
            <p className="truncate text-[12.5px]" style={{ color: "var(--tx2)" }}>
              Đang quét{v.dang ? `: ${v.dang}` : "…"}
              {v.hongTam > 0 ? ` · ${v.hongTam} ảnh chưa tải được, sẽ thử lại sau` : ""}
            </p>
          ) : v.phase === "gom" ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx2)" }}>Đang gom khuôn mặt thành từng người…</p>
          ) : null}

          {dangChay ? (
            // Lời nhắc, không phải hộp thoại chặn: đóng tab thì việc quét dừng,
            // nhưng phần đã quét nằm trên máy chủ nên không mất gì.
            <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-medium" style={{ background: "var(--amS)", color: "var(--am)" }}>
              Giữ tab này mở cho tới khi quét xong. Đóng tab hoặc tắt máy thì việc quét dừng lại — phần đã quét vẫn được giữ, lần sau bấm quét tiếp.
            </p>
          ) : null}

          {v.loi ? (
            <p className="text-[12.5px] font-medium" style={{ color: "var(--rd)" }}>{v.loi}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            {v.phase === "quet" || v.phase === "nap" ? (
              <button type="button" onClick={onPause} className={btn("secondary", "sm")}>
                <Pause size={14} /> Tạm dừng
              </button>
            ) : v.phase === "gom" ? null : st && st.tong === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Album chưa có ảnh nào để quét.</p>
            ) : xong ? (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Thêm ảnh mới vào album thì phần mới sẽ được tự quét khi bạn mở dashboard (hoặc bấm quét ở đây).</p>
            ) : (
              <button type="button" onClick={onStart} className={btn("primary", "sm")}>
                <Play size={14} /> {st && st.daQuet > 0 ? "Quét tiếp trên máy này" : "Quét khuôn mặt trên máy này"}
              </button>
            )}
            {!dangChay && !xong && st && st.tong > 0 ? (
              <span className="text-[12px]" style={{ color: "var(--tx3)" }}>
                Khoảng {Math.max(1, Math.round((st.conLai * 0.8) / 60))} phút cho {st.conLai.toLocaleString("vi-VN")} ảnh còn lại, tuỳ máy.
              </span>
            ) : null}
          </div>

          {v.tai && v.tai.thang + v.tai.mayChu > 0 ? (
            <p className="text-[12px]" style={{ color: "var(--tx3)" }} data-testid="face-scan-nguon-anh">
              {v.tai.mayChu === 0
                ? `Ảnh quét tải thẳng từ Google (${v.tai.thang.toLocaleString("vi-VN")} ảnh) — không tốn lưu lượng máy chủ.`
                : v.tai.thang === 0
                  ? `Ảnh quét đi qua máy chủ (${v.tai.mayChu.toLocaleString("vi-VN")} ảnh) — Google không cho tải thẳng từ trình duyệt.`
                  : `Ảnh quét: ${v.tai.thang.toLocaleString("vi-VN")} tải thẳng từ Google, ${v.tai.mayChu.toLocaleString("vi-VN")} qua máy chủ.`}
            </p>
          ) : null}

          <TuQuetGhiChu />

          {st?.mayChuQuet ? (
            <p className="text-[12px]" style={{ color: "var(--tx3)" }}>Máy chủ cũng tự quét album đã phát hành vào ban đêm — bấm quét ở đây để có ngay.</p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

/**
 * Nhắc rằng máy này TỰ quét khi mở dashboard — và cho bật lại nếu studio đã
 * bấm "Tắt tự quét trên máy này" ở ô góc màn hình. Đọc localStorage sau khi
 * gắn (không lệch lúc hydrate).
 */
function TuQuetGhiChu() {
  const [tat, setTat] = useState<boolean | null>(null);
  useEffect(() => setTat(tuQuetDangTat()), []);
  if (tat === null) return null;
  return (
    <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
      {tat ? (
        <>
          Tự quét khi mở dashboard đang <b>tắt</b> trên máy này.{" "}
          <button
            type="button"
            className="font-medium underline"
            style={{ color: "var(--ac)" }}
            onClick={() => {
              batLaiTuQuet();
              setTat(false);
            }}
          >
            Bật lại
          </button>
        </>
      ) : (
        "Không cần vào từng album: khi bạn mở dashboard trên máy tính, máy sẽ tự lần lượt quét các album còn ảnh chưa quét."
      )}
    </p>
  );
}
