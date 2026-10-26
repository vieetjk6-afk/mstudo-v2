"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { Switch } from "@/components/v2/kit-client";

type Props = { ownerId: string; initial: boolean };

function useAutoEmail({ ownerId, initial }: Props) {
  const supabase = createClient();
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setSaving(true);
    await supabase.from("profiles").update({ auto_client_emails: next }).eq("id", ownerId);
    setSaving(false);
  }

  return { on, saving, toggle };
}

/** Owner opt-in: let the daily cron email clients (shoot reminder + review). */
export default function AutoEmailToggle(props: Props) {
  return useUiV2() ? <AutoEmailToggleV2 {...props} /> : <AutoEmailToggleV1 {...props} />;
}

function AutoEmailToggleV1(props: Props) {
  const { on, saving, toggle } = useAutoEmail(props);

  return (
    <div className="card mt-6 flex items-center justify-between gap-3 p-5">
      <div>
        <p className="flex items-center gap-2 font-medium"><Mail size={16} style={{ color: "var(--text3)" }} /> Tự động email cho khách</p>
        <p className="mt-1 text-xs" style={{ color: "var(--text2)" }}>
          Tự nhắc khách lịch chụp ngày mai &amp; xin đánh giá sau khi hoàn thành (gửi 07:00 mỗi sáng). {on ? "Đang bật." : "Đang tắt."}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        aria-pressed={on}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: on ? "var(--accent)" : "var(--surface2)", border: "1px solid var(--border2)" }}
      >
        <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ left: on ? 22 : 4, background: "#fff" }} />
      </button>
    </div>
  );
}

/** Giao diện mới: một thẻ gọn — icon, câu giải thích, công tắc của bộ khối. */
function AutoEmailToggleV2(props: Props) {
  const { on, saving, toggle } = useAutoEmail(props);

  return (
    <div className="v2-card flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <span className="v2-section-icon flex-none">
        <Mail size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <Switch
          checked={on}
          onChange={() => void toggle()}
          disabled={saving}
          label="Tự động email cho khách"
          desc={`Tự nhắc khách lịch chụp ngày mai & xin đánh giá sau khi hoàn thành (gửi 07:00 mỗi sáng). ${on ? "Đang bật." : "Đang tắt."}`}
        />
      </div>
    </div>
  );
}
