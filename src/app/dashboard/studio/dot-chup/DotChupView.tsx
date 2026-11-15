"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { setUiVersion } from "@/components/v2/ui-switch";
import type { DotChupProps } from "./types";

const DotChupV2 = dynamic(() => import("./DotChupV2"));

/** Màn này CHỈ có ở giao diện mới — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function DotChupView(props: DotChupProps) {
  return useUiV2() ? <DotChupV2 {...props} /> : <OldUiNotice canSwitch={props.canSwitchUi} />;
}

/** Bản cũ: không dựng lại tính năng, chỉ nói rõ nó ở đâu và cho chuyển ngay. */
function OldUiNotice({ canSwitch }: { canSwitch: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="card p-8">
        <h1 className="font-serif text-2xl font-medium">Chụp theo khung giờ</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
          Tính năng này chỉ có ở giao diện mới. Dữ liệu của bạn giữ nguyên, quay lại bản cũ lúc nào cũng được.
        </p>
        {canSwitch ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setUiVersion("v2");
              router.refresh();
            }}
            className="btn-primary mt-5 inline-flex items-center gap-2"
          >
            <Sparkles size={16} /> {busy ? "Đang chuyển…" : "Dùng giao diện mới"}
          </button>
        ) : (
          <p className="mt-4 text-sm" style={{ color: "var(--text2)" }}>
            Giao diện mới đang được mở dần cho các studio — tính năng sẽ có khi tài khoản của bạn được bật.
          </p>
        )}
      </div>
    </div>
  );
}
