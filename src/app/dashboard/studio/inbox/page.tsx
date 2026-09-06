import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags, inboxComingSoon } from "@/lib/feature-flags";
import { requireStudio } from "@/lib/auth-guards";
import { listConversations, listMessages, staffNames } from "@/lib/inbox/view";
import { listChannels, toPublic } from "@/lib/inbox/channels";
import InboxView from "./InboxView";

/**
 * HỘP THƯ HỢP NHẤT — khách nhắn từ Zalo, Facebook, Instagram hay chatbox
 * website đều về đây. AI trả lời trước; nhân viên bấm tiếp quản là bot im.
 *
 * Kế toán KHÔNG vào được: trực chat khách không thuộc việc của họ, và hội thoại
 * tư vấn thường có thông tin cá nhân của khách.
 */
export default async function InboxPage() {
  const profile = await requireStudio("booking");
  if (!profile || profile.actingRole === "accountant") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Photographer trở lên</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Hộp thư hợp nhất gom tin nhắn khách từ mọi mạng xã hội về một chỗ.
          </p>
          <Link href="/dashboard/upgrade" className="btn-primary mt-5">
            Nâng cấp gói
          </Link>
        </div>
      </div>
    );
  }

  // "Sắp ra mắt": khoá với studio; admin vẫn vào để hoàn thiện.
  if (inboxComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <MessageCircle size={28} className="mx-auto mb-3" style={{ color: "var(--brand)" }} />
          <h1 className="font-serif text-2xl font-medium">Hộp thư hợp nhất · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Khách nhắn từ Zalo, Facebook, Instagram, TikTok hay chatbox website sẽ đổ chung về một chỗ; trợ lý AI
            trả lời trước, nhân viên bấm một nút là tiếp quản. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng.
          </p>
        </div>
      </div>
    );
  }

  const ownerId = profile.id as string;
  const db = await createClient();
  const [conversations, staff, channels] = await Promise.all([
    listConversations(db, ownerId),
    staffNames(ownerId),
    listChannels(ownerId),
  ]);

  // Mở sẵn hội thoại đầu tiên kèm tin nhắn của nó, để màn hình không nháy một
  // khung rỗng rồi mới có nội dung — người trực chat mở màn này cả ngày.
  const first = conversations[0] ?? null;
  const firstMessages = first ? await listMessages(db, first.id) : [];

  return (
    <InboxView
      conversations={conversations}
      firstMessages={firstMessages}
      staff={staff}
      channels={channels.map(toPublic)}
      meId={profile.actingUserId as string}
      canManageChannels={["owner", "admin", "manager"].includes(profile.actingRole as string)}
    />
  );
}
