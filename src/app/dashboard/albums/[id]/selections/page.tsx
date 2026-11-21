import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPhotos } from "@/lib/photos";
import SelectionsView from "./SelectionsView";
import type { Album, Dislike, Photo, Selection } from "@/lib/types";


export default async function SelectionsPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const supabase = await createClient();

  const { data: album } = await supabase
    .from("albums")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!album) notFound();

  const [{ data: selections }, { data: dislikes }, { data: photos }] = await Promise.all([
    supabase
      .from("selections")
      .select("*")
      .eq("album_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("dislikes")
      .select("*")
      .eq("album_id", params.id)
      .order("created_at", { ascending: true }),
    // Trang chỉ cần map id → drive_file_id (useSelections). `select("*")` cũ kéo
    // mọi cột của mọi ảnh và lặng lẽ dừng ở 1.000 dòng của PostgREST.
    fetchAllPhotos(supabase, params.id, "id, drive_file_id").then((data) => ({ data })),
  ]);

  return (
    <SelectionsView
      album={album as Album}
      selections={(selections ?? []) as Selection[]}
      dislikes={(dislikes ?? []) as Dislike[]}
      photos={(photos ?? []) as Photo[]}
    />
  );
}
