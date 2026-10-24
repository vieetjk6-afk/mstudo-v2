import { NextResponse, type NextRequest } from "next/server";
import { connectOA, ownerFromState } from "@/lib/zalo/oa";
import { sessionActsFor } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

/** Zalo OAuth callback cho luồng kết nối OA. state = ký(ownerId). */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const ownerId = ownerFromState(state);
  const back = (q: string) =>
    NextResponse.redirect(new URL(`/dashboard/studio/messages?${q}`, req.url));

  if (error || !code || !ownerId) return back("zalo=error");
  if (!(await sessionActsFor(ownerId))) return back("zalo=error");
  try {
    await connectOA(ownerId, code);
    return back("zalo=oa_connected");
  } catch {
    return back("zalo=error");
  }
}
