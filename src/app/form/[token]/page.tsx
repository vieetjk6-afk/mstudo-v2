import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { intakeIsWedding } from "@/lib/types";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

/**
 * Form điền thông tin trước buổi chụp — CÔNG KHAI, mở bằng intake_token (không
 * mật khẩu). Studio gửi link này cho khách qua Zalo kèm tin nhắc lịch.
 */
export default async function IntakeFormPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("owner_id, shoot_type, service_id, client_name, title, intake, intake_submitted_at")
    .eq("intake_token", params.token)
    .maybeSingle();

  if (!c) notFound();

  const [{ data: owner }, { data: svc }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", c.owner_id).maybeSingle(),
    c.service_id
      ? db.from("studio_services").select("name").eq("id", c.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <IntakeForm
      token={params.token}
      isWedding={intakeIsWedding(c.shoot_type, svc?.name ?? null)}
      clientName={c.client_name}
      title={c.title}
      studio={owner?.full_name ?? null}
      submitted={!!c.intake_submitted_at}
      // `intake` là cột jsonb: Supabase trả về kiểu rộng, IntakeForm mới là nơi
      // biết hình dạng thật. Ép qua kiểu prop của chính nó thay vì `any`.
      initial={(c.intake ?? null) as React.ComponentProps<typeof IntakeForm>["initial"]}
    />
  );
}
