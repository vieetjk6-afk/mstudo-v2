import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPhotos } from "@/lib/photos";
import { getStudioHost } from "@/lib/studio-site";
import { effectivePlan, planAllowsDelivery, planAllowsPublicGallery, planAllowsWatermark } from "@/lib/plans";
import AlbumEditor, { type AlbumPick, type DeliveryTwin } from "./AlbumEditor";
import { categoryLabel } from "@/lib/category";
import type { Album, AlbumSource, Photo } from "@/lib/types";


export async function generateMetadata({ params }: { params: { id: string } }) {
  const { data } = await createClient()
    .from("albums")
    .select("title")
    .eq("id", params.id)
    .maybeSingle();
  return { title: data?.title ? `${data.title} · mstudo` : "mstudo" };
}

export default async function AlbumEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

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
  const { data: linkedContract } = await supabase
    .from("studio_contracts")
    .select("id, client_name, client_phone, selection_album_id, gallery_album_id")
    .or(`selection_album_id.eq.${params.id},gallery_album_id.eq.${params.id}`)
    .maybeSingle();

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
      deliveryTwin={deliveryTwin}
      clientPhone={linkedContract?.client_phone ?? null}
      clientName={linkedContract?.client_name ?? null}
      selections={(picks ?? []) as AlbumPick[]}
      // ?? 6 chứ không phải || 6: studio đặt 0 tháng nghĩa là CỐ Ý giữ ảnh vô
      // hạn, `||` sẽ nuốt mất lựa chọn đó và ép về 6.
      storageMonths={(profile as { storage_months?: number } | null)?.storage_months ?? 6}
    />
  );
}
