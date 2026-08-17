import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDesktopOwner } from "@/lib/desktop/auth";
import { getStudioBrand } from "@/lib/studio-brand";
import { buildContractHtml, buildContractDocx, contractBaseName, asciiName, type ContractDocData } from "@/lib/desktop/contract-doc";
import { contractFolderSegments } from "@/lib/desktop/contract-path";

export const dynamic = "force-dynamic";

/**
 * File hợp đồng cho MStudo Desktop:
 *   GET /api/desktop/contracts/[id]?format=html   → bản in A4 (client chuyển PDF, giữ ảnh chữ ký)
 *   GET /api/desktop/contracts/[id]?format=docx   → bản Word soạn thảo lại được
 *   GET /api/desktop/contracts/[id]               → JSON dữ liệu đầy đủ
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return await handle(req, params, auth.ownerId);
  } catch (e) {
    // Lộ nguyên nhân thật ra client để chẩn đoán (thay vì 500 rỗng).
    return NextResponse.json({ error: (e as Error)?.message || String(e) }, { status: 500 });
  }
}

async function handle(req: Request, params: { id: string }, ownerId: string) {
  const auth = { ownerId };
  const db = createAdminClient();

  const { data: contract } = await db
    .from("studio_contracts")
    .select(
      "id, owner_id, code, title, client_name, client_phone, client_email, shoot_type, service_id, event_date, event_time, location, status, deposit, note, client_signed_name, client_signature, client_signed_at, studio_signed_name, studio_signature, studio_signed_at, created_at, updated_at"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!contract || contract.owner_id !== auth.ownerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [{ data: items }, { data: payments }, { data: ownerObj }, brand] = await Promise.all([
    db.from("contract_items").select("name, qty, unit_price, position").eq("contract_id", contract.id).order("position"),
    db.from("contract_payments").select("amount, kind, paid_at, note").eq("contract_id", contract.id).order("paid_at"),
    db.from("profiles").select("full_name, email, pl_phone, pl_bank_holder, pl_bank_account, pl_bank_name").eq("id", auth.ownerId).maybeSingle(),
    getStudioBrand(db, auth.ownerId),
  ]);

  const data: ContractDocData = {
    studio: {
      name: brand.name || ownerObj?.full_name || "Studio",
      logo: brand.logoUrl,
      phone: ownerObj?.pl_phone,
      email: ownerObj?.email,
      bankHolder: ownerObj?.pl_bank_holder,
      bankAccount: ownerObj?.pl_bank_account,
      bankName: ownerObj?.pl_bank_name,
    },
    contract,
    items: items ?? [],
    payments: payments ?? [],
  };

  const format = new URL(req.url).searchParams.get("format") || "json";
  const base = contractBaseName(contract);

  if (format === "html") {
    return new NextResponse(buildContractHtml(data), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (format === "docx") {
    const bytes = await buildContractDocx(data);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${asciiName(base)}.docx"; filename*=UTF-8''${encodeURIComponent(base)}.docx`,
        "Cache-Control": "no-store",
      },
    });
  }
  // Đường dẫn [Loại dịch vụ, Thang N?, Tên hợp đồng] để desktop lưu file HĐ cùng
  // cấu trúc với thư mục ảnh/video.
  const pathSegments = await contractFolderSegments(db, contract, base);
  return NextResponse.json({ ...data, file_base: base, path_segments: pathSegments });
}
