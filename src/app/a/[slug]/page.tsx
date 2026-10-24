import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, planAllowsDelivery, planAllowsFaceSearch, planAllowsWatermark, type Plan } from "@/lib/plans";
import { fetchAllPhotos } from "@/lib/photos";
import CustomerAlbum from "./CustomerAlbum";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Brand from "@/components/Brand";
import { buildAlbumMetadata } from "@/lib/album-meta";
import { getAlbumOwner } from "@/lib/album-owner";
import { getStudioHost } from "@/lib/studio-site";
import { pickFolderLinks, type DriveFolderLink } from "@/lib/album-original";
import { resolveDeliveredAlbum } from "@/lib/contract-album";
import { faceChips, type PersonChip } from "@/lib/face-people";
import { tienDoQuet, type TienDoQuet } from "@/lib/face-pending";
import { MAIN_HOST } from "@/lib/hosts";

export const dynamic = "force-dynamic";

/**
 * Album theo slug — bọc React `cache()` để generateMetadata và page dùng chung
 * MỘT lượt đọc trong cùng request (trước đây mỗi bên tự query albums một lần).
 * Chọn đủ cột cho cả hai phía; slug là duy nhất nên maybeSingle tương đương
 * single() cũ (không thấy → null).
 */
const getAlbumBySlug = cache(async (slug: string) => {
  const { data } = await createAdminClient()
    .from("albums")
    .select(
      "id, owner_id, slug, title, description, status, password_hash, selection_limit, watermark_enabled, watermark_text, download_enabled, phase, cover_url"
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const data = await getAlbumBySlug(params.slug);
  if (!data?.title) return { title: "mstudo" };
  const meta = await buildAlbumMetadata({
    title: data.title,
    description: data.description,
    coverUrl: data.cover_url,
    host: MAIN_HOST,
    path: `/a/${params.slug}`,
    ownerId: data.owner_id,
  });
  // Manifest RIÊNG của album này → khách cài được trang chọn ảnh lên màn hình
  // chính, mang tên album và logo studio (xem @/lib/client-manifest).
  return { ...meta, manifest: `/a/${params.slug}/manifest.webmanifest` };
}

export default async function PublicAlbumPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ share?: string; s?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const admin = createAdminClient();

  const album = await getAlbumBySlug(params.slug);

  // Đồng bộ Drive (2 album riêng): sau khi giao khách, hợp đồng đã có album giao
  // khách hoàn thiện → album chọn ảnh không còn hiện cho khách. Chuyển hướng
  // link chọn ảnh sang album giai đoạn hoàn thiện.
  //
  // Chỉ chuyển khi album giao khách THẬT SỰ đang ở giai đoạn giao khách: studio
  // đưa nó về "Chọn ảnh" thì link này phải quay lại trang chọn ảnh, nếu không
  // nút đổi giai đoạn coi như vô tác dụng.
  if (album && album.phase !== "delivery") {
    // Hai hợp đồng có thể cùng gắn một album (nhân bản hợp đồng, gắn tay) —
    // .maybeSingle() khi đó báo lỗi và trả null, link khách không bao giờ được
    // chuyển. Lấy hợp đồng mới nhất.
    const { data: contracts } = await admin
      .from("studio_contracts")
      .select("gallery_album_id")
      .eq("selection_album_id", album.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const galleryId = (contracts?.[0] as { gallery_album_id?: string | null } | undefined)?.gallery_album_id;
    if (galleryId) {
      const { data: g } = await admin
        .from("albums")
        .select("id, slug, status, is_gallery, phase")
        .eq("id", galleryId)
        .maybeSingle();
      // Luật chung ở @/lib/contract-album: album giao riêng đang giao khách +
      // đã xuất bản thì thắng album này (album này chưa ở giai đoạn giao khách).
      const delivered = resolveDeliveredAlbum<{ id: string; slug?: string; phase?: string | null; is_gallery?: boolean | null; status?: string | null }>({
        gallery: g,
        selection: { id: album.id, phase: album.phase, status: album.status },
      });
      if (delivered?.via === "gallery") {
        redirect(`/album/${delivered.album.slug}`);
      }
    }
  }

  // Unified project: once the studio switches to the delivery phase, the same
  // client link leads to the finished-photo delivery experience. Free-plan
  // owners don't get delivery, so their albums stay on the selection view even
  // if a stale phase value says otherwise.
  if (album && album.phase === "delivery") {
    // Cùng dòng profiles đã cache cho metadata — không đọc lại.
    const ownerRow = (await getAlbumOwner(album.owner_id)).profile;
    const ownerIsAdmin = ownerRow?.role === "admin";
    const ownerEffective = ownerRow ? effectivePlan(ownerRow.plan, ownerRow.plan_expires_at) : "free";
    if (planAllowsDelivery(ownerEffective, ownerIsAdmin)) {
      redirect(`/album/${params.slug}`);
    }
  }

  if (!album || album.status !== "published") {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <Brand />
          <LanguageSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-accent-muted">This album is not available.</p>
        </div>
      </main>
    );
  }

  const hasPassword = !!album.password_hash;

  // View only specific photos (read-only): ?s=token (short link) or the legacy
  // ?share=id1,id2,id3. Token links keep the URL short for large selections.
  let shareIds: string[] | null = searchParams?.share ? searchParams.share.split(",").filter(Boolean) : null;

  // Owner permissions gate customer download (ZIP) and notes.
  // getAlbumOwner (cache theo request) đọc profiles MỘT lần cho cả quyền lẫn
  // thương hiệu; cột thương hiệu chưa migrate thì nó tự lùi về cột an toàn nên
  // quyền tải/ghi chú không bao giờ hỏng vì brand. Tra token chia sẻ (?s=)
  // chạy song song luôn — nó độc lập với owner.
  const [{ profile: owner, brand }, studioHost, sh] = await Promise.all([
    getAlbumOwner(album.owner_id),
    // Domain riêng của studio cho link "chia sẻ ảnh đã chọn".
    getStudioHost(admin, album.owner_id),
    !shareIds && searchParams?.s
      ? admin.from("album_shares").select("photo_ids").eq("token", searchParams.s).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);
  if (sh?.photo_ids?.length) shareIds = sh.photo_ids as string[];
  const studioName = brand.name;
  const isAdminOwner = owner?.role === "admin";
  // HAI quyền tải, KHÁC nhau có chủ ý:
  //
  //  - allowDownload: tải ảnh NGAY TRONG APP (nút tải ở khung xem ảnh). Byte đi
  //    qua /api/img, tốn băng thông của hệ thống → vẫn khoá theo gói bằng cờ
  //    `can_zip` (tên cột cũ từ thời còn nén ZIP, giữ nguyên để khỏi di trú).
  //  - allowDrive: mở THƯ MỤC DRIVE của studio. Google tự nén và tự phục vụ nên
  //    hệ thống không tốn byte nào → mọi gói đều được, chỉ cần studio bật cho
  //    phép tải ở album này.
  const allowDownload = (isAdminOwner || !!owner?.can_zip) && album.download_enabled !== false;
  const allowDrive = album.download_enabled !== false;
  const allowNotes = isAdminOwner || !!owner?.can_notes;
  // Watermark: chỉ Photographer Plus & Studio. Chốt phía server để album bật từ
  // trước, hoặc của gói đã hết hạn, tự thôi watermark — ảnh không watermark mới
  // tải thẳng từ Drive được.
  const ownerPlan = effectivePlan(owner?.plan as Plan, owner?.plan_expires_at);
  const canWatermark = planAllowsWatermark(ownerPlan, isAdminOwner);
  // Tìm ảnh theo khuôn mặt: chỉ Photographer Plus & Studio. Chốt ở ĐÂY, không
  // chỉ ở bộ quét: album của gói đã hạ hoặc đã hết hạn vẫn còn nguyên khuôn mặt
  // gom từ trước trong DB, nên nếu chỉ chặn bộ quét thì ô tìm mặt vẫn hiện và
  // vẫn bấm được — tính năng của gói cao tiếp tục dùng free.
  const canFaceSearch = planAllowsFaceSearch(ownerPlan, isAdminOwner);

  let photos = null;
  let sources = null;
  // Link thư mục Drive của chính album này — nút "Tải ảnh từ Drive" cho khách.
  // Google tự nén và tự phục vụ nên không byte nào đi qua Vercel/Supabase.
  let driveFolders: DriveFolderLink[] = [];
  let selected: string[] = [];
  let disliked: string[] = [];
  const notes: Record<string, string> = {};
  let people: PersonChip[] = [];
  // Máy chủ còn đang quét → khối tìm theo khuôn mặt nói ĐÃ QUÉT BAO NHIÊU/BAO
  // NHIÊU thay vì biến mất. Album có mật khẩu thì để route mở khoá trả lời.
  let faceScan: TienDoQuet | null = null;
  if (!hasPassword) {
    const [p, { data: s }, { data: sel }, { data: dis }, { data: ppl }, { data: pplLinks }] =
      await Promise.all([
      fetchAllPhotos(admin, album.id, "id, drive_file_id, name, source_id, position"),
      admin
        .from("album_sources")
        .select("id, name, position, stage, drive_url, kind")
        .eq("album_id", album.id)
        .order("position"),
      admin
        .from("selections")
        .select("photo_id, client_note")
        .eq("album_id", album.id),
      admin
        .from("dislikes")
        .select("photo_id, client_note")
        .eq("album_id", album.id),
      // Nhóm người studio đã lưu. Chưa chạy migration album_people.sql thì hai
      // câu này lỗi và `data` là null — album vẫn chạy y như trước, chỉ không có
      // hàng chip. Cố ý không nổ: một tính năng thêm không được làm sập trang
      // chọn ảnh của khách.
      admin
      // `select("*")` CÓ CHỦ Ý, không phải lười liệt kê cột: `cover_box` là cột
      // THÊM SAU. Liệt kê tên nó ra thì trên một database chưa chạy lại
      // migration, cả câu này lỗi và khối tìm theo khuôn mặt BIẾN MẤT HẲN — thay
      // vì chỉ mất phần ảnh mặt cắt sẵn. Lấy `*` thì cột thiếu chỉ là undefined,
      // và faceChips tự lùi về lấy cả tấm làm ảnh thẻ.
        .from("album_people")
        .select("*")
        .eq("album_id", album.id)
        .order("position"),
      admin.from("album_photo_people").select("person_id, photo_id").eq("album_id", album.id),
    ]);
    // Selection view prefers selection-stage photos. Only apply the filter when
    // there are BOTH selection and delivery sources — otherwise (e.g. every
    // source is tagged 'delivery', or stages are unset) showing nothing would
    // look like a stuck "Đang tải…". Fall back to all photos so the album is
    // never mysteriously empty.
    const selSources = (s ?? []).filter((x) => x.stage !== "delivery");
    const selSourceIds = new Set(selSources.map((x) => x.id));
    const filtered = (p ?? []).filter((ph) => !ph.source_id || selSourceIds.has(ph.source_id));
    photos = filtered.length > 0 ? filtered : (p ?? []);
    const shown = filtered.length > 0 ? selSources : (s ?? []);
    sources = shown.map(({ id, name, position }) => ({ id, name, position }));
    // Link thư mục mở ra CẢ album nên vẫn theo cờ "cho phép tải" của album, chỉ
    // không còn theo gói (xem allowDrive ở trên).
    if (allowDrive) driveFolders = pickFolderLinks(shown);
    selected = (sel ?? []).map((r) => r.photo_id);
    disliked = (dis ?? []).map((r) => r.photo_id);
    for (const r of sel ?? []) if (r.client_note) notes[r.photo_id] = r.client_note;
    for (const r of dis ?? []) if (r.client_note) notes[r.photo_id] = r.client_note;
    // Chỉ những ảnh THẬT SỰ hiện trong lưới: album giao khách / album chọn ảnh
    // lọc theo source, nên một chip trỏ vào ảnh không hiện là một chip bấm vào
    // ra lưới trống.
    people = canFaceSearch ? faceChips(ppl ?? [], pplLinks ?? [], new Set(photos.map((ph) => ph.id))) : [];
    if (canFaceSearch && people.length === 0) faceScan = await tienDoQuet(admin, album.id);
  }

  return (
    <>
      <CustomerAlbum
        album={{
          id: album.id,
          slug: album.slug,
          title: album.title,
          description: album.description,
          cover_url: album.cover_url,
          selection_limit: album.selection_limit,
          watermark_enabled: canWatermark && album.watermark_enabled,
          watermark_text: album.watermark_text,
          hasPassword,
          allowDownload,
          allowDrive,
          allowNotes,
        }}
        initialPhotos={photos}
        initialSources={sources}
        initialSelected={selected}
        initialDisliked={disliked}
        initialNotes={notes}
        shareIds={shareIds}
        initialDriveFolders={driveFolders}
        initialPeople={people}
        faceScan={faceScan}
        studioName={studioName}
        logoUrl={brand.logoUrl}
        studioHost={studioHost}
      />
    </>
  );
}
