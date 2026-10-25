import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import SystemScreen from "./SystemScreen";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  return <SystemScreen />;
}
