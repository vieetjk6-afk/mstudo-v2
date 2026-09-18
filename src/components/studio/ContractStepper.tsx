"use client";

import { Check } from "lucide-react";
import type { ContractKind } from "@/lib/contract-kind";

/**
 * Stepper vòng đời hợp đồng — 7 bước của bản thiết kế, thay cho ô chọn trạng
 * thái ở màn chi tiết:
 *   Báo giá → Ký hợp đồng → Phân công → Nhận cọc → Chụp → Hậu kỳ → Giao album
 *
 * BA BƯỚC CUỐI ĐỔI TÊN THEO NHÓM HỢP ĐỒNG. Hợp đồng makeup / thuê đồ không có
 * tấm ảnh nào: gọi bước cuối là "Giao album" thì thợ makeup nhìn vào không biết
 * mình đang ở đâu. Chỉ đổi CHỮ, ba mốc dữ liệu vẫn y nguyên (đã tới ngày làm
 * chưa, xong việc chưa, kết thúc chưa) nên không có logic nào phải sửa theo.
 *
 * Mỗi bước ĐƯỢC SUY RA TỪ DỮ LIỆU THẬT của hợp đồng (có hạng mục chưa, khách ký
 * chưa, đã phân công chưa, đã thu đồng nào chưa…), không phải một cột trạng
 * thái riêng — nên không bao giờ lệch với thực tế. Trạng thái enum trong DB
 * vẫn giữ nguyên và vẫn đổi được bằng ô chọn bên cạnh.
 */
export type ContractLifecycle = {
  hasItems: boolean;
  signed: boolean;
  hasCrew: boolean;
  hasDeposit: boolean;
  shot: boolean;
  postDone: boolean;
  delivered: boolean;
};

const DAU: { key: keyof ContractLifecycle; label: string }[] = [
  { key: "hasItems", label: "Báo giá" },
  { key: "signed", label: "Ký hợp đồng" },
  { key: "hasCrew", label: "Phân công" },
  { key: "hasDeposit", label: "Nhận cọc" },
];

/** Ba bước cuối, theo nhóm. Trọn gói giữ chữ của nghề ảnh vì có cả hai nghề. */
const CUOI: Record<ContractKind, { key: keyof ContractLifecycle; label: string }[]> = {
  shoot: [
    { key: "shot", label: "Chụp" },
    { key: "postDone", label: "Hậu kỳ" },
    { key: "delivered", label: "Giao album" },
  ],
  makeup: [
    { key: "shot", label: "Ngày làm" },
    { key: "postDone", label: "Trả đồ" },
    { key: "delivered", label: "Hoàn tất" },
  ],
  combo: [
    { key: "shot", label: "Chụp" },
    { key: "postDone", label: "Hậu kỳ" },
    { key: "delivered", label: "Giao album" },
  ],
};

export default function ContractStepper({
  state, right, kind = "shoot",
}: {
  state: ContractLifecycle;
  right?: React.ReactNode;
  kind?: ContractKind;
}) {
  const STEPS = [...DAU, ...CUOI[kind]];
  // Bước hiện tại = bước chưa xong đầu tiên. Xong hết thì không bước nào sáng.
  const currentIndex = STEPS.findIndex((s) => !state[s.key]);

  return (
    <div className="rounded-[14px] px-4 py-3.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-2.5">
          {STEPS.map((s, i) => {
            const done = state[s.key];
            const current = i === currentIndex;
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[11.5px] font-bold"
                  style={
                    done
                      ? { background: "var(--gn)", color: "#fff" }
                      : current
                        ? { background: "var(--ac)", color: "#fff" }
                        : { background: "var(--sf2)", color: "var(--tx3)", border: "1px solid var(--bd)" }
                  }
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className="whitespace-nowrap text-[12.5px]"
                  style={{
                    color: done ? "var(--gn)" : current ? "var(--ac)" : "var(--tx3)",
                    fontWeight: done || current ? 700 : 550,
                  }}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="mx-1 hidden h-px w-5 flex-none min-[900px]:block" style={{ background: done ? "var(--gn)" : "var(--bd)" }} />
                )}
              </div>
            );
          })}
        </div>
        {right ? <div className="flex flex-none items-center gap-2">{right}</div> : null}
      </div>
    </div>
  );
}
