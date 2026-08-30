import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, planAllowsDelivery, planAllowsWatermark, type Plan } from "@/lib/plans";
import { fetchAllPhotos } from "@/lib/photos";
import CustomerAlbum from "./CustomerAlbum";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Brand from "@/components/Brand";
import { buildAlbumMetadata } from "@/lib/album-meta";
import { getStudioBrand } from "@/lib/studio-brand";
import { getStudioHost } from "@/lib/studio-site";
import { pickFolderLinks, type DriveFolderLink } from "@/lib/album-original";
import { isDeliveryPhase } from "@/lib/album-phase";
import { MAIN_HOST } from "@/lib/hosts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { data } = await createAdminClient()
    .from("albums")
    .select("title, description, cover_url, owner_id")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!data?.title) return { title: "mstudo" };
  return buildAlbumMetadata({
    title: data.title,
    description: data.description,
    coverUrl: data.cover_url,
    host: MAIN_HOST,
    path: `/a/${params.slug}`,
    ownerId: data.owner_id,
  });
}

export default async function PublicAlbumPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { share?: string; s?: string };
}) {
  const admin = createAdminClient();

  const { data: album } = await admin
    .from("albums")
    .select(
      "id, owner_id, slug, title, description, status, password_hash, selection_limit, watermark_enabled, watermark_text, download_enabled, phase, cover_url"
    )
    .eq("slug", params.slug)
    .single();

  // Đồng bộ Drive (2 album riêng): sau khi giao khách, hợp đồng đã có album giao
  // khách hoàn thiện → album chọn ảnh không còn hiện cho khách. Chuyển hướng
  // link chọn ảnh sang album giai đoạn hoàn thiện.
  //
  // Chỉ chuyển khi album giao khách THẬT SỰ đang ở giai đoạn giao khách: studio
  // đưa nó về "Chọn ảnh" thì link này phải quay lại trang chọn ảnh, nếu không
  // nút đổi giai đoạn coi như vô tác dụng.
  if (album && album.phase !== "delivery") {
    const { data: contract } = await admin
      .from("studio_contracts")
      .select("gallery_album_id")
      .eq("selection_album_id", album.id)
      .maybeSingle();
    const galleryId = (contract as { gallery_album_id?: string | null } | null)?.gallery_album_id;
    if (galleryId) {
      const { data: g } = await admin
        .from("albums")
        .select("slug, status, is_gallery, phase")
        .eq("id", galleryId)
        .maybeSingle();
      if (g && isDeliveryPhase(g) && g.status === "published") {
        redirect(`/album/${g.slug}`);
      }
    }
  }

  // Unified project: once the studio switches to the delivery phase, the same
  // client link leads to the finished-photo delivery experience. Free-plan
  // owners don't get delivery, so their albums stay on the selection view even
  // if a stale phase value says otherwise.
  if (album && album.phase === "delivery") {
    const { data: ownerPlan } = await admin
      .from("profiles")
      .select("plan, plan_expires_at, role")
      .eq("id", album.owner_id)
      .maybeSingle();
    const ownerIsAdmin = ownerPlan?.role === "admin";
    const ownerEffective = ownerPlan ? effectivePlan(ownerPlan.plan, ownerPlan.plan_expires_at) : "free";
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
  if (!shareIds && searchParams?.s) {
    const { data: sh } = await admin
      .from("album_shares")
      .select("photo_ids")
      .eq("token", searchParams.s)
      .maybeSingle();
    if (sh?.photo_ids?.length) shareIds = sh.photo_ids as string[];
  }

  // Owner permissions gate customer download (ZIP) and notes.
  // Keep the core owner query to SAFE columns only, so an un-migrated brand
  // column can never break download/notes permissions or photo loading.
  // Brand (logo/name) fetched separately, best-effort — missing columns just
  // fall back to defaults without affecting anything else. Chạy song song với
  // query owner (độc lập nhau) để bớt một round-trip tuần tự.
  const [{ data: owner }, brand, studioHost] = await Promise.all([
    admin
      .from("profiles")
      .select("role, can_zip, can_notes, full_name, plan, plan_expires_at")
      .eq("id", album.owner_id)
      .maybeSingle(),
    getStudioBrand(admin, album.owner_id),
    // Domain riêng của studio cho link "chia sẻ ảnh đã chọn".
    getStudioHost(admin, album.owner_id),
  ]);
  const studioName = brand.name;
  const isAdminOwner = owner?.role === "admin";
  // `can_zip` là cờ gói "cho khách tải ảnh" (nay tải thẳng từ Drive, không còn
  // nén ZIP) — giữ nguyên cột cũ để khỏi phải di trú dữ liệu.
  const allowDownload = (isAdminOwner || !!owner?.can_zip) && album.download_enabled !== false;
  const allowNotes = isAdminOwner || !!owner?.can_notes;
  // Watermark: chỉ Photographer Plus & Studio. Chốt phía server để album bật từ
  // trước, hoặc của gói đã hết hạn, tự thôi watermark — ảnh không watermark mới
  // tải thẳng từ Drive được.
  const canWatermark = planAllowsWatermark(
    effectivePlan(owner?.plan as Plan, owner?.plan_expires_at),
    isAdminOwner,
  );

  let photos = null;
  let sources = null;
  // Link thư mục Drive của chính album này — nút "Tải ảnh từ Drive" cho khách.
  // Google tự nén và tự phục vụ nên không byte nào đi qua Vercel/Supabase.
  let driveFolders: DriveFolderLink[] = [];
  let selected: string[] = [];
  let disliked: string[] = [];
  let notes: Record<string, string> = {};
  if (!hasPassword) {
    const [p, { data: s }, { data: sel }, { data: dis }] = await Promise.all([
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
    // Chỉ khi studio cho phép tải — link thư mục mở ra CẢ album, nên nó phải
    // theo đúng quyền tải như nút tải từng ảnh.
    if (allowDownload) driveFolders = pickFolderLinks(shown);
    selected = (sel ?? []).map((r) => r.photo_id);
    disliked = (dis ?? []).map((r) => r.photo_id);
    for (const r of sel ?? []) if (r.client_note) notes[r.photo_id] = r.client_note;
    for (const r of dis ?? []) if (r.client_note) notes[r.photo_id] = r.client_note;
  }

  return (
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
        allowNotes,
      }}
      initialPhotos={photos}
      initialSources={sources}
      initialSelected={selected}
      initialDisliked={disliked}
      initialNotes={notes}
      shareIds={shareIds}
      initialDriveFolders={driveFolders}
      studioName={studioName}
      logoUrl={brand.logoUrl}
      studioHost={studioHost}
    />
  );
}
