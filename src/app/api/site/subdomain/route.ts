import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAIN_HOST, subdomainError } from "@/lib/hosts";
import { ensureSubdomainHost, getWildcard, removeDomain, vercelConfigured, type HostState } from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

/**
 * Tên miền phụ của studio (<sub>.mstudo.com).
 *
 * Trước đây trình tạo website ghi thẳng `sites.subdomain` bằng supabase client
 * ở trình duyệt. Ghi xong là xong — không ai nói cho Vercel biết có host mới,
 * nên `<sub>.mstudo.com` chỉ chạy nếu project TÌNH CỜ đã có wildcard
 * `*.mstudo.com`. Thiếu wildcard thì studio mở link ra gặp trang lỗi của Vercel,
 * mà trong app chẳng có chỗ nào báo vì sao ("tạo domain không tự chạy được").
 *
 * Route này là chỗ lưu DUY NHẤT, và lưu xong thì lo luôn phần hạ tầng:
 *   POST { action: "set", subdomain } — kiểm tra tên, lưu, đăng ký host trên
 *        Vercel (bỏ qua nếu đã có wildcard), trả về tình trạng thật.
 *   POST { action: "status" }        — soi lại vì sao trang chưa chạy.
 *   POST { action: "remove" }        — bỏ tên miền phụ + gỡ host đã đăng ký.
 *
 * Quyền: dùng phiên của chính người dùng, RLS của bảng `sites` (owner_id =
 * auth.uid()) là hàng rào — giữ nguyên mức quyền như lúc còn ghi từ trình duyệt.
 */

type SiteRow = { id: string; subdomain: string | null; published: boolean };

/** Vì sao trang chưa chạy được — xếp theo thứ tự người dùng phải xử lý. */
type Blocker = "no_main_host" | "not_published" | HostState;

function hintFor(blocker: Blocker, host: string): string {
  switch (blocker) {
    case "no_main_host":
      return "Máy chủ chưa khai NEXT_PUBLIC_MAIN_HOST nên chưa có tên miền gốc để ghép.";
    case "not_published":
      return `Đã lưu ${host}. Bấm “Xuất bản” để trang chạy thật.`;
    case "manual":
      // KHÔNG gợi ý wildcard ở đây: Vercel chỉ cho thêm `*.<domain>` khi domain
      // dùng nameserver của chính Vercel (chứng chỉ wildcard phải xin qua
      // DNS-01). DNS để ở nơi khác thì wildcard kẹt mãi ở "Verification
      // Required" — bảo người ta đi thêm nó là đẩy họ vào ngõ cụt.
      return `Đã lưu ${host}. Máy chủ chưa nối API Vercel — thêm ${host} trong Vercel → Settings → Domains, hoặc khai VERCEL_TOKEN/VERCEL_PROJECT_ID để app tự đăng ký.`;
    case "pending":
      return `Đã lưu ${host} và đăng ký trên Vercel. Đang chờ DNS xác minh — thường vài phút, có thể tới vài giờ.`;
    case "conflict":
      return `${host} đang thuộc một project Vercel khác. Gỡ nó ở project kia rồi bấm “Kiểm tra”.`;
    case "ready":
      return `${host} đã chạy.`;
  }
}

/**
 * Gỡ host của tên miền phụ CŨ khỏi project Vercel sau khi studio đổi/bỏ tên.
 *
 * Không gỡ trong hai trường hợp:
 *   • Project đang dùng wildcard — host chưa từng được thêm riêng, mà lỡ tay
 *     gọi nhầm vào `*.mstudo.com` thì sập website của MỌI studio.
 *   • Tên đó vừa bị studio khác lấy — studio A đổi abc→xyz, studio B lập tức
 *     lấy "abc" và đăng ký host; cú DELETE chậm chân của A sẽ gỡ đúng host B
 *     vừa dựng. Hiếm, nhưng hỏng thì hỏng website của người không liên quan.
 *     Đọc bằng service-role vì RLS của `sites` chỉ cho mỗi người thấy dòng
 *     của mình, nên client thường luôn trả "không ai dùng".
 */
async function releaseSubdomainHost(prev: string): Promise<void> {
  if (!MAIN_HOST || !vercelConfigured()) return;
  const wildcard = await getWildcard(MAIN_HOST);
  if (wildcard.present && wildcard.verified) return;
  const { data } = await createAdminClient().from("sites").select("id").eq("subdomain", prev).maybeSingle();
  if (data) return;
  await removeDomain(`${prev}.${MAIN_HOST}`);
}

