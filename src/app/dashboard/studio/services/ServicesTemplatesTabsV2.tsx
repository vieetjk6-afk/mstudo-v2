"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, Lock, Plus, ShieldCheck, Zap } from "lucide-react";
import { Empty, PageHead, Stack, btn } from "@/components/v2/kit";
import { Tabs } from "@/components/v2/kit-client";
import type { StudioService } from "@/lib/types";
import type { TemplateWithItems } from "../templates/TemplatesManager";
import { useTemplates } from "../templates/useTemplates";
import TemplatesV2 from "../templates/TemplatesV2";
import { useServices } from "./useServices";
import ServicesV2 from "./ServicesV2";
import { SaveBarV2, ToastV2 } from "./settings-v2";

/* ═══════════════════════════════════════════════════════════════════════════
   DỊCH VỤ & ĐIỀU KHOẢN — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ServicesTemplatesTabs + hai thẻ chính sách / việc tự động mà page.tsx đặt
   bên dưới ở bản cũ. Khác ở cách sắp xếp:
     • Bốn tab gạch chân cho bốn câu hỏi "studio làm việc theo luật nào":
       Điều khoản dịch vụ · Mẫu hợp đồng · Chính sách · Việc tự động. Hai tab
       sau chỉ có khi page.tsx truyền vào (chỉ chủ studio — như bản cũ).
     • Hai tab đầu là màn "danh sách | trình sửa"; nút chính ở đầu trang đổi
       theo tab (Thêm dịch vụ / Mẫu mới).
     • Sửa mà chưa lưu → thanh Lưu dính đáy màn, chuyển mục thì hỏi trước.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "services" | "templates" | "policy" | "automations";

export default function ServicesTemplatesTabsV2({
  ownerId,
  services,
  templates,
  canUseTemplates,
  initialTab = "services",
  policy,
  automations,
}: {
  ownerId: string;
  services: StudioService[];
  templates: TemplateWithItems[];
  canUseTemplates: boolean;
  initialTab?: "services" | "templates";
  /** Thẻ chính sách studio (chỉ chủ studio) — page.tsx dựng sẵn. */
  policy?: React.ReactNode;
  /** Thẻ việc tự động (chỉ chủ studio) — page.tsx dựng sẵn. */
  automations?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(initialTab === "templates" && canUseTemplates ? "templates" : "services");
  const s = useServices(ownerId, services);
  const t = useTemplates(ownerId, templates);

  const desc: Record<Tab, string> = {
    services: "Mỗi dịch vụ có bộ điều khoản riêng — tạo hợp đồng hay báo giá chọn dịch vụ nào thì áp điều khoản của dịch vụ đó.",
    templates: "Mẫu điền sẵn hạng mục, giá và điều khoản khi tạo hợp đồng mới.",
    policy: "Luật chạy ngầm của studio: hạn lưu ảnh gốc, hiệu lực báo giá, tiền cọc, giới thiệu khách, chính sách huỷ.",
    automations: "Việc studio tự làm theo mốc hợp đồng: nhắc lịch, nhắc công nợ, gửi Zalo, tạo thiệp…",
  };

  const action =
    tab === "services" && s.services.length > 0 ? (
      <button type="button" onClick={() => void s.createService()} disabled={s.busy} className={btn("primary")}>
        <Plus size={17} /> Thêm dịch vụ
      </button>
    ) : tab === "templates" && canUseTemplates && t.templates.length > 0 ? (
      <button type="button" onClick={() => void t.createTemplate()} disabled={t.busy} className={btn("primary")}>
        <Plus size={17} /> Mẫu mới
      </button>
    ) : null;

  const dot = (on: boolean) => (on ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--am)" }} title="Có thay đổi chưa lưu" /> : null);

  return (
    <Stack>
      <PageHead desc={desc[tab]} actions={action} />

      <Tabs<Tab>
        label="Dịch vụ & điều khoản"
        value={tab}
        onChange={(v) => setTab(v)}
        options={[
          { value: "services", label: <>Điều khoản dịch vụ{dot(s.dirty)}</>, icon: ClipboardList, count: s.services.length },
          {
            value: "templates",
            label: (
              <>
                Mẫu hợp đồng
                {canUseTemplates ? dot(t.dirty) : <Lock size={13} style={{ color: "var(--tx3)" }} aria-label="Cần gói Studio" />}
              </>
            ),
            icon: FileText,
            count: canUseTemplates ? t.templates.length : undefined,
          },
          ...(policy ? [{ value: "policy" as const, label: "Chính sách", icon: ShieldCheck }] : []),
          ...(automations ? [{ value: "automations" as const, label: "Việc tự động", icon: Zap }] : []),
        ]}
      />

      {tab === "services" ? (
        <ServicesV2 s={s} onCreate={() => void s.createService()} />
      ) : tab === "templates" ? (
        canUseTemplates ? (
          <TemplatesV2 t={t} onCreate={() => void t.createTemplate()} />
        ) : (
          <div className="v2-card">
            <Empty
              icon={Lock}
              title="Mẫu hợp đồng dành cho gói Studio"
              hint="Lưu sẵn hạng mục, giá và điều khoản cho các gói hay bán — tạo hợp đồng chỉ cần chọn mẫu."
              action={
                <Link href="/dashboard/upgrade" className={btn("primary")}>
                  Xem gói Studio
                </Link>
              }
            />
          </div>
        )
      ) : tab === "policy" ? (
        <div className="max-w-[920px]">{policy}</div>
      ) : (
        <div className="max-w-[920px]">{automations}</div>
      )}

      {/* Thanh lưu dính đáy: hiện cho tab đang mở khi có thay đổi chưa lưu. */}
      {tab === "services" ? (
        <SaveBarV2
          show={s.dirty}
          label={<>Dịch vụ “{s.name || "Dịch vụ"}” có thay đổi chưa lưu</>}
          saving={s.busy}
          onSave={() => void s.saveService()}
          onReset={s.reset}
        />
      ) : tab === "templates" && canUseTemplates ? (
        <SaveBarV2
          show={t.dirty}
          label={<>Mẫu “{t.name || "Mẫu"}” có thay đổi chưa lưu</>}
          saving={t.busy}
          onSave={() => void t.saveTemplate()}
          onReset={t.reset}
          saveLabel="Lưu mẫu"
        />
      ) : null}

      <ToastV2>{tab === "templates" ? t.msg : s.msg}</ToastV2>
    </Stack>
  );
}
