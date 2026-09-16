import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";
import { MAIN_HOST } from "@/lib/hosts";
import { addDomain, getDomain, removeDomain, vercelConfigured } from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

const norm = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/**
 * Tên miền riêng hợp lệ? Loại luôn tên miền phụ của chính nền tảng: đó là việc
 * của /api/site/subdomain, và khai ở đây thì studio khác cũng khai được y hệt.
 * Dùng MAIN_HOST thay vì chuỗi "mstudo.com" cứng — bản chạy trên tên miền khác
 * (hoặc bản thử) trước đây lọt lưới này.
 */
const valid = (d: string) =>
  /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) && (!MAIN_HOST || (d !== MAIN_HOST && !d.endsWith(`.${MAIN_HOST}`)));

/**
 * Studio custom-domain management. Saves the domain on the owner's site and —
 * when Vercel API env is configured — registers it on the hosting project and
 * checks verification. Without env, it just stores the domain and returns
 * manual DNS guidance.
 *   POST { action: "set", domain } | { action: "verify" } | { action: "remove" }
 */
export async function POST(req: Request) {
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; domain?: string };
  const db = await createClient();
  const { data: site } = await db.from("sites").select("id, custom_domain").eq("owner_id", profile.id).maybeSingle();
  if (!site) return NextResponse.json({ error: "no_site", hint: "Hãy tạo website trước." }, { status: 400 });

  const configured = vercelConfigured();
  // Generic DNS guidance (Vercel's standard targets) shown to the studio.
  const dns = [
    { type: "A", name: "@ (tên miền gốc)", value: "76.76.21.21" },
    { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
  ];

  if (body.action === "remove") {
    const prev = site.custom_domain as string | null;
    await db.from("sites").update({ custom_domain: null, custom_domain_verified: false }).eq("id", site.id);
    if (configured && prev) await removeDomain(prev);
    return NextResponse.json({ ok: true, custom_domain: null, custom_domain_verified: false });
  }

  if (body.action === "verify") {
    const domain = site.custom_domain as string | null;
    if (!domain) return NextResponse.json({ error: "no_domain" }, { status: 400 });
    if (!configured) {
      return NextResponse.json({ verified: false, configured: false, dns, hint: "Máy chủ chưa cấu hình Vercel API — thêm domain thủ công trong Vercel rồi trang sẽ tự chạy." });
    }
    const info = await getDomain(domain);
    if (info.verified) await db.from("sites").update({ custom_domain_verified: true }).eq("id", site.id);
    return NextResponse.json({ verified: info.verified, configured: true, verification: info.verification, dns });
  }

  // action === "set"
  const domain = norm(body.domain || "");
  if (!valid(domain)) return NextResponse.json({ error: "bad_domain", hint: "Nhập tên miền hợp lệ, ví dụ studio.com" }, { status: 400 });

  const { error } = await db.from("sites").update({ custom_domain: domain, custom_domain_verified: false }).eq("id", site.id);
  if (error) return NextResponse.json({ error: error.message.includes("duplicate") ? "domain_taken" : error.message }, { status: 400 });

  let verified = false;
  let verification: unknown[] = [];
  let conflict = false;
  if (configured) {
    // Already added / just added — read verification state.
    const info = await addDomain(domain);
    verified = info.verified;
    verification = info.verification;
    conflict = !!info.conflict;
    if (verified) await db.from("sites").update({ custom_domain_verified: true }).eq("id", site.id);
  }
  return NextResponse.json({
    ok: true, custom_domain: domain, verified, configured, verification, dns,
    ...(conflict ? { hint: `${domain} đang thuộc một project Vercel khác — gỡ nó ở project kia rồi bấm “Kiểm tra”.` } : {}),
  });
}
