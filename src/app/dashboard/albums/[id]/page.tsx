import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { getStudioHost } from "@/lib/studio-site";
import { effectivePlan, planAllowsCollage, planAllowsDelivery, planAllowsPublicGallery, planAllowsWatermark, type Plan } from "@/lib/plans";
import AlbumEditor, { type AlbumPick, type CustomerShare, type DeliveryTwin, type LinkedContractInfo } from "./AlbumEditor";
import type { AlbumPrintInfo } from "./AlbumPrintPanel";
import { normalizeQuota } from "@/lib/album-print-rules";
import { normalizeAlbumMode } from "@/lib/album-mode";
import { categoryLabel } from "@/lib/category";
import type { Album, AlbumSource, Photo } from "@/lib/types";
import { doToc } from "@/lib/do-toc";


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
  const dt = doToc("/dashboard/albums/[id]");

  const { data: { user } } = await dt.buoc("user", supabase.auth.getUser());

  // Danh sách ảnh (album lớn: vài nghìn dòng, hay là bước chậm nhất) KHÔNG chặn
  // trang: lời hứa này đi thẳng xuống AlbumEditor và React stream kết quả tới
  // sau, nên thông tin album / lượt chọn / cài đặt hiện ngay. Vẫn đọc qua RLS
  // bằng client của người đang đăng nhập — album không đọc được thì notFound()
  // bên dưới chặn trước khi lời hứa được trao đi.
  const photosP = fetchAllPhotos(supabase, params.id, "*") as Promise<Photo[]>;

  // MỌI truy vấn chỉ cần id album / id người dùng chạy MỘT đợt song song — trước
  // đây sáu câu trong số này chạy nối đuôi nhau sau đợt đầu. album_shares đọc
  // bằng service role nên KẾT QUẢ của nó chỉ được dùng sau khi album đã đọc được
  // qua RLS (notFound bên dưới chặn trước khi tới chỗ dùng).
  const [
    { data: album }, { data: sources }, { data: profile }, { data: picks },
    studioHost, { data: linkedRows }, printPicksRes, sharesRes,
  ] = await Promise.all([
    dt.buoc("album", Promise.resolve(supabase.from("albums").select("*").eq("id", params.id).single())),
    dt.buoc("sources", Promise.resolve(supabase.from("album_sources").select("*").eq("album_id", params.id).order("position"))),
    user ? supabase.from("profiles").select("plan, plan_expires_at, role, full_name, storage_months").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    // Lượt khách chọn: cần cả danh sách (tab "Lượt chọn" hiện ngay tại màn này)
    // nên lấy hàng thật, count suy ra từ độ dài mảng.
    dt.buoc("picks", Promise.resolve(supabase
      .from("selections")
      .select("id, photo_id, photo_name, session_id, client_name, client_note, photographer_note, created_at")
      .eq("album_id", params.id)
      .order("created_at", { ascending: true }))),
    user ? getStudioHost(supabase, user.id) : Promise.resolve(null),
    // Album này có thuộc hợp đồng nào không? Nếu có → lấy SĐT/tên khách để gửi Zalo
    // thẳng; nếu không (album lẻ) → AlbumEditor sẽ hiện ô nhập SĐT.
    // Hai hợp đồng cùng gắn album này → .maybeSingle() lỗi và trả null (mất SĐT
    // khách, mất thẻ album song sinh). Lấy hợp đồng mới nhất.
    dt.buoc("contract", Promise.resolve(supabase
      .from("studio_contracts")
      .select("id, client_name, client_phone, selection_album_id, gallery_album_id")
      .or(`selection_album_id.eq.${params.id},gallery_album_id.eq.${params.id}`)
      .order("created_at", { ascending: false })
      .limit(1))),
    // Ảnh in khách gửi — xem khối printInfo bên dưới.
    Promise.resolve(supabase
      .from("print_picks")
      .select("photo_id, photo_name, created_at")
      .eq("album_id", params.id)
      .order("created_at", { ascending: true })),
    // Link "chia sẻ ảnh đã chọn" — xem khối customerShares bên dưới.
    Promise.resolve(createAdminClient()
      .from("album_shares")
      .select("token, photo_ids, created_at")
      .eq("album_id", params.id)
      .order("created_at", { ascending: false })
      .limit(200)),
  ]);

  if (!album) notFound();

  // Admin mở album của studio KHÁC (RLS cho phép): gói, tên studio, tên miền và
  // hạn lưu trữ phải là của CHỦ album — trang khách tính quyền theo chủ album,
  // link gửi khách mang tên miền của chủ album. Trước đây mọi thứ lấy theo
  // NGƯỜI ĐANG XEM nên admin thấy tính năng mở hết dù khách của studio không
  // có, và chép link ra thì mang tên miền của admin. Chủ album tự mở thì không
  // tốn thêm câu nào.
  type OwnerRow = { plan: Plan; plan_expires_at: string | null; role: string | null; full_name: string | null; storage_months?: number | null };
  const ownerId = (album as Album).owner_id;
  let owner = profile as OwnerRow | null;
  let ownerHost = studioHost;
  if (user && ownerId && ownerId !== user.id) {
    const [{ data: o }, h] = await Promise.all([
      supabase.from("profiles").select("plan, plan_expires_at, role, full_name, storage_months").eq("id", ownerId).maybeSingle(),
      getStudioHost(supabase, ownerId),
    ]);
    owner = (o as OwnerRow | null) ?? null;
    ownerHost = h;
  }

  const isAdmin = owner?.role === "admin";
  const plan = owner ? effectivePlan(owner.plan, owner.plan_expires_at) : "free";
  const studioName = (owner?.full_name ?? "").trim() || "Studio";
  const linkedContract = linkedRows?.[0] ?? null;

  // Đợt hai — chỉ cần hợp đồng / chủ album vừa đọc ở trên, chạy song song.
  const twinId = linkedContract?.selection_album_id === params.id ? linkedContract?.gallery_album_id : null;
  const [contractRes, twinRes, { data: catRows }] = await Promise.all([
    linkedContract?.id
      ? Promise.resolve(supabase.from("studio_contracts").select("*").eq("id", linkedContract.id).maybeSingle())
      : Promise.resolve({ data: null }),
    twinId
      ? Promise.resolve(supabase.from("albums").select("id, slug, title, status, phase, is_gallery").eq("id", twinId).maybeSingle())
      : Promise.resolve({ data: null }),
    // Loại album do CHÍNH studio này đã dùng (mỗi studio có bộ phân loại riêng).
    Promise.resolve(supabase
      .from("albums")
      .select("category, category_label")
      .eq("owner_id", (album as Album).owner_id)
      .not("category", "is", null)),
  ]);
  dt.xong();

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
    const z = contractRes.data;
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
  if (twinRes.data) deliveryTwin = twinRes.data as DeliveryTwin;

  // Ảnh in khách gửi (thẻ "Ảnh in tặng" ở tab Giao khách). Lỗi = DB chưa chạy
  // migrations/anh_in_tang.sql → không hiện thẻ, phần còn lại của trang vẫn chạy.
  // LUÔN có thẻ (album lẻ lẫn album của hợp đồng) để studio nhập số ảnh in tặng
  // ngay tại album. Trước đây album của hợp đồng chưa đặt số ảnh in thì mất hẳn
  // tab "Ảnh in" — studio tìm trong album không thấy chỗ nhập. Số áp dụng là số
  // LỚN HƠN giữa hợp đồng và album (xem loadPrintQuota).
  let printInfo: AlbumPrintInfo | null = null;
  {
    const { data: pp, error: ppErr } = printPicksRes;
    const a = album as Album & { print_sent_at?: string | null; print_copied_at?: string | null; print_quota?: unknown };
    const albumQuota = normalizeQuota(a.print_quota);
    const quota = Math.max(printQuota, albumQuota);
    if (!ppErr) {
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

  // Ghép layout ảnh: album lẻ bật / tắt ngay tại album (albums.collage_enabled),
  // album của hợp đồng theo công tắc hợp đồng. Cả hai cột đến từ select("*") ở
  // trên — thiếu cột (chưa chạy migrations/ghep_layout.sql) thì là null.
  const flag = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const collageInfo = {
    allowed: planAllowsCollage(plan, isAdmin),
    ownerId,
    contractId: (linkedContract?.id as string | undefined) ?? null,
    contractEnabled: linkedContract?.id ? flag((contractRes.data as { collage_enabled?: unknown } | null)?.collage_enabled) : null,
    albumEnabled: flag((album as { collage_enabled?: unknown }).collage_enabled),
  };

  // Link "chia sẻ ảnh đã chọn" khách tạo cho người khác xem (bảng album_shares).
  // Bảng đã thu hồi quyền đọc của anon/authenticated nên đọc bằng service role —
  // an toàn vì album phía trên đã đọc qua RLS: tới được đây là người có quyền
  // xem album này. Lỗi (DB cũ) thì bỏ qua, phần còn lại của trang vẫn chạy.
  let customerShares: CustomerShare[] = [];
  {
    const { data: sh } = sharesRes;
    customerShares = (sh ?? []).map((r) => ({
      token: r.token as string,
      photoIds: (r.photo_ids as string[] | null) ?? [],
      createdAt: r.created_at as string,
    }));
  }

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
      photosPromise={photosP}
      canDelivery={planAllowsDelivery(plan, isAdmin)}
      canPinHome={planAllowsPublicGallery(plan, isAdmin)}
      canWatermark={planAllowsWatermark(plan, isAdmin)}
      studioName={studioName}
      studioHost={ownerHost}
      studioCats={studioCats}
      contractId={linkedContract?.id ?? null}
      linkedContract={linkedInfo}
      deliveryTwin={deliveryTwin}
      clientPhone={linkedContract?.client_phone ?? null}
      clientName={linkedContract?.client_name ?? null}
      zaloSavedName={(album as Album).zalo_name ?? contractZaloName}
      selections={(picks ?? []) as AlbumPick[]}
      printInfo={printInfo}
      collageInfo={collageInfo}
      customerShares={customerShares}
      initialTab={tabParam}
      // ?? 6 chứ không phải || 6: studio đặt 0 tháng nghĩa là CỐ Ý giữ ảnh vô
      // hạn, `||` sẽ nuốt mất lựa chọn đó và ép về 6.
      storageMonths={owner?.storage_months ?? 6}
    />
  );
}
