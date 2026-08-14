import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SelectionsView from "./SelectionsView";
import type { Album, Dislike, Photo, Selection } from "@/lib/types";


export default async function SelectionsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

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
    supabase.from("photos").select("*").eq("album_id", params.id),
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
