import Link from "next/link";
import { requireStudio } from "@/lib/auth-guards";
import { listChannels, toPublic } from "@/lib/inbox/channels";
import { loadZalo } from "@/lib/zalo/config";
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

  const ownerId = profile.id as string;
  const [channels, zalo] = await Promise.all([listChannels(ownerId), loadZalo(ownerId)]);

  return (
    <ChannelsManager
      channels={channels.map(toPublic)}
      zaloReady={zalo?.status === "connected"}
      zaloChannel={zalo?.channel ?? null}
    />
  );
}
