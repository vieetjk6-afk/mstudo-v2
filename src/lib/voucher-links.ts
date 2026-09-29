import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { studioUrl } from "@/lib/hosts";

/**
 * Token đặt lịch công khai của studio — tạo nếu chưa có (giống màn Đặt lịch),
 * để link "Đặt lịch với voucher" không bao giờ trỏ vào một trang 404.
 * Phải gọi bằng service-role client.
 */
export async function ensureBookingToken(admin: SupabaseClient, ownerId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("booking_token").eq("id", ownerId).maybeSingle();
  if (data?.booking_token) return data.booking_token as string;
  const token = crypto.randomUUID().replace(/-/g, "");
  await admin.from("profiles").update({ booking_token: token }).eq("id", ownerId).is("booking_token", null);
  const { data: row } = await admin.from("profiles").select("booking_token").eq("id", ownerId).maybeSingle();
  return (row?.booking_token as string | null) ?? null;
}

/** Link đặt lịch điền sẵn mã voucher. */
export function voucherBookingUrl(host: string | null, bookingToken: string, code: string): string {
  return studioUrl(host, `/book/${bookingToken}?voucher=${encodeURIComponent(code)}`);
}
