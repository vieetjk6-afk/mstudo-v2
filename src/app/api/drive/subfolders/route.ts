import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSubFolders } from "@/lib/drive-server";
import { extractFolderId } from "@/lib/drive";

export const dynamic = "force-dynamic";

/** List sub-folders inside a parent Drive folder (for "split into sub-folders"). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_API_KEY chưa cấu hình." }, { status: 200 });
  }

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const folderId = url ? extractFolderId(url) : null;
  if (!folderId) return NextResponse.json({ error: "Không nhận ra link folder." }, { status: 200 });

  try {
    const subs = await listSubFolders(folderId);
    return NextResponse.json({
      folders: subs.map((f) => ({
        id: f.id,
        name: f.name,
        url: `https://drive.google.com/drive/folders/${f.id}`,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "drive_error" },
      { status: 200 }
    );
  }
}
