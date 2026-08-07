import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import ChatboxConfig from "./ChatboxConfig";

/**
 * Cấu hình chatbox tư vấn website: lời chào + kiến thức/FAQ/luật riêng. Lưu ở
 * website_chat_config; API chat ghép vào system prompt để bot trả lời theo ý.
 */
export default async function ChatboxConfigPage() {
  const profile = await requireStudio("booking");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] px-6 py-9 text-center" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <p className="text-[16px] font-bold" style={{ letterSpacing: "-.3px" }}>Cần gói Photographer trở lên</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Trang web &amp; chatbox tư vấn nằm trong gói Photographer — nâng gói là dùng được ngay, cấu hình cũ giữ nguyên.
        </p>
        <a
          href="/dashboard/upgrade"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          Nâng cấp gói
        </a>
      </div>
    );
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("website_chat_config")
    .select("greeting, instructions")
    .eq("owner_id", profile.id)
    .maybeSingle();

  return (
    <ChatboxConfig
      ownerId={profile.id}
      greeting={(data?.greeting as string | undefined) ?? ""}
      instructions={(data?.instructions as string | undefined) ?? ""}
    />
  );
}
