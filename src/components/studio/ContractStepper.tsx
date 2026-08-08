"use client";

import { Check } from "lucide-react";

/**
 * Stepper vòng đời hợp đồng — 7 bước của bản thiết kế, thay cho ô chọn trạng
 * thái ở màn chi tiết:
 *   Báo giá → Ký hợp đồng → Phân công → Nhận cọc → Chụp → Hậu kỳ → Giao album
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

const STEPS: { key: keyof ContractLifecycle; label: string }[] = [
  { key: "hasItems", label: "Báo giá" },
  { key: "signed", label: "Ký hợp đồng" },
  { key: "hasCrew", label: "Phân công" },
  { key: "hasDeposit", label: "Nhận cọc" },
  { key: "shot", label: "Chụp" },
  { key: "postDone", label: "Hậu kỳ" },
  { key: "delivered", label: "Giao album" },
];

export default function ContractStepper({ state, right }: { state: ContractLifecycle; right?: React.ReactNode }) {
  // Bước hiện tại = bước chưa xong đầu tiên. Xong hết thì không bước nào sáng.
  const currentIndex = STEPS.findIndex((s) => !state[s.key]);

  return (
    <div className="rounded-[14px] px-4 py-3.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {/* Trên điện thoại 7 bước xuống dòng thành một khối cao ngất, đẩy hết nội
            dung hợp đồng xuống dưới màn hình. Bản thiết kế cho CUỘN NGANG ở khổ
            hẹp; từ 900px trở lên mới xuống dòng như cũ. */}
        <div className="ck-steps flex min-w-0 flex-1 flex-nowrap items-center gap-x-1.5 gap-y-2.5 overflow-x-auto min-[900px]:flex-wrap min-[900px]:overflow-x-visible">
          {STEPS.map((s, i) => {
            const done = state[s.key];
            const current = i === currentIndex;
            return (
              <div key={s.key} className="flex flex-none items-center gap-1.5">
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
