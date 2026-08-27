import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertChannel } from "@/lib/inbox/channels";
import {
  exchangeCodeForPages,
  ownerFromMetaState,
  pageSecret,
  subscribePageWebhook,
} from "@/lib/inbox/adapters/meta-oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Facebook gọi về sau khi studio chọn Trang.
 *
 * Nối TẤT CẢ Trang studio đã tích trong màn hình của Facebook (chỉ những Trang
 * đó mới nằm trong `/me/accounts`), kèm tài khoản Instagram liên kết. Không
 * dựng thêm màn chọn Trang của riêng mình: studio vừa chọn xong ở bước trước,
 * bắt chọn lại là làm dài thêm đúng cái luồng ta đang rút ngắn.
 *
 * Luôn quay về màn Kênh kèm tham số kết quả — kể cả khi hỏng. Bỏ mặc người dùng
 * ở một trang trắng hoặc một cục JSON là cách chắc chắn nhất khiến họ tưởng đã
 * nối xong.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const denied = searchParams.get("error");
  const ownerId = ownerFromMetaState(state);

  const back = (q: string) =>
    NextResponse.redirect(new URL(`/dashboard/studio/inbox/ket-noi?${q}`, req.url));

  // Studio bấm "Huỷ" trên màn hình Facebook — không phải lỗi, đừng doạ họ.
  if (denied) return back("meta=cancelled");
  if (!code || !ownerId) return back("meta=error");

  let pages;
  try {
    pages = await exchangeCodeForPages(code);
  } catch (e) {
    console.error("[inbox/meta] đổi code hỏng:", (e as Error)?.message);
    return back("meta=error");
  }

  if (pages.length === 0) return back("meta=no_page");

  let connected = 0;
  let igConnected = 0;
  const warnings: string[] = [];

  for (const page of pages) {
    const secret = pageSecret(page.accessToken);

    // Đăng ký webhook TRƯỚC khi báo thành công: có token mà chưa đăng ký thì
    // kênh trông như đã nối nhưng tin khách không bao giờ tới.
    const sub = await subscribePageWebhook(page.id, page.accessToken);
    if (!sub.ok) warnings.push(`${page.name}: ${sub.error ?? "không đăng ký được webhook"}`);

    const res = await upsertChannel({
      ownerId,
      platform: "facebook",
      externalId: page.id,
      name: page.name,
      secret,
    });
    if (!res.ok) {
      // "taken" = Trang này studio khác đã nối. Nói ra ở màn Kênh, đừng im lặng.
      warnings.push(`${page.name}: ${res.error === "taken" ? "đã được tài khoản khác nối" : res.error}`);
      continue;
    }
    connected += 1;

    // Instagram DM đi qua CHÍNH Page Access Token này — không phải hỏi thêm gì.
    if (page.instagram) {
      const ig = await upsertChannel({
        ownerId,
        platform: "instagram",
        externalId: page.instagram.id,
        name: page.instagram.username ? `@${page.instagram.username}` : "Instagram",
        secret,
      });
      if (ig.ok) igConnected += 1;
    }

    if (!sub.ok) {
      await createAdminClient()
        .from("inbox_channels")
        .update({ last_error: sub.error ?? "chưa đăng ký được webhook" })
        .eq("platform", "facebook")
        .eq("external_id", page.id);
    }
  }

  if (connected === 0) {
    console.error("[inbox/meta] không nối được Trang nào:", warnings.join(" | "));
    return back("meta=error");
  }

  const q = new URLSearchParams({ meta: "connected", pages: String(connected) });
  if (igConnected) q.set("ig", String(igConnected));
  if (warnings.length) {
    console.warn("[inbox/meta] nối xong nhưng có cảnh báo:", warnings.join(" | "));
    q.set("warn", "1");
  }
  return back(q.toString());
}