async function loadSite() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { db, user: null, site: null };
  const { data } = await db.from("sites").select("id, subdomain, published").eq("owner_id", user.id).maybeSingle();
  return { db, user, site: (data as SiteRow | null) ?? null };
}

/**
 * Lo cho host phục vụ được rồi trả về phần thân của response.
 *
 * Dùng chung cho "set" và "status" — có chủ đích: ensureSubdomainHost() gọi lại
 * bao nhiêu lần cũng không sao, nên "Kiểm tra" cũng là nút SỬA. Tên miền phụ đã
 * lưu từ trước (hồi còn ghi thẳng vào database, chưa ai đăng ký với Vercel) sẽ
 * được đăng ký ngay ở lượt hỏi đầu tiên thay vì đứng im báo lỗi mãi.
 */
async function serveState(sub: string, published: boolean, force: boolean) {
  if (!MAIN_HOST) {
    return {
      subdomain: sub, host: null, published, configured: vercelConfigured(),
      state: "manual" as HostState, viaWildcard: false, verification: [] as unknown[],
      blocker: "no_main_host" as Blocker, hint: hintFor("no_main_host", sub),
    };
  }
  const host = `${sub}.${MAIN_HOST}`;
  const r = await ensureSubdomainHost(host, MAIN_HOST, force);
  const blocker: Blocker = r.state !== "ready" ? r.state : published ? "ready" : "not_published";
  return {
    subdomain: sub, host, published, configured: vercelConfigured(),
    state: r.state, viaWildcard: r.viaWildcard, verification: r.verification,
    blocker, hint: hintFor(blocker, host),
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; subdomain?: string; force?: boolean };
  const { db, user, site } = await loadSite();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!site) return NextResponse.json({ error: "no_site", hint: "Hãy tạo website trước." }, { status: 400 });

  /* ── status ───────────────────────────────────────────────────────────── */
  if (body.action === "status") {
    const sub = site.subdomain;
    if (!sub) return NextResponse.json({ subdomain: null, state: null, published: site.published, hint: "Chưa đặt tên miền phụ." });
    // force: người dùng bấm "Kiểm tra" chính là để bỏ qua bộ nhớ tạm wildcard —
    // thường họ vừa thêm wildcard/DNS xong và muốn biết ngay. Lượt hỏi tự động
    // lúc mở trình tạo thì dùng bộ nhớ tạm, đừng gọi Vercel mỗi lần mở builder.
    return NextResponse.json(await serveState(sub, site.published, body.force === true));
  }

  /* ── remove ───────────────────────────────────────────────────────────── */
  if (body.action === "remove") {
    const prev = site.subdomain;
    const { error } = await db.from("sites").update({ subdomain: null, updated_at: new Date().toISOString() }).eq("id", site.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (prev) await releaseSubdomainHost(prev);
    return NextResponse.json({ ok: true, subdomain: null });
  }

  /* ── set ──────────────────────────────────────────────────────────────── */
  const sub = (body.subdomain || "").trim().toLowerCase();
  const bad = subdomainError(sub);
  if (bad) return NextResponse.json({ error: "bad_subdomain", hint: bad }, { status: 400 });

  const prev = site.subdomain;
  if (sub !== prev) {
    const { error } = await db
      .from("sites")
      .update({ subdomain: sub, updated_at: new Date().toISOString() })
      .eq("id", site.id);
    if (error) {
      const taken = error.code === "23505" || /duplicate|unique/i.test(error.message);
      return NextResponse.json(
        { error: taken ? "taken" : error.message, hint: taken ? "Tên miền phụ đã có người dùng — chọn tên khác." : `Lỗi: ${error.message}` },
        { status: 400 }
      );
    }
  }

  // Đăng ký host mới TRƯỚC, gỡ host cũ sau: đổi tên miền phụ mà bước đăng ký
  // hỏng thì ít nhất studio còn host cũ đang chạy, chưa mất gì.
  const state = await serveState(sub, site.published, false);
  if (prev && prev !== sub) await releaseSubdomainHost(prev);
  return NextResponse.json({ ok: true, ...state });
}
