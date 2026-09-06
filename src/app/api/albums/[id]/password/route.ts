import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Set, change or clear an album password. RLS restricts to owner/admin. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  const password_hash =
    password && password.trim().length > 0
      ? await bcrypt.hash(password.trim(), 10)
      : null;

  const { error } = await supabase
    .from("albums")
    .update({ password_hash })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true, hasPassword: password_hash !== null });
}
