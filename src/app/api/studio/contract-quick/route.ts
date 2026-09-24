import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { todayVN } from "@/lib/date";
import { loadProviders, requestProvider, collectText } from "@/lib/vieetjk/providers";
import {
  buildQuickPrompt,
  extractJson,
  heuristicParse,
  mergeDrafts,
  normalizeDraft,
  type QuickContext,
} from "@/lib/contract-quick";

export const dynamic = "force-dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
   TẠO HỢP ĐỒNG NHANH — /api/studio/contract-quick

   Nhận đoạn chữ tự do studio dán vào + danh sách gói/dịch vụ/thợ đang hiện
   trên form, trả về bản nháp đã chuẩn hoá để form điền sẵn.

   Không ghi gì vào DB: hợp đồng vẫn chỉ được tạo khi studio soát lại và bấm
   tạo ở form như bình thường. Nên danh sách gói nhận thẳng từ client (form đã
   có sẵn) — đó chỉ là ngữ cảnh cho AI, và mọi id AI trả về đều bị kiểm lại
   theo đúng danh sách đó ở `normalizeDraft`, rồi ở form thêm một lần nữa.

   AI hỏng/chưa cấu hình → vẫn trả kết quả của bộ đọc quy tắc (`source: rules`)
   thay vì báo lỗi: studio vẫn đỡ được phần lớn việc gõ.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_TEXT = 4000;

/* eslint-disable @typescript-eslint/no-explicit-any */
function readContext(body: any): QuickContext {
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n) : []);
  const s = (v: unknown, n = 200) => (typeof v === "string" ? v.slice(0, n) : "");
  return {
    today: todayVN(),
    packages: arr(body?.packages, 300)
      .map((p: any) => ({ id: s(p?.id, 64), name: s(p?.name), price: Number(p?.price) || 0 }))
      .filter((p) => p.id && p.name),
    services: arr(body?.services, 60)
      .map((x: any) => ({ id: s(x?.id, 64), name: s(x?.name) }))
      .filter((x) => x.id && x.name),
    crew: arr(body?.crew, 150)
      .map((c: any) => ({ id: s(c?.id, 64), name: s(c?.name, 120), role: s(c?.role, 40) || undefined }))
      .filter((c) => c.id && c.name),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Mỗi lần gọi là một lượt AI tính tiền — chặn bấm liên tục.
  const who = (profile.actingUserId as string | undefined) || profile.id;
  if (!rateLimit(`contract-quick:${who}`, 20, 60_000)) {
    return NextResponse.json({ error: "Bấm hơi nhanh — đợi một chút rồi thử lại." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) return NextResponse.json({ error: "Chưa nhập thông tin hợp đồng." }, { status: 400 });

  const ctx = readContext(body);
  const rules = heuristicParse(text, ctx);

  const providers = loadProviders();
  if (providers.length === 0) {
    return NextResponse.json({ draft: rules, source: "rules", today: ctx.today });
  }

  const system = buildQuickPrompt(ctx);
  const debug: string[] = [];
  for (const p of providers) {
    try {
      const res = await requestProvider(p, system, [{ role: "user", content: text }]);
      if (!res.ok) {
        debug.push(`${p.label}: ${res.status}`);
        continue;
      }
      const { text: out, reason } = await collectText(res, p);
      const parsed = extractJson(out);
      if (!parsed) {
        debug.push(`${p.label}: not_json${reason ? ` (${reason})` : ""}`);
        continue;
      }
      const ai = normalizeDraft(parsed, ctx);
      return NextResponse.json({ draft: mergeDrafts(ai, rules), source: "ai", today: ctx.today });
    } catch (e) {
      debug.push(`${p.label}: ${(e as Error)?.message || "net"}`);
    }
  }
  console.warn("[contract-quick] AI không trả lời được, dùng bộ đọc quy tắc:", debug.join(" | "));
  return NextResponse.json({ draft: rules, source: "rules", today: ctx.today });
}
