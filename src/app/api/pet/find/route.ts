import { NextResponse } from "next/server";
import { requireStudio, requireUser, getProfileById } from "@/lib/auth-guards";
import { createClient } from "@/lib/supabase/server";
import { durableAllowed } from "@/lib/rate-limit";
import { fmtDate } from "@/lib/date";
import { matchScore, queryTerms, type Entity } from "@/lib/pet-command";

export const dynamic = "force-dynamic";

/**
 * Bé Máy Ảnh tìm theo tên khi studio ra lệnh "mở hợp đồng chị Lan", "mở album
 * Minh Thư"… (components/PetBuddy · luật hiểu câu ở @/lib/pet-command).
 *
 *   GET ?type=contract|quote|album|all&q=… → { results: [{ type, id, title, sub, href }] }
 *
 * Đọc bằng client CÓ PHIÊN (RLS), không phải service-role: nhân viên chỉ tìm
 * thấy đúng những hợp đồng / album họ vốn được xem, theo phân quyền sẵn có.
 *
 * So khớp làm ở đây, không bằng `ilike` của Postgres: người dùng hay gõ không
 * dấu ("chi lan") trong khi dữ liệu có dấu, mà database không chắc có
 * extension unaccent. Đọc vài trăm dòng mới nhất (vài cột chữ) rồi so trên chuỗi
 * đã bỏ dấu là đủ nhanh và luôn đúng.
 */

type Result = { type: Entity; id: string; title: string; sub: string; href: string; score: number };

const SCAN = 800;
const LIMIT = 8;

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await durableAllowed(`pet-find:${user.id}`, 60, 60_000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "all";
  const terms = queryTerms((url.searchParams.get("q") ?? "").slice(0, 80));
  if (!terms.length) return NextResponse.json({ results: [] });

  const studio = await requireStudio("booking");
  const profile = studio ? null : await getProfileById(user.id);
  const ownerId = (studio?.id as string | undefined) ?? (profile?.studio_owner_id as string | null) ?? user.id;
  const tier = (studio?.studioTier as string | undefined) ?? "none";
  const canPaper = tier === "plus" || tier === "full";
  const want = (t: Entity) => type === "all" || type === t;

  const db = await createClient();
  const out: Result[] = [];

  const jobs: Promise<void>[] = [];
  if (want("contract") && canPaper) {
    jobs.push(
      (async () => {
        const { data } = await db
          .from("studio_contracts")
          .select("id, code, title, client_name, client_phone, event_date, status")
          .eq("owner_id", ownerId)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(SCAN);
        for (const r of (data ?? []) as Record<string, string | null>[]) {
          const score = matchScore(terms, [r.code, r.title, r.client_name, r.client_phone]);
          if (!score) continue;
          out.push({
            type: "contract",
            id: r.id!,
            title: r.client_name || r.title || "Hợp đồng",
            sub: [r.code, r.title !== r.client_name ? r.title : null, r.event_date ? fmtDate(r.event_date) : null].filter(Boolean).join(" · "),
            href: `/dashboard/studio/contracts/${r.id}`,
            score,
          });
        }
      })()
    );
  }
  if (want("quote") && canPaper) {
    jobs.push(
      (async () => {
        const { data } = await db
          .from("studio_quotes")
          .select("id, code, title, client_name, created_at")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(SCAN);
        for (const r of (data ?? []) as Record<string, string | null>[]) {
          const score = matchScore(terms, [r.code, r.title, r.client_name]);
          if (!score) continue;
          out.push({
            type: "quote",
            id: r.id!,
            title: r.client_name || r.title || "Báo giá",
            sub: [r.code, r.title !== r.client_name ? r.title : null, r.created_at ? fmtDate(r.created_at) : null].filter(Boolean).join(" · "),
            href: `/dashboard/studio/quotes/${r.id}`,
            score,
          });
        }
      })()
    );
  }
  if (want("album")) {
    jobs.push(
      (async () => {
        const { data } = await db
          .from("albums")
          .select("id, title, slug, created_at")
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(SCAN);
        for (const r of (data ?? []) as Record<string, string | null>[]) {
          const score = matchScore(terms, [r.title, r.slug]);
          if (!score) continue;
          out.push({
            type: "album",
            id: r.id!,
            title: r.title || "Album",
            sub: r.created_at ? `Tạo ${fmtDate(r.created_at)}` : "",
            href: `/dashboard/albums/${r.id}`,
            score,
          });
        }
      })()
    );
  }
  // Một loại lỗi (bảng thiếu, gói không đủ) không được chặn các loại khác.
  await Promise.allSettled(jobs);

  // Điểm cao trước; cùng điểm thì giữ thứ tự mới → cũ của từng loại.
  const results = out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.score - a.r.score || a.i - b.i)
    .slice(0, LIMIT)
    .map(({ r }) => ({ type: r.type, id: r.id, title: r.title, sub: r.sub, href: r.href }));
  return NextResponse.json({ results });
}
