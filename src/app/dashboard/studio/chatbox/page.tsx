import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import ChatboxConfig from "./ChatboxConfig";
import ChatboxConfigV2 from "./ChatboxConfigV2";
import { isUiV2 } from "@/lib/ui-server";
import AiProvidersEditor from "@/components/AiProvidersEditor";

/**
 * Cấu hình chatbox tư vấn website: lời chào + kiến thức/FAQ/luật riêng. Lưu ở
 * website_chat_config; API chat ghép vào system prompt để bot trả lời theo ý.
 * Bên dưới: key AI riêng của studio — chỉ chủ studio thấy (đó là tài khoản trả
 * tiền của studio, nhân viên không được thay).
 */
export default async function ChatboxConfigPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Tính năng này dành cho tài khoản có trang web &amp; chatbox tư vấn.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Nâng cấp gói</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("website_chat_config")
    .select("greeting, instructions")
    .eq("owner_id", profile.id)
    .maybeSingle();

  const canEditKeys = !profile.isStaff && (profile.actingRole === "owner" || profile.actingRole === "admin");

  // Giao diện mới: hai cột soạn | xem trước, key AI là khối riêng ở dưới.
  if (await isUiV2()) {
    return (
      <ChatboxConfigV2
        ownerId={profile.id}
        greeting={(data?.greeting as string | undefined) ?? ""}
        instructions={(data?.instructions as string | undefined) ?? ""}
        aiKeys={canEditKeys ? <AiProvidersEditor scope="studio" /> : null}
      />
    );
  }

  return (
    <>
      <ChatboxConfig
        ownerId={profile.id}
        greeting={(data?.greeting as string | undefined) ?? ""}
        instructions={(data?.instructions as string | undefined) ?? ""}
      />
      {canEditKeys && (
        <div className="mx-auto mt-6 max-w-3xl">
          <AiProvidersEditor scope="studio" />
        </div>
      )}
    </>
  );
}
