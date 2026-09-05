import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos, filterDeliveryPhotos } from "@/lib/photos";
import { isDeliveryPhase } from "@/lib/album-phase";
import { getStudioBrand } from "@/lib/studio-brand";
import Brand from "@/components/Brand";
import GalleryView from "./GalleryView";
import { buildAlbumMetadata } from "@/lib/album-meta";
import { MAIN_HOST } from "@/lib/hosts";
import { effectivePlan, planAllowsWatermark, type Plan } from "@/lib/plans";
import { getOriginalFolders } from "@/lib/album-original";
import { getStudioHost } from "@/lib/studio-site";
import type { Feedback } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { data } = await createAdminClient()
    .from("albums")
    .select("title, description, cover_url, owner_id")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!data?.title) return { title: "mstudo" };
  const meta = await buildAlbumMetadata({
    title: data.title,
    description: data.description,
    coverUrl: data.cover_url,
    host: MAIN_HOST,
    path: `/album/${params.slug}`,
    ownerId: data.owner_id,
  });
  return { ...meta, manifest: `/album/${params.slug}/manifest.webmanifest` };
}

export default async function GalleryPage({ params, searchParams }: { params: { slug: string }; searchParams?: { share?: string; s?: string } }) {
  const admin = createAdminClient();
  let shareIds: string[] | null = searchParams?.share ? searchParams.share.split(",").filter(Boolean) : null;
  if (!shareIds && searchParams?.s) {
    const { data: sh } = await admin
      .from("album_shares")
      .select("photo_ids")
      .eq("token", searchParams.s)
      .maybeSingle();
    if (sh?.photo_ids?.length) shareIds = sh.photo_ids as string[];
  }
  const { data: album } = await admin
    .from("albums")
    .select("id, slug, title, status, is_gallery, phase, password_hash, gallery_pinned, event_date, cover_url, category, category_label, client_name, download_enabled, watermark_delivery, watermark_text, owner_id")
    .eq("slug", params.slug)
    .single();

  // Giai đoạn quyết định trang này có nội dung hay không — `phase` thắng cờ cũ
  // `is_gallery` (xem @/lib/album-phase).
  const isDelivery = isDeliveryPhase(album);
  // Studio đã đưa album VỀ giai đoạn chọn ảnh: link giao khách cũ không được
  // chết, đưa khách sang đúng trang chọn ảnh của chính album đó.
  if (album && !isDelivery && album.status === "published") redirect(`/a/${album.slug}`);
  if (!album || !isDelivery || album.status !== "published") {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center px-6 py-5 md:px-10">
          <Brand />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p style={{ color: "var(--text2)" }}>Album không khả dụng.</p>
        </div>
      </main>
    );
  }

  const hasPassword = !album.gallery_pinned && !!album.password_hash;

  // Chạy song song: brand, ảnh, sources, feedback và gói của chủ studio — gộp
  // Promise.all thay vì nhiều round-trip tuần tự (giảm TTFB trang khách).
  const [brand, studioHost, allPhotos, { data: s }, { data: feedback }, { data: owner }] = await Promise.all([
    getStudioBrand(admin, album.owner_id),
    // Domain riêng của studio — link chia sẻ phải mang tên miền studio chứ
    // không phải mstudo.com, kể cả khi khách đang mở album trên host nào.
    getStudioHost(admin, album.owner_id),
    hasPassword
      ? Promise.resolve(null)
      : fetchAllPhotos(admin, album.id, "id, drive_file_id, name, source_id, position, is_video"),
    // drive_url/kind cần cho cả 2 trường hợp: có mật khẩu vẫn cần để tính link
    // Drive (nhưng chỉ gửi cho client SAU khi mở khoá — xem access route).
    admin.from("album_sources").select("id, name, position, stage, drive_url, kind").eq("album_id", album.id).order("position"),
    admin
      .from("feedback")
      .select("*")
      .eq("album_id", album.id)
      .eq("approved", true)
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("plan, plan_expires_at, role").eq("id", album.owner_id).maybeSingle(),
  ]);
  const studioName = brand.name;

  // Watermark chỉ mở cho Studio & Photographer Plus (và admin). Chốt ở ĐÂY chứ
  // không chỉ ở form trong dashboard: album được bật watermark từ trước, hoặc
  // của một gói đã hết hạn, phải tự thôi watermark — nếu không thì mỗi lượt tải
  // vẫn đi vòng qua proxy thay vì tải thẳng từ Drive.
  const ownerPlan = effectivePlan(owner?.plan as Plan, owner?.plan_expires_at);
  const canWatermark = planAllowsWatermark(ownerPlan, owner?.role === "admin");

  // Sources hiển thị (ưu tiên stage 'delivery', fallback tất cả nếu chưa gắn).
  const delSources = (s ?? []).filter((x) => x.stage === "delivery");
  const useStages = delSources.length > 0;
  const shownSources = useStages ? delSources : (s ?? []);

  // Chỉ serialize LÔ ẢNH ĐẦU vào HTML SSR; phần còn lại client nạp qua
  // GET /api/album/[slug]/photos (có CDN cache). Ở chế độ share (?s/?share) gửi
  // đủ vì cần đúng các ảnh được chọn (có thể nằm ngoài lô đầu).
  const INITIAL_PHOTOS = 300;
  const shareMode = !!shareIds && shareIds.length > 0;
  let photos = null;
  let totalPhotos: number | null = null;
  let sources = null;
  // Link Drive của các folder trong album — dùng cho nút "Tải album". Với album
  // có mật khẩu, KHÔNG lộ trước khi mở khoá; access route trả về sau khi đúng mk.
  let driveFolders: { name: string; url: string }[] = [];
  // Link Drive file gốc ở giai đoạn chọn ảnh (JPG Goc) — hiện trong album hoàn thiện.
  let originalFolders: { name: string; url: string }[] = [];
  if (!hasPassword) {
    const filtered = filterDeliveryPhotos(allPhotos ?? [], s ?? []);
    totalPhotos = filtered.length;
    // Share: cần đủ ảnh để lọc theo shareIds. Ngược lại chỉ gửi lô đầu.
    photos = shareMode ? filtered : filtered.slice(0, INITIAL_PHOTOS);
    sources = shownSources.map(({ id, name, position }) => ({ id, name, position }));
    // Giai đoạn giao khách: nhận MỌI link Drive, không đòi kind === "folder".
    // kind do isFolderLink() đoán từ URL lúc lưu, chỉ khớp dạng ".../folders/…";
    // studio dán link chia sẻ dạng khác là thành "file" và nút biến mất, dù link
    // vẫn mở đúng thư mục. Ở nhánh fallback (album chưa gắn giai đoạn) thì vẫn
    // lọc theo folder, nếu không một album ghép từ nhiều link file lẻ sẽ đẻ ra
    // cả danh sách nút vô nghĩa.
    driveFolders = shownSources
      .filter((x) => x.drive_url && (useStages || x.kind === "folder"))
      .map(({ name, drive_url }) => ({ name, url: drive_url as string }));
    originalFolders = await getOriginalFolders(admin, album.id, s ?? []);
  }

  return (
    <GalleryView
      gallery={{
        id: album.id,
        slug: album.slug,
        title: album.title,
        event_date: album.event_date,
        cover_url: album.cover_url,
        hasPassword,
        allowDownload: album.download_enabled !== false,
        // Nguồn có gắn giai đoạn "giao khách" ⇒ thư mục Drive đúng là FILE
        // CHỈNH SỬA. Album chưa gắn giai đoạn thì shownSources rơi về TẤT CẢ
        // nguồn (kể cả thư mục ảnh chọn), lúc đó không được gọi là file chỉnh sửa.
        driveIsEdited: useStages,
        watermark: canWatermark && album.watermark_delivery ? (album.watermark_text || studioName) : null,
      }}
      initialPhotos={photos}
      totalPhotos={totalPhotos}
      initialSources={sources}
      initialDriveFolders={driveFolders}
      initialOriginalFolders={originalFolders}
      feedback={(feedback ?? []) as Feedback[]}
      shareIds={shareIds}
      studioName={studioName}
      logoUrl={brand.logoUrl}
      studioHost={studioHost}
    />
  );
}
