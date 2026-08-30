import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDesktopOwner } from "@/lib/desktop/auth";
import { ensureContractDriveTree, wireContractAlbums, type ContractForDrive } from "@/lib/studio-drive";
import { syncAlbumPhotos } from "@/lib/album-sync";
import { deliverContractIfReady } from "@/lib/contract-delivery";
import { contractBaseName } from "@/lib/desktop/contract-doc";

export const dynamic = "force-dynamic";

/**
 * Chuẩn bị đồng bộ Drive cho 1 hợp đồng ĐÃ KÝ:
 *  - Tạo cây thư mục trên Drive studio (idempotent) + đặt JPG Goc/File ChinhSua công khai.
 *  - Tạo album chọn ảnh + gallery giao khách và gắn vào hợp đồng.
 *  - Trả sơ đồ cây { path, id, role, excluded } để client tạo thư mục local + upload.
 * Body: { contractId, resync?: boolean }. resync=true → đồng bộ lại ảnh 2 album
 * (gọi sau khi client tải xong ảnh vào JPG Goc / File ChinhSua).
 */
export async function POST(req: Request) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const contractId = body?.contractId;
  if (!contractId) return NextResponse.json({ error: "missing_contract" }, { status: 400 });

  const db = createAdminClient();
  const { data: contract } = await db
    .from("studio_contracts")
    .select(
      "id, owner_id, code, title, client_name, client_phone, event_date, shoot_type, service_id, status, client_signed_at, drive_folder_id, drive_tree, drive_make_photo, drive_make_video, selection_album_id, gallery_album_id"
    )
    .eq("id", contractId)
    .maybeSingle();
  if (!contract || contract.owner_id !== auth.ownerId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Hợp đồng đã sẵn sàng mới tạo thư mục: khách đã ký HOẶC studio đã duyệt / đang
  // thực hiện / hoàn thành (khớp bộ lọc ?drive=1 của /api/desktop/contracts).
  const driveReady = !!contract.client_signed_at || ["approved", "in_progress", "completed"].includes(contract.status || "");
  if (!driveReady) {
    return NextResponse.json({ error: "not_signed" }, { status: 409 });
  }

  const tree = await ensureContractDriveTree(auth.ownerId, contract as ContractForDrive);
  if ("error" in tree) return NextResponse.json({ error: tree.error }, { status: 409 });

  const albums = await wireContractAlbums(auth.ownerId, contract as ContractForDrive, tree.tree);

  // Hợp đồng đã hoàn thành mà album giao khách chưa có (ảnh chỉnh sửa lúc trước
  // còn trống): desktop vừa tải ảnh lên xong thì đây là lúc tạo album + báo khách.
  if (contract.status === "completed" && !albums.galleryAlbumId) {
    const d = await deliverContractIfReady(auth.ownerId, contract.id);
    if (d.album) {
      const { data: fresh } = await db
        .from("studio_contracts")
        .select("gallery_album_id")
        .eq("id", contract.id)
        .maybeSingle();
      albums.galleryAlbumId = (fresh?.gallery_album_id as string | null) ?? albums.galleryAlbumId;
    }
  }

  if (body?.resync) {
    const ids = [albums.selectionAlbumId, albums.galleryAlbumId].filter(Boolean) as string[];
    for (const id of ids) {
      try {
        await syncAlbumPhotos(db, id);
      } catch {
        /* bỏ qua — lần sau thử lại */
      }
    }
    await db.from("studio_contracts").update({ drive_synced_at: new Date().toISOString() }).eq("id", contract.id);
  }

  return NextResponse.json({
    folderId: tree.folderId,
    folderName: contractBaseName(contract as any),
    // Đường dẫn tương đối [Gốc, Loại dịch vụ, Thang N, Tên hợp đồng] để desktop
    // lồng thư mục local y hệt cấu trúc trên Drive.
    pathSegments: tree.pathSegments,
    tree: tree.tree,
    hasVideo: contract.drive_make_video === true,
    selectionAlbumId: albums.selectionAlbumId,
    galleryAlbumId: albums.galleryAlbumId,
  });
}
