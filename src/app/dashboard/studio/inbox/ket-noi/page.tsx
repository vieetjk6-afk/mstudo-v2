import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, inboxComingSoon } from "@/lib/feature-flags";
import { listChannels, toPublic } from "@/lib/inbox/channels";
import { loadZalo } from "@/lib/zalo/config";
import { metaOAuthConfigured } from "@/lib/inbox/adapters/meta-oauth";
import ChannelsManager from "./ChannelsManager";

/**
 * Nối các kênh mạng xã hội vào hộp thư. Chỉ chủ studio và quản lý — đây là nơi
 * dán Page Access Token, tức chìa khoá nhắn tin thay mặt thương hiệu.
 */
export default async function InboxChannelsPage() {
  const profile = await requireStudio("booking");
  const role = (profile?.actingRole as string) ?? "";
  if (!profile || !["owner", "admin", "manager"].includes(role)) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không có quyền</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Chỉ chủ studio và quản lý được nối kênh mạng xã hội.
          </p>
          <Link href="/dashboard/studio/inbox" className="btn-ghost mt-5">
            Về hộp thư
          </Link>
        </div>
      </div>
    );
  }

  // Cùng hàng rào với màn Hộp thư: khoá màn này mà để màn nối kênh mở thì studio
  // vẫn dán được token vào một tính năng chưa bật.
  if (inboxComingSoon(await getFeatureFlags()) && role !== "admin") notFound();

  const ownerId = profile.id as string;
  const [channels, zalo] = await Promise.all([listChannels(ownerId), loadZalo(ownerId)]);

  return (
    <ChannelsManager
      channels={channels.map(toPublic)}
      zaloReady={zalo?.status === "connected"}
      zaloChannel={zalo?.channel ?? null}
      // Nền tảng đã khai Meta App chưa. Chưa thì giấu nút một-chạm đi và chỉ để
      // đường thủ công — thà không có nút còn hơn có một nút bấm vào ra lỗi.
      metaOAuthReady={metaOAuthConfigured()}
    />
  );
}
