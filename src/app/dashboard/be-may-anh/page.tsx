import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import PetView from "./PetView";

export const dynamic = "force-dynamic";

/**
 * BÉ MÁY ẢNH — thú ảo giữ chân người dùng mstudo (mỗi tài khoản một bé).
 * Luật chơi: @/lib/pet · dữ liệu: /api/pet · bảng: supabase/migrations/be_may_anh.sql.
 * Mở cho mọi tài khoản đăng nhập; nhiệm vụ hiện theo gói (xem tasksFor).
 */
export default async function PetPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  return <PetView />;
}
