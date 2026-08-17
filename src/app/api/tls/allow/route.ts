import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_HOST, APP_HOST, IMG_HOST, MAIN_HOST, THIEP_HOST } from "@/lib/hosts";

export const dynamic = "force-dynamic";

/**
 * Chốt chặn cấp chứng chỉ HTTPS cho Caddy (on-demand TLS) khi chạy trên VPS.
 *
 * Caddy gọi `GET /api/tls/allow?domain=<host>` TRƯỚC khi xin chứng chỉ
 * Let's Encrypt cho một tên miền nó chưa biết. Trả 200 = được phép, mọi mã
 * khác = từ chối.
 *
 * Vì sao bắt buộc phải có: không chốt chặn thì bất kỳ ai trỏ tên miền rác về IP
 * VPS cũng khiến Caddy đi xin chứng chỉ. Vài trăm lần như vậy là Let's Encrypt
 * khoá rate-limit CẢ MÁY CHỦ trong một tuần — kể cả mstudo.com cũng không gia
 * hạn được. Nên endpoint này fail-closed: nghi ngờ thì từ chối.
 *
 * Được phép:
 *   - các host hệ thống (mstudo.com, img./admin./thiep./album./www.)
 *   - subdomain của studio: <sub>.mstudo.com có trong bảng `sites`
 *   - tên miền riêng của studio: có trong sites.custom_domain
 *
 * Lưu ý về `custom_domain_verified`: ta cấp chứng chỉ cho cả domain CHƯA verify.
 * Đó không phải lỗ hổng — Caddy chỉ xin được chứng chỉ nếu DNS của tên miền đó
 * đã thực sự trỏ về VPS này, mà chỉ chủ tên miền mới làm được. Nếu đòi verified
 * trước thì không bao giờ cấp được lần đầu (gà và trứng).
 */

const norm = (d: string) => d.trim().toLowerCase().replace(/\.$/, "").split(":")[0];

/** So sánh chuỗi không rò rỉ thông tin qua thời gian thực thi. */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function systemHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const h of [MAIN_HOST, APP_HOST, IMG_HOST, ADMIN_HOST, THIEP_HOST]) {
    if (h) hosts.add(norm(h));
  }
  if (MAIN_HOST) hosts.add(`www.${norm(MAIN_HOST)}`);
  return hosts;
}

/** Từ chối, kèm lý do để đọc log Caddy cho dễ. */
function deny(reason: string) {
  return new NextResponse(reason, { status: 403 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = norm(url.searchParams.get("domain") || "");

  // ── 1. Token (tuỳ chọn) ────────────────────────────────────────────────────
  // Nếu đặt TLS_ASK_SECRET trong .env thì Caddyfile phải gọi kèm ?token=<đúng
  // chuỗi đó>. Không đặt thì bỏ qua bước này.
  //
  // Đây chỉ là lớp che thông tin, KHÔNG phải hàng rào chống lạm dụng chứng chỉ:
  // gọi được endpoint này cũng không khiến chứng chỉ nào được cấp — chỉ Caddy
  // mới xin chứng chỉ, và chỉ khi thực sự có người kết nối bằng tên miền đó.
  // Cái nó giấu là "tên miền X có trong hệ thống hay không".
  //
  // KHÔNG dùng cách đoán qua header X-Forwarded-*: Next.js tự thêm những header
  // đó vào MỌI request, kể cả lời gọi nội bộ từ Caddy — chặn theo header sẽ
  // chặn nhầm chính Caddy, và hậu quả là không tên miền nào lên được HTTPS.
  const wantToken = process.env.TLS_ASK_SECRET?.trim();
  if (wantToken && !sameSecret(url.searchParams.get("token") || "", wantToken)) {
    return deny("bad_token");
  }

  // ── 2. Kiểm tra hình dạng tên miền ─────────────────────────────────────────
  if (!domain || domain.length > 253) return deny("bad_domain");
  if (!/^([a-z0-9](-*[a-z0-9])*\.)+[a-z]{2,}$/.test(domain)) return deny("bad_domain");

  // ── 3. Host hệ thống ───────────────────────────────────────────────────────
  if (systemHosts().has(domain)) return new NextResponse("ok", { status: 200 });

  const db = createAdminClient();

  // ── 4. Subdomain của studio: <sub>.mstudo.com ──────────────────────────────
  if (MAIN_HOST && domain.endsWith(`.${norm(MAIN_HOST)}`)) {
    const sub = domain.slice(0, -(norm(MAIN_HOST).length + 1));
    // Chỉ nhận subdomain một cấp (abc.mstudo.com), không nhận a.b.mstudo.com.
    if (!sub || sub.includes(".")) return deny("bad_subdomain");
    const { data, error } = await db.from("sites").select("id").eq("subdomain", sub).maybeSingle();
    if (error) return deny("db_error");
    return data ? new NextResponse("ok", { status: 200 }) : deny("unknown_subdomain");
  }

  // ── 5. Tên miền riêng của studio ───────────────────────────────────────────
  const { data, error } = await db.from("sites").select("id").eq("custom_domain", domain).maybeSingle();
  if (error) return deny("db_error");
  return data ? new NextResponse("ok", { status: 200 }) : deny("unknown_domain");
}
