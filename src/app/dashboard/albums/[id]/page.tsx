import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { getStudioHost } from "@/lib/studio-site";
import { effectivePlan, planAllowsDelivery, planAllowsPublicGallery, planAllowsWatermark } from "@/lib/plans";
import AlbumEditor, { type AlbumPick, type CustomerShare, type DeliveryTwin, type LinkedContractInfo } from "./AlbumEditor";
import type { AlbumPrintInfo } from "./AlbumPrintPanel";
import { normalizeQuota } from "@/lib/album-print-rules";
import { normalizeAlbumMode } from "@/lib/album-mode";
import { categoryLabel } from "@/lib/category";
import type { Album, AlbumSource, Photo } from "@/lib/types";


export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { data } = await (await createClient())
    .from("albums")
    .select("title")
    .eq("id", params.id)
    .maybeSingle();
  return { title: data?.title ? `${data.title} · mstudo` : "mstudo" };
}

export default async function AlbumEditPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ tab?: string }>;
  }
) {
  const params = await props.params;
  const tabParam = (await props.searchParams)?.tab;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: album }, { data: sources }, photos, { data: profile }, { data: picks }] = await Promise.all([
    supabase.from("albums").select("*").eq("id", params.id).single(),
    supabase.from("album_sources").select("*").eq("album_id", params.id).order("position"),
    fetchAllPhotos(supabase, params.id, "*"),
    user ? supabase.from("profiles").select("plan, plan_expires_at, role, full_name, storage_months").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    // Lượt khách chọn: cần cả danh sách (tab "Lượt chọn" hiện ngay tại màn này)
    // nên lấy hàng thật, count suy ra từ độ dài mảng.
    supabase
      .from("selections")
      .select("id, photo_id, photo_name, session_id, client_name, client_note, photographer_note, created_at")
      .eq("album_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  if (!album) notFound();

  const isAdmin = profile?.role === "admin";
  const plan = profile ? effectivePlan(profile.plan, profile.plan_expires_at) : "free";
  const studioName = (profile?.full_name ?? "").trim() || "Studio";
  const studioHost = user ? await getStudioHost(supabase, user.id) : null;

  // Album này có thuộc hợp đồng nào không? Nếu có → lấy SĐT/tên khách để gửi Zalo
  // thẳng; nếu không (album lẻ) → AlbumEditor sẽ hiện ô nhập SĐT.
  // Hai hợp đồng cùng gắn album này → .maybeSingle() lỗi và trả null (mất SĐT
  // khách, mất thẻ album song sinh). Lấy hợp đồng mới nhất.
  const { data: linkedRows } = await supabase
    .from("studio_contracts")
    .select("id, client_name, client_phone, selection_album_id, gallery_album_id")
    .or(`selection_album_id.eq.${params.id},gallery_album_id.eq.${params.id}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const linkedContract = linkedRows?.[0] ?? null;

  // Tên bạn Zalo đã nhớ trên hợp đồng (nút "Gửi Zalo cho <tên>"). Truy vấn riêng
  // và bỏ qua lỗi: database chưa chạy migrations/zalo_nguoi_nhan.sql thì cột
  // chưa có, gộp vào select ở trên sẽ làm hỏng cả trang.
  let contractZaloName: string | null = null;
  // Thẻ "Album của hợp đồng …" + chế độ album (album mặc định / nhập link riêng).
  // select("*") để database chưa chạy che_do_album_hop_dong.sql vẫn đọc được.
  let linkedInfo: LinkedContractInfo | null = null;
  // Số ảnh in hợp đồng tặng (migrations/anh_in_tang.sql) — đọc từ cùng select("*").
  let printQuota = 0;
  if (linkedContract?.id) {
    const { data: z } = await supabase.from("studio_contracts").select("*").eq("id", linkedContract.id).maybeSingle();
    const zr = z as { zalo_name?: string | null; code?: string | null; title?: string | null; status?: string | null; album_mode?: unknown } | null;
    contractZaloName = zr?.zalo_name ?? null;
    printQuota = normalizeQuota((z as { print_quota?: unknown } | null)?.print_quota);
    linkedInfo = {
      id: linkedContract.id as string,
      code: zr?.code ?? null,
      title: zr?.title ?? "",
      status: zr?.status ?? null,
      albumMode: normalizeAlbumMode(zr?.album_mode),
      isSelectionAlbum: linkedContract.selection_album_id === params.id,
    };
  }

  // Hợp đồng đồng bộ Drive có HAI album: chọn ảnh (JPG Goc) và giao khách
  // (File ChinhSua). Khi album giao khách đã sẵn sàng, link khách của album
  // CHỌN ẢNH tự chuyển sang đó (xem src/app/a/[slug]/page.tsx) — nhìn ở màn này
  // thì album vẫn ghi "Chọn ảnh" mà bấm link lại ra giao khách. Nạp album kia
  // để nói thẳng điều đó ra và cho studio đưa ngược về.
  let deliveryTwin: DeliveryTwin | null = null;
  if (linkedContract?.selection_album_id === params.id && linkedContract?.gallery_album_id) {
    const { data: twin } = await supabase
      .from("albums")
      .select("id, slug, title, status, phase, is_gallery")
      .eq("id", linkedContract.gallery_album_id)
      .maybeSingle();
    if (twin) deliveryTwin = twin as DeliveryTwin;
  }

  // Ảnh in khách gửi (thẻ "Ảnh in tặng" ở tab Giao khách). Lỗi = DB chưa chạy
  // migrations/anh_in_tang.sql → không hiện thẻ, phần còn lại của trang vẫn chạy.
  // Album lẻ (không thuộc hợp đồng) luôn có thẻ để studio nhập số ảnh in tặng
  // ngay tại đây; album của hợp đồng thì chỉ hiện khi hợp đồng có tặng in.
  let printInfo: AlbumPrintInfo | null = null;
  {
    const { data: pp, error: ppErr } = await supabase
      .from("print_picks")
      .select("photo_id, photo_name, created_at")
      .eq("album_id", params.id)
      .order("created_at", { ascending: true });
    const a = album as Album & { print_sent_at?: string | null; print_copied_at?: string | null; print_quota?: unknown };
    const albumQuota = normalizeQuota(a.print_quota);
    const quota = Math.max(printQuota, albumQuota);
    if (!ppErr && (!linkedContract?.id || quota > 0 || (pp?.length ?? 0) > 0)) {
      printInfo = {
        quota,
        contractId: (linkedContract?.id as string | undefined) ?? null,
        contractQuota: printQuota,
        albumQuota,
        picks: (pp ?? []).map((r) => ({ photo_id: r.photo_id as string, photo_name: (r.photo_name as string) ?? "" })),
        sentAt: a.print_sent_at ?? null,
        copiedAt: a.print_copied_at ?? null,
      };
    }
  }

  // Link "chia sẻ ảnh đã chọn" khách tạo cho người khác xem (bảng album_shares).
  // Bảng đã thu hồi quyền đọc của anon/authenticated nên đọc bằng service role —
  // an toàn vì album phía trên đã đọc qua RLS: tới được đây là người có quyền
  // xem album này. Lỗi (DB cũ) thì bỏ qua, phần còn lại của trang vẫn chạy.
  let customerShares: CustomerShare[] = [];
  {
    const { data: sh } = await createAdminClient()
      .from("album_shares")
      .select("token, photo_ids, created_at")
      .eq("album_id", params.id)
      .order("created_at", { ascending: false })
      .limit(200);
    customerShares = (sh ?? []).map((r) => ({
      token: r.token as string,
      photoIds: (r.photo_ids as string[] | null) ?? [],
      createdAt: r.created_at as string,
    }));
  }

  // Loại album do CHÍNH studio này đã dùng (mỗi studio có bộ phân loại riêng).
  const { data: catRows } = await supabase
    .from("albums")
    .select("category, category_label")
    .eq("owner_id", (album as Album).owner_id)
    .not("category", "is", null);
  const seenCat = new Set<string>();
  const studioCats: { slug: string; label: string }[] = [];
  for (const r of catRows ?? []) {
    const slug = ((r.category as string | null) ?? "").trim();
    if (slug && !seenCat.has(slug)) {
      seenCat.add(slug);
      studioCats.push({ slug, label: categoryLabel(slug, r.category_label as string | null) });
    }
  }

  return (
    <AlbumEditor
      album={album as Album}
      initialSources={(sources ?? []) as AlbumSource[]}
      initialPhotos={(photos ?? []) as Photo[]}
      canDelivery={planAllowsDelivery(plan, isAdmin)}
      canPinHome={planAllowsPublicGallery(plan, isAdmin)}
      canWatermark={planAllowsWatermark(plan, isAdmin)}
      studioName={studioName}
      studioHost={studioHost}
      studioCats={studioCats}
      contractId={linkedContract?.id ?? null}
      linkedContract={linkedInfo}
      deliveryTwin={deliveryTwin}
      clientPhone={linkedContract?.client_phone ?? null}
      clientName={linkedContract?.client_name ?? null}
      zaloSavedName={(album as Album).zalo_name ?? contractZaloName}
      selections={(picks ?? []) as AlbumPick[]}
      printInfo={printInfo}
      customerShares={customerShares}
      initialTab={tabParam}
      // ?? 6 chứ không phải || 6: studio đặt 0 tháng nghĩa là CỐ Ý giữ ảnh vô
      // hạn, `||` sẽ nuốt mất lựa chọn đó và ép về 6.
      storageMonths={(profile as { storage_months?: number } | null)?.storage_months ?? 6}
    />
  );
}
