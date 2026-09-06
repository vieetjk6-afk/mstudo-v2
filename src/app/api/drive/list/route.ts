import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSource } from "@/lib/drive-server";
import { isFolderLink } from "@/lib/drive";

export const dynamic = "force-dynamic";

/** List image files for a Drive folder/file link (photographer filter tool). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY chưa cấu hình trên server." },
      { status: 200 }
    );
  }

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url?.trim()) return NextResponse.json({ error: "missing_url" }, { status: 400 });

  try {
    const kind = isFolderLink(url) ? "folder" : "file";
    const { files } = await resolveSource(url.trim(), kind);
    return NextResponse.json({
      files: files.map((f) => ({ id: f.id, name: f.name })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "drive_error" },
      { status: 200 }
    );
  }
}
