import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const TEAM = process.env.VERCEL_TEAM_ID;

function vercelUrl(path: string) {
  const q = TEAM ? `${path.includes("?") ? "&" : "?"}teamId=${TEAM}` : "";
  return `https://api.vercel.com${path}${q}`;
}
async function vercel(path: string, init?: RequestInit) {
  const res = await fetch(vercelUrl(path), {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data } as { ok: boolean; status: number; data: Record<string, unknown> };
}

const norm = (d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const valid = (d: string) => /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) && !d.endsWith(".mstudo.com");

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

  const configured = !!(TOKEN && PROJECT);
  // Generic DNS guidance (Vercel's standard targets) shown to the studio.
  const dns = [
    { type: "A", name: "@ (tên miền gốc)", value: "76.76.21.21" },
    { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
  ];

  if (body.action === "remove") {
    const prev = site.custom_domain as string | null;
    await db.from("sites").update({ custom_domain: null, custom_domain_verified: false }).eq("id", site.id);
    if (configured && prev) await vercel(`/v9/projects/${PROJECT}/domains/${prev}`, { method: "DELETE" }).catch(() => {});
    return NextResponse.json({ ok: true, custom_domain: null, custom_domain_verified: false });
  }

  if (body.action === "verify") {
    const domain = site.custom_domain as string | null;
    if (!domain) return NextResponse.json({ error: "no_domain" }, { status: 400 });
    if (!configured) {
      return NextResponse.json({ verified: false, configured: false, dns, hint: "Máy chủ chưa cấu hình Vercel API — thêm domain thủ công trong Vercel rồi trang sẽ tự chạy." });
    }
    const r = await vercel(`/v9/projects/${PROJECT}/domains/${domain}`);
    const verified = !!r.data?.verified;
    if (verified) await db.from("sites").update({ custom_domain_verified: true }).eq("id", site.id);
    return NextResponse.json({ verified, configured: true, verification: r.data?.verification ?? [], dns });
  }

  // action === "set"
  const domain = norm(body.domain || "");
  if (!valid(domain)) return NextResponse.json({ error: "bad_domain", hint: "Nhập tên miền hợp lệ, ví dụ studio.com" }, { status: 400 });

  const { error } = await db.from("sites").update({ custom_domain: domain, custom_domain_verified: false }).eq("id", site.id);
  if (error) return NextResponse.json({ error: error.message.includes("duplicate") ? "domain_taken" : error.message }, { status: 400 });

  let verified = false;
  let verification: unknown[] = [];
  if (configured) {
    const add = await vercel(`/v10/projects/${PROJECT}/domains`, { method: "POST", body: JSON.stringify({ name: domain }) });
    // Already added / just added — read verification state.
    verified = !!add.data?.verified;
    verification = (add.data?.verification as unknown[]) ?? [];
    if (verified) await db.from("sites").update({ custom_domain_verified: true }).eq("id", site.id);
  }
  return NextResponse.json({ ok: true, custom_domain: domain, verified, configured, verification, dns });
}
